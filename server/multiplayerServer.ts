import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { writeBehindBuffer } from './writeBehindBuffer';

export interface NetworkPlayerState {
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
  lastUpdate: number;
  cellKey: string;
}

interface ClientSession {
  ws: WebSocket;
  playerId: string;
  state: NetworkPlayerState;
  isAlive: boolean;
  joinedAt: number;
}

export class MultiplayerServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientSession> = new Map();
  private aoiGrid: Map<string, Set<string>> = new Map(); // cellKey -> Set<playerId>
  private cellSize: number = 32.0; // 32x32m chunks for Area of Interest
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public attach(httpServer: HttpServer) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws/realm',
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // 15s Heartbeat to clean dead sockets
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, playerId) => {
        if (!client.isAlive) {
          console.log(`[MultiplayerServer] Terminating inactive socket for ${playerId}`);
          client.ws.terminate();
          this.handleDisconnect(playerId);
          return;
        }
        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 15000);

    console.log('[MultiplayerServer] Realtime WebSocket realm mounted at /ws/realm');
  }

  private getCellKey(x: number, z: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    return `${gx}:${gz}`;
  }

  private getNeighborCellKeys(x: number, z: number): string[] {
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    const keys: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        keys.push(`${gx + dx}:${gz + dz}`);
      }
    }
    return keys;
  }

  private updatePlayerCell(client: ClientSession, newX: number, newZ: number): void {
    const newCell = this.getCellKey(newX, newZ);
    if (client.state.cellKey !== newCell) {
      if (client.state.cellKey) {
        const oldSet = this.aoiGrid.get(client.state.cellKey);
        oldSet?.delete(client.playerId);
      }
      client.state.cellKey = newCell;
      let set = this.aoiGrid.get(newCell);
      if (!set) {
        set = new Set();
        this.aoiGrid.set(newCell, set);
      }
      set.add(client.playerId);
    }
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const url = new URL(req.url || '', 'http://localhost');
    const requestedId = url.searchParams.get('playerId') || `hero_${Math.random().toString(36).substring(2, 9)}`;
    const playerName = url.searchParams.get('name') || 'Aurion Wanderer';
    const classId = url.searchParams.get('classId') || 'knight';

    const initialCell = this.getCellKey(0, 0);
    const state: NetworkPlayerState = {
      id: requestedId,
      name: playerName,
      classId,
      level: 1,
      hp: 200,
      maxHp: 200,
      x: 0,
      y: 0,
      z: 8,
      facingAngle: 0,
      activeWeaponType: 'blade',
      isMounted: false,
      actionState: 'idle',
      lastUpdate: Date.now(),
      cellKey: initialCell,
    };

    const session: ClientSession = {
      ws,
      playerId: requestedId,
      state,
      isAlive: true,
      joinedAt: Date.now(),
    };

    this.clients.set(requestedId, session);
    this.updatePlayerCell(session, state.x, state.z);

    // Ping / Pong listener
    ws.on('pong', () => {
      session.isAlive = true;
    });

    // Send Welcome / Handshake message with all currently active players
    const activePeers = Array.from(this.clients.values())
      .filter((c) => c.playerId !== requestedId)
      .map((c) => c.state);

    this.send(ws, {
      type: 'handshake:ack',
      playerId: requestedId,
      activePlayersCount: this.clients.size,
      peers: activePeers,
      serverTime: Date.now(),
      worldEvent: 'Aurion Harmonic Convergence: Active',
    });

    // Broadcast new player joined to all other clients in interest range
    this.broadcastToNeighbors(state.x, state.z, {
      type: 'player:joined',
      player: state,
    }, requestedId);

    // Handle messages
    ws.on('message', (raw: string) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleMessage(session, msg);
      } catch (err) {
        console.warn('[MultiplayerServer] Malformed packet received:', err);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(requestedId);
    });

    ws.on('error', (err) => {
      console.warn(`[MultiplayerServer] Socket error for ${requestedId}:`, err);
      this.handleDisconnect(requestedId);
    });
  }

  private handleMessage(session: ClientSession, msg: any): void {
    const { playerId, state } = session;

    switch (msg.type) {
      case 'ping': {
        this.send(session.ws, { type: 'pong', clientTime: msg.clientTime, serverTime: Date.now() });
        break;
      }

      case 'player:sync': {
        // Full or partial state update
        if (msg.x !== undefined) state.x = msg.x;
        if (msg.y !== undefined) state.y = msg.y;
        if (msg.z !== undefined) state.z = msg.z;
        if (msg.facingAngle !== undefined) state.facingAngle = msg.facingAngle;
        if (msg.actionState) state.actionState = msg.actionState;
        if (msg.hp !== undefined) state.hp = msg.hp;
        if (msg.maxHp !== undefined) state.maxHp = msg.maxHp;
        if (msg.level !== undefined) state.level = msg.level;
        if (msg.activeWeaponType) state.activeWeaponType = msg.activeWeaponType;
        if (msg.isMounted !== undefined) state.isMounted = msg.isMounted;
        if (msg.equipment) state.equipment = msg.equipment;
        if (msg.appearance) state.appearance = msg.appearance;
        state.lastUpdate = Date.now();

        this.updatePlayerCell(session, state.x, state.z);

        // Broadcast delta to nearby neighbors in AoI
        this.broadcastToNeighbors(state.x, state.z, {
          type: 'player:moved',
          playerId,
          x: state.x,
          y: state.y,
          z: state.z,
          facingAngle: state.facingAngle,
          actionState: state.actionState,
          isMounted: state.isMounted,
          hp: state.hp,
          maxHp: state.maxHp,
          activeWeaponType: state.activeWeaponType,
          sequence: msg.sequence,
        }, playerId);

        // Queue in writeBehindBuffer
        writeBehindBuffer.queuePlayerSave(playerId, {
          name: state.name,
          classId: state.classId,
          position: { x: state.x, y: state.y, z: state.z },
          facingAngle: state.facingAngle,
          stats: { hp: state.hp, maxHp: state.maxHp, level: state.level, isMounted: state.isMounted, activeWeaponType: state.activeWeaponType },
          equipment: state.equipment,
          appearance: state.appearance,
        });
        break;
      }

      case 'player:combat_action': {
        // Player performed an attack, cast a skill, or launched a projectile
        this.broadcastToNeighbors(state.x, state.z, {
          type: 'player:combat_action',
          playerId,
          action: msg.action,
          skillId: msg.skillId,
          targetMobId: msg.targetMobId,
          targetPos: msg.targetPos,
          damage: msg.damage,
          isCrit: msg.isCrit,
          color: msg.color,
        }, playerId);
        break;
      }

      case 'player:chat': {
        // Real multiplayer chat
        const channel = msg.channel || 'realm';
        const packet = {
          type: 'chat:message',
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          channel,
          sender: state.name,
          playerId,
          text: String(msg.text || '').substring(0, 200),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        if (channel === 'say' || channel === 'combat') {
          this.broadcastToNeighbors(state.x, state.z, packet);
        } else {
          this.broadcastGlobal(packet);
        }
        break;
      }
    }
  }

  private handleDisconnect(playerId: string): void {
    const session = this.clients.get(playerId);
    if (!session) return;

    if (session.state.cellKey) {
      const set = this.aoiGrid.get(session.state.cellKey);
      set?.delete(playerId);
    }
    this.clients.delete(playerId);

    // Notify neighbors that player left
    this.broadcastToNeighbors(session.state.x, session.state.z, {
      type: 'player:left',
      playerId,
    });

    console.log(`[MultiplayerServer] Player disconnected: ${playerId}. Remaining online: ${this.clients.size}`);
  }

  private broadcastToNeighbors(x: number, z: number, packet: any, excludePlayerId?: string): void {
    const neighborCells = this.getNeighborCellKeys(x, z);
    const recipients = new Set<string>();

    for (const cell of neighborCells) {
      const set = this.aoiGrid.get(cell);
      if (set) {
        for (const pid of set) {
          if (pid !== excludePlayerId) {
            recipients.add(pid);
          }
        }
      }
    }

    const payload = JSON.stringify(packet);
    for (const pid of recipients) {
      const client = this.clients.get(pid);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private broadcastGlobal(packet: any): void {
    const payload = JSON.stringify(packet);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    });
  }

  private send(ws: WebSocket, packet: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(packet));
    }
  }

  public getOnlineCount(): number {
    return this.clients.size;
  }
}

export const multiplayerServer = new MultiplayerServer();
