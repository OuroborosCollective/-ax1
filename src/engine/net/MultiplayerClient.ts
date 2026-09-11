import { timestampedInputBuffer } from './TimestampedInputBuffer';

export interface PeerPlayerState {
  id: string;
  name: string;
  classId: string;
  level: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  z: number;
  facingAngle: number;
  activeWeaponType: string;
  isMounted: boolean;
  actionState: 'idle' | 'walk' | 'run' | 'attack' | 'cast' | 'hit';
  equipment?: Record<string, any>;
  appearance?: any;
}

export type NetEventHandler = (data: any) => void;

export class MultiplayerClient {
  private static instance: MultiplayerClient | null = null;
  private ws: WebSocket | null = null;
  private isConnecting: boolean = false;
  private reconnectTimer: number | null = null;
  private pingIntervalTimer: number | null = null;
  private sendThrottleTimer: number | null = null;

  public isConnected: boolean = false;
  public localPlayerId: string = '';
  public pingMs: number = 0;
  public onlineCount: number = 1;
  public serverTimeOffset: number = 0;

  private listeners: Map<string, Set<NetEventHandler>> = new Map();
  private pendingLocalSync: any = null;
  private sequenceNumber: number = 0;

  public static getInstance(): MultiplayerClient {
    if (!MultiplayerClient.instance) {
      MultiplayerClient.instance = new MultiplayerClient();
    }
    return MultiplayerClient.instance;
  }

  public connect(playerId: string, playerName: string, classId: string = 'knight'): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.localPlayerId = playerId;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws/realm?playerId=${encodeURIComponent(playerId)}&name=${encodeURIComponent(playerName)}&classId=${encodeURIComponent(classId)}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log(`[MultiplayerClient] Realtime Realm WebSocket connected to ${url}`);
        this.emit('connected', { playerId });
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          this.handlePacket(packet);
        } catch (err) {
          console.warn('[MultiplayerClient] Failed to parse network packet:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', {});
        this.scheduleReconnect(playerId, playerName, classId);
      };

      this.ws.onerror = (err) => {
        console.warn('[MultiplayerClient] WebSocket error:', err);
        this.ws?.close();
      };
    } catch (err) {
      console.warn('[MultiplayerClient] Connection failed:', err);
      this.scheduleReconnect(playerId, playerName, classId);
    }
  }

  private scheduleReconnect(playerId: string, playerName: string, classId: string): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(playerId, playerName, classId);
    }, 4000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', clientTime: performance.now() });
      }
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
  }

  private handlePacket(packet: any): void {
    switch (packet.type) {
      case 'handshake:ack': {
        this.onlineCount = packet.activePlayersCount || 1;
        this.serverTimeOffset = packet.serverTime - Date.now();
        this.emit('handshake', packet);
        if (Array.isArray(packet.peers)) {
          packet.peers.forEach((peer: PeerPlayerState) => {
            this.emit('player:joined', { player: peer });
          });
        }
        break;
      }

      case 'pong': {
        if (packet.clientTime) {
          this.pingMs = Math.round(performance.now() - packet.clientTime);
          timestampedInputBuffer.recordRttSample(this.pingMs, packet.serverTime);
          this.emit('ping', { pingMs: this.pingMs });
        }
        break;
      }

      case 'player:joined': {
        this.onlineCount++;
        this.emit('player:joined', packet);
        break;
      }

      case 'player:moved': {
        this.emit('player:moved', packet);
        break;
      }

      case 'player:left': {
        this.onlineCount = Math.max(1, this.onlineCount - 1);
        this.emit('player:left', packet);
        break;
      }

      case 'player:combat_action': {
        this.emit('player:combat_action', packet);
        break;
      }

      case 'chat:message': {
        this.emit('chat:message', packet);
        break;
      }
    }
  }

  /**
   * Throttled sync of local player position, animations, and stats (20Hz)
   */
  public syncLocalPlayer(state: {
    x: number;
    y: number;
    z: number;
    facingAngle: number;
    actionState: 'idle' | 'walk' | 'run' | 'attack' | 'cast' | 'hit';
    hp: number;
    maxHp: number;
    level: number;
    isMounted: boolean;
    activeWeaponType: string;
    equipment?: any;
    appearance?: any;
  }): void {
    this.pendingLocalSync = state;

    if (this.sendThrottleTimer === null) {
      this.sendThrottleTimer = window.setTimeout(() => {
        this.sendThrottleTimer = null;
        if (this.pendingLocalSync && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.sequenceNumber++;
          this.send({
            type: 'player:sync',
            sequence: this.sequenceNumber,
            ...this.pendingLocalSync,
          });
        }
      }, 50); // 20Hz update rate
    }
  }

  public sendCombatAction(action: {
    action: string;
    skillId?: string;
    targetMobId?: string;
    targetPos?: { x: number; y: number; z: number };
    damage?: number;
    isCrit?: boolean;
    color?: string;
  }): void {
    this.send({
      type: 'player:combat_action',
      ...action,
    });
  }

  public sendChatMessage(channel: string, text: string): void {
    this.send({
      type: 'player:chat',
      channel,
      text,
    });
  }

  public send(packet: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(packet));
    }
  }

  public on(event: string, handler: NetEventHandler): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  private emit(event: string, data: any): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((fn) => fn(data));
    }
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

export const multiplayerClient = MultiplayerClient.getInstance();
