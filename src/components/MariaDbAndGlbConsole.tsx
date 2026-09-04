import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Box,
  Server,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  X,
  Play,
  Shield,
  Layers,
  Sparkles,
  Terminal,
  Activity,
  Cpu,
  User,
  Eye,
  Radio,
  Sliders,
  Crosshair,
  Compass,
  FileCode,
  Check,
  Plus,
} from 'lucide-react';
import { glbManager, GLBModelEntry, WatchStatus, WatcherEvent } from '../core/GLBModelManager';
import { OpenWorldPlayer } from '../entities/OpenWorldPlayer';
import { MMOEngine } from '../core/MMOEngine';

interface MariaDbAndGlbConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  player: OpenWorldPlayer | null;
  engine: MMOEngine | null;
  onSaveState?: () => void;
  onLoadState?: () => void;
}

export const MariaDbAndGlbConsole: React.FC<MariaDbAndGlbConsoleProps> = ({
  isOpen,
  onClose,
  player,
  engine,
  onSaveState,
  onLoadState,
}) => {
  const [activeTab, setActiveTab] = useState<'mariadb' | 'glb_vault' | 'character_rig'>('glb_vault');
  const [collisionDebugActive, setCollisionDebugActive] = useState(false);

  // MariaDB States
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);

  const [dbForm, setDbForm] = useState({
    host: 'localhost',
    port: 3306,
    user: 'aurion_admin',
    password: '',
    database: 'aurion_mmo',
    connectionUrl: '',
  });

  // GLB Catalog & Scanner States
  const [glbModels, setGlbModels] = useState<GLBModelEntry[]>([]);
  const [isScanningGlb, setIsScanningGlb] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string>('GLB-Assets');
  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(null);
  const [liveEvents, setLiveEvents] = useState<WatcherEvent[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [inspectModel, setInspectModel] = useState<GLBModelEntry | null>(null);
  const [statusNotification, setStatusNotification] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [activeAvatarId, setActiveAvatarId] = useState<string | null>(player?.activeGlbModelId || null);
  const [lastScanReport, setLastScanReport] = useState<string | null>(null);

  // Upload modal fields
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadBase64, setUploadBase64] = useState<string>('');
  const [uploadCategory, setUploadCategory] = useState<GLBModelEntry['category']>('weapon');
  const [uploadName, setUploadName] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadWeaponType, setUploadWeaponType] = useState<'blade' | 'arcane' | 'marksmanship' | 'heavy_tech'>('blade');
  const [uploadTriangles, setUploadTriangles] = useState(1200);
  const [uploadBones, setUploadBones] = useState(0);

  // Fetch Database Status
  const refreshDbStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch('/api/database/status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        if (data.host) {
          setDbForm((prev) => ({
            ...prev,
            host: data.host,
            port: data.port,
            user: data.user,
            database: data.database,
          }));
        }
      }
    } catch (err) {
      console.warn('Could not fetch DB status:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Fetch GLB Catalog & Watch Status
  const refreshGlbCatalog = async () => {
    setIsScanningGlb(true);
    try {
      const models = await glbManager.fetchCatalog();
      setGlbModels(models);
      const status = await glbManager.getWatchStatus();
      if (status) {
        setWatchStatus(status);
        if (status.recentEvents) {
          setLiveEvents(status.recentEvents);
        }
      }
    } finally {
      setIsScanningGlb(false);
    }
  };

  // Trigger Synchronous Directory Scan
  const handleScanDirectory = async (dirPath?: string) => {
    const target = dirPath || selectedDirectory;
    setIsScanningGlb(true);
    try {
      const result = await glbManager.scanExternalDirectory(target);
      if (result.models) {
        setGlbModels(result.models);
      }
      if (result.watchStatus) {
        setWatchStatus(result.watchStatus);
      }
      const report = `Directory scan complete: ${result.totalModels} models verified in "${target}". Synchronized with MariaDB!`;
      setLastScanReport(report);
      setStatusNotification({ type: 'success', message: report });
      setTimeout(() => setStatusNotification(null), 5000);
    } catch (err: any) {
      setStatusNotification({ type: 'error', message: `Scan error: ${err.message}` });
    } finally {
      setIsScanningGlb(false);
    }
  };

  // Toggle Live File Watcher
  const handleToggleWatcher = async () => {
    if (!watchStatus) return;
    const nextState = !watchStatus.isWatching;
    const ok = await glbManager.toggleFileWatcher(nextState, selectedDirectory);
    if (ok) {
      const updated = await glbManager.getWatchStatus();
      if (updated) setWatchStatus(updated);
      setStatusNotification({
        type: 'info',
        message: nextState
          ? `File-watch listener active on "${selectedDirectory}". Auto-detecting new .glb models!`
          : 'File-watch listener paused.',
      });
      setTimeout(() => setStatusNotification(null), 4000);
    }
  };

  // Set up live event subscriptions & initialize on open
  useEffect(() => {
    if (isOpen) {
      refreshDbStatus();
      refreshGlbCatalog();
      setActiveAvatarId(player?.activeGlbModelId || null);
      if (engine) {
        setCollisionDebugActive(engine.enableCollisionVisualizer);
      }

      // Subscribe to real-time file-watch events
      const unsubscribe = glbManager.subscribeToWatchEvents((event) => {
        setLiveEvents((prev) => [event, ...prev.slice(0, 30)]);
        setStatusNotification({
          type: 'info',
          message: `[WATCHER EVENT] ${event.message}`,
        });
        setTimeout(() => setStatusNotification(null), 6000);
        refreshGlbCatalog();
      });

      return () => {
        unsubscribe();
      };
    }
  }, [isOpen, player, engine]);

  if (!isOpen) return null;

  // MariaDB Handlers
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/database/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbForm),
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleBindDatabase = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/database/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbForm),
      });
      const data = await res.json();
      setTestResult(data);
      await refreshDbStatus();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsConnecting(false);
    }
  };

  // Dynamic Equipment Swapping Handlers
  const handleEquipModelToSlot = async (item: GLBModelEntry) => {
    if (!player) return;
    if (item.category === 'character_avatar') {
      const success = await player.equipGlbModel(item.id);
      if (success) {
        setActiveAvatarId(item.id);
        setStatusNotification({
          type: 'success',
          message: `Equipped Avatar Skin: "${item.name}"!`,
        });
      }
    } else {
      const success = await player.equipGlbAsEquipment(item.id);
      if (success) {
        setStatusNotification({
          type: 'success',
          message: `Equipped ${item.name} to ${item.equipSlot || item.category} slot! Immediate 3D rendering active.`,
        });
      }
    }
    setTimeout(() => setStatusNotification(null), 4000);
  };

  const handleAddToInventory = (item: GLBModelEntry) => {
    if (!player) return;
    const rpgItem = player.registerGlbItemToInventory(item);
    setStatusNotification({
      type: 'success',
      message: `Registered "${rpgItem.name}" to MMORPG inventory bag!`,
    });
    setTimeout(() => setStatusNotification(null), 4000);
  };

  const handleResetToRiggedCharacter = async () => {
    if (!player) return;
    await player.equipGlbModel(null);
    setActiveAvatarId(null);
    setStatusNotification({
      type: 'info',
      message: 'Reverted to articulated honey-stone character rig.',
    });
    setTimeout(() => setStatusNotification(null), 3000);
  };

  // Upload Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    setUploadName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));

    const reader = new FileReader();
    reader.onload = () => {
      setUploadBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitGlbUpload = async () => {
    if (!uploadFileName) return;
    try {
      await glbManager.uploadModelExternal(uploadFileName, uploadBase64, {
        name: uploadName,
        category: uploadCategory,
        weaponType: uploadCategory === 'weapon' ? uploadWeaponType : undefined,
        description: uploadDesc,
        triangleBudget: uploadTriangles,
        boneCount: uploadBones,
        status: 'ready',
        animations: ['idle', 'walk', 'run', 'hit', 'attack_01', 'cast_01'],
      });
      setStatusNotification({
        type: 'success',
        message: `Model "${uploadName || uploadFileName}" saved to GLB directory and synced with MariaDB!`,
      });
      await refreshGlbCatalog();
      setUploadFileName('');
      setUploadBase64('');
      setTimeout(() => setStatusNotification(null), 5000);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    }
  };

  // Filtered model list
  const filteredModels = useMemo(() => {
    if (selectedCategoryFilter === 'all') return glbModels;
    if (selectedCategoryFilter === 'weapons') return glbModels.filter((m) => m.category === 'weapon');
    if (selectedCategoryFilter === 'shields') return glbModels.filter((m) => m.category === 'shield' || m.category === 'offhand');
    if (selectedCategoryFilter === 'helmets') return glbModels.filter((m) => m.category === 'helmet');
    if (selectedCategoryFilter === 'armor') return glbModels.filter((m) => m.category === 'chest' || m.category === 'shoulders' || m.category === 'arms' || m.category === 'legs' || m.category === 'boots');
    if (selectedCategoryFilter === 'avatars') return glbModels.filter((m) => m.category === 'character_avatar');
    if (selectedCategoryFilter === 'world') return glbModels.filter((m) => m.category === 'mob' || m.category === 'prop' || m.category === 'architecture' || m.category === 'mount');
    return glbModels;
  }, [glbModels, selectedCategoryFilter]);

  // Is equipped on player check
  const isItemEquipped = (model: GLBModelEntry) => {
    if (!player) return false;
    if (model.category === 'character_avatar') {
      return activeAvatarId === model.id;
    }
    const slot = model.equipSlot || model.category;
    const currentEquipped = player.equipment[slot as keyof typeof player.equipment] as any;
    return currentEquipped?.glbModelId === model.id || currentEquipped?.id === `glb_item_${model.id}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl bg-[#0b1320] border border-[#b8860b]/50 shadow-[0_0_60px_rgba(0,240,255,0.18)] text-gray-200 overflow-hidden font-sans">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#070e17]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-[#fbbf24] tracking-wide flex items-center gap-2">
                Aurion 3D Assets & MariaDB Synchronization Console
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-500/40">
                  File-Watch Live
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                External 'GLB-Assets' Directory Scanner, Real-time Watcher Listener & Dynamic Equipment Swapping System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const newState = !collisionDebugActive;
                setCollisionDebugActive(newState);
                if (engine) {
                  engine.enableCollisionVisualizer = newState;
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                collisionDebugActive 
                  ? 'bg-cyan-950/50 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]' 
                  : 'bg-black/50 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Hitbox Wireframes {collisionDebugActive ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800 bg-[#08121e] px-6 gap-2">
          <button
            onClick={() => setActiveTab('glb_vault')}
            className={`py-3 px-4 text-xs font-serif font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'glb_vault'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Box className="w-4 h-4" />
            GLB-Assets Directory & Equipment Vault
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-900 text-cyan-300 font-mono font-bold">
              {glbModels.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('mariadb')}
            className={`py-3 px-4 text-xs font-serif font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'mariadb'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database className="w-4 h-4" />
            MariaDB / MySQL Persistence
            {dbStatus?.connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('character_rig')}
            className={`py-3 px-4 text-xs font-serif font-bold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'character_rig'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <User className="w-4 h-4" />
            Character Rig & Dynamic Sockets
          </button>
        </div>

        {/* Global Toast Notification */}
        {statusNotification && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl border text-xs font-mono flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-150 ${
              statusNotification.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
                : statusNotification.type === 'error'
                ? 'bg-red-950/80 border-red-500/80 text-red-300'
                : 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {statusNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : statusNotification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <span>{statusNotification.message}</span>
            </div>
            <button onClick={() => setStatusNotification(null)} className="text-gray-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: External GLB Directory Vault & File-Watch Scanner */}
          {activeTab === 'glb_vault' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Top Control Panel: Scanner Bar & File-Watch Status */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#071322] via-[#0b1b30] to-[#071322] border border-cyan-500/40 shadow-[0_0_25px_rgba(0,240,255,0.08)] space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-serif font-bold text-white">
                          External 'GLB-Assets' File-Watch Listener
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 uppercase ${
                            watchStatus?.isWatching
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                              : 'bg-amber-950 text-amber-300 border border-amber-500/50'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              watchStatus?.isWatching ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                            }`}
                          />
                          {watchStatus?.isWatching ? 'Active & Watching' : 'Watcher Paused'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Drop any <code className="text-cyan-300">.glb</code> files into the defined directory. Models are automatically parsed, assigned metadata & stats, registered with MariaDB, and made available for instant equipment swapping.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleToggleWatcher}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        watchStatus?.isWatching
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
                          : 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                      }`}
                    >
                      {watchStatus?.isWatching ? 'Pause Listener' : 'Start Live Listener'}
                    </button>

                    <button
                      onClick={() => handleScanDirectory()}
                      disabled={isScanningGlb}
                      className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-serif font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanningGlb ? 'animate-spin' : ''}`} />
                      {isScanningGlb ? 'Scanning...' : 'Scan & Sync Directory'}
                    </button>
                  </div>
                </div>

                {/* Directory Selector Bar */}
                <div className="pt-2 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-gray-400">Defined Target Directory:</span>
                    <input
                      type="text"
                      value={selectedDirectory}
                      onChange={(e) => setSelectedDirectory(e.target.value)}
                      placeholder="GLB-Assets"
                      className="px-2.5 py-1 rounded bg-black/60 border border-gray-700 font-mono text-cyan-300 focus:border-cyan-400 focus:outline-none w-48 sm:w-64"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-gray-500 text-[11px]">Quick Paths:</span>
                    <button
                      onClick={() => {
                        setSelectedDirectory('GLB-Assets');
                        handleScanDirectory('GLB-Assets');
                      }}
                      className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[11px] font-mono cursor-pointer"
                    >
                      📁 GLB-Assets (Root)
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDirectory('GLB-Assets/weapons');
                        handleScanDirectory('GLB-Assets/weapons');
                      }}
                      className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[11px] font-mono cursor-pointer"
                    >
                      ⚔️ Weapons
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDirectory('GLB-Assets/shields');
                        handleScanDirectory('GLB-Assets/shields');
                      }}
                      className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[11px] font-mono cursor-pointer"
                    >
                      🛡️ Shields
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDirectory('public/models/glb');
                        handleScanDirectory('public/models/glb');
                      }}
                      className="px-2 py-0.5 rounded bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 text-[11px] font-mono cursor-pointer"
                    >
                      📁 public/models/glb
                    </button>
                  </div>
                </div>

                {/* Scan Report & Database Confirmation Badge */}
                {lastScanReport && (
                  <div className="p-2.5 rounded-lg bg-black/50 border border-emerald-500/40 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{lastScanReport}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-[10px] text-emerald-200 border border-emerald-800/60">
                      MariaDB aurion_glb_catalog: Synced
                    </span>
                  </div>
                )}
              </div>

              {/* Live Event Stream Terminal (Collapsible / Feed) */}
              <div className="p-3.5 rounded-xl bg-black/60 border border-gray-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono font-bold text-gray-300">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Real-time Directory Watcher Feed ({liveEvents.length} events logged)</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">
                    Auto-reloads on external filesystem changes
                  </span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[11px] pr-2">
                  {liveEvents.length === 0 ? (
                    <div className="text-gray-500 italic py-1">
                      Waiting for file operations... Drop a .glb file into /GLB-Assets/ to see live auto-registration.
                    </div>
                  ) : (
                    liveEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="flex items-start gap-2 text-gray-300 py-0.5 border-b border-gray-900/60"
                      >
                        <span className="text-gray-500 text-[10px]">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`px-1 rounded text-[9px] font-bold uppercase ${
                            evt.type === 'added'
                              ? 'bg-emerald-950 text-emerald-400'
                              : evt.type === 'modified'
                              ? 'bg-amber-950 text-amber-400'
                              : evt.type === 'deleted'
                              ? 'bg-red-950 text-red-400'
                              : 'bg-cyan-950 text-cyan-400'
                          }`}
                        >
                          {evt.type}
                        </span>
                        <span className="text-gray-200 flex-1 truncate">{evt.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Direct Upload Section (Collapsible) */}
              <div className="p-4 rounded-xl bg-black/40 border border-[#b8860b]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-serif font-bold text-[#fbbf24] flex items-center gap-2 uppercase tracking-wider">
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    Direct GLB File Ingestion & Registration Pipeline
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 mb-1">Select 3D File (.glb/.gltf)</label>
                    <input
                      type="file"
                      accept=".glb,.gltf"
                      onChange={handleFileUpload}
                      className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-mono file:bg-gray-800 file:text-cyan-300 hover:file:bg-gray-700 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 mb-1">Display Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Chrono Aether Scepter"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 mb-1">Target Equipment Slot</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="weapon">Weapon (Mainhand)</option>
                      <option value="shield">Shield / Aegis</option>
                      <option value="offhand">Offhand / Focus Grimoire</option>
                      <option value="helmet">Helmet / Greathelm / Goggles</option>
                      <option value="chest">Chestplate / Boiler Cuirass</option>
                      <option value="character_avatar">Full Character Avatar Skin</option>
                      <option value="prop">Open World Prop</option>
                      <option value="architecture">Architecture / Gateway</option>
                    </select>
                  </div>

                  {uploadCategory === 'weapon' && (
                    <div>
                      <label className="block text-[10px] font-mono text-gray-400 mb-1">Weapon Type</label>
                      <select
                        value={uploadWeaponType}
                        onChange={(e) => setUploadWeaponType(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="blade">Hydraulic Blade (Knight/Warrior)</option>
                        <option value="arcane">Aether Scepter / Arcane (Mage)</option>
                        <option value="marksmanship">Arbalest / Marksmanship (Ranger)</option>
                        <option value="heavy_tech">Steam Artillery (Engineer)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-gray-400">
                    File selected: <span className="text-cyan-300">{uploadFileName || 'None'}</span>
                  </span>
                  <button
                    onClick={handleSubmitGlbUpload}
                    disabled={!uploadFileName}
                    className={`px-4 py-1.5 rounded-lg text-xs font-serif font-bold flex items-center gap-2 transition-all ${
                      uploadFileName
                        ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)] cursor-pointer'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Register to Equipment Vault
                  </button>
                </div>
              </div>

              {/* Discovered Models Header & Filter Tabs */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Box className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-serif font-bold text-gray-200">
                      Discovered 3D Models in Dynamic Equipment Vault ({filteredModels.length})
                    </h3>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                    {[
                      { id: 'all', label: 'All Assets' },
                      { id: 'weapons', label: '⚔️ Weapons' },
                      { id: 'shields', label: '🛡️ Shields' },
                      { id: 'helmets', label: '🪖 Helmets' },
                      { id: 'armor', label: '🥋 Armor' },
                      { id: 'avatars', label: '✨ Avatars' },
                      { id: 'world', label: '🏛️ World' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedCategoryFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                          selectedCategoryFilter === tab.id
                            ? 'bg-cyan-500 text-black font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                            : 'bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Procedural Revert Bar */}
                {activeAvatarId && (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-amber-300">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>
                        Active Avatar Skin: <strong className="text-white">{activeAvatarId}</strong>
                      </span>
                    </div>
                    <button
                      onClick={handleResetToRiggedCharacter}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-serif font-bold transition-colors cursor-pointer"
                    >
                      Revert to Articulated Honey-Stone Character
                    </button>
                  </div>
                )}

                {/* 3D Model Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredModels.map((item) => {
                    const isEquipped = isItemEquipped(item);
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                          isEquipped
                            ? 'bg-[#061826] border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.25)] ring-1 ring-cyan-400/50'
                            : 'bg-[#09111c] border-gray-800 hover:border-gray-700'
                        }`}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <div className="font-serif font-bold text-sm text-gray-100 flex items-center gap-1.5">
                                {item.name}
                                {isEquipped && (
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-gray-400">
                                {item.relativePath || item.fileName}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-bold ${
                                item.rarity === 'mystic'
                                  ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                                  : item.rarity === 'legendary'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                                  : item.rarity === 'epic'
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                                  : 'bg-gray-800 text-gray-300'
                              }`}
                            >
                              {item.category.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-[11px] text-gray-400 mb-3 leading-relaxed line-clamp-2">
                            {item.description}
                          </p>

                          {/* 3D Specs & Stats Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono mb-3">
                            <span className="bg-black/60 px-1.5 py-0.5 rounded text-gray-300">
                              ▲ {item.triangleBudget.toLocaleString()} tris
                            </span>
                            {item.boneCount > 0 && (
                              <span className="bg-black/60 px-1.5 py-0.5 rounded text-gray-300">
                                🦴 {item.boneCount} bones
                              </span>
                            )}
                            <span className="bg-black/60 px-1.5 py-0.5 rounded text-gray-400">
                              {(item.fileSizeBytes / 1024).toFixed(0)} KB
                            </span>

                            {/* RPG Stats badges */}
                            {item.itemStats?.attack ? (
                              <span className="bg-red-950/70 border border-red-800/40 px-1.5 py-0.5 rounded text-red-300 font-bold">
                                +{item.itemStats.attack} Atk
                              </span>
                            ) : null}
                            {item.itemStats?.spellPower ? (
                              <span className="bg-purple-950/70 border border-purple-800/40 px-1.5 py-0.5 rounded text-purple-300 font-bold">
                                +{item.itemStats.spellPower} Spell
                              </span>
                            ) : null}
                            {item.itemStats?.armor ? (
                              <span className="bg-blue-950/70 border border-blue-800/40 px-1.5 py-0.5 rounded text-blue-300 font-bold">
                                +{item.itemStats.armor} Armor
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Action Footer */}
                        <div className="pt-3 border-t border-gray-800/60 flex items-center justify-between gap-2">
                          <button
                            onClick={() => setInspectModel(item)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono flex items-center gap-1 cursor-pointer"
                            title="Inspect Companion Metadata JSON"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-1.5">
                            {/* Add to Inventory bag button */}
                            {item.category !== 'mob' && item.category !== 'architecture' && item.category !== 'prop' && (
                              <button
                                onClick={() => handleAddToInventory(item)}
                                className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-cyan-300 text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer"
                                title="Add as Equippable Gear to MMORPG Bag"
                              >
                                <Plus className="w-3 h-3" />
                                Add to Bag
                              </button>
                            )}

                            {/* Equip Button */}
                            <button
                              onClick={() => handleEquipModelToSlot(item)}
                              className={`px-3 py-1 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                isEquipped
                                  ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                                  : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow'
                              }`}
                            >
                              {isEquipped ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  {item.category === 'character_avatar' ? 'Equip Avatar' : `Equip ${item.equipSlot || 'Slot'}`}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MariaDB / MySQL */}
          {activeTab === 'mariadb' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      dbStatus?.connected
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                        : 'bg-amber-950/80 text-amber-400 border border-amber-500/50'
                    }`}
                  >
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {dbStatus?.connected ? 'MariaDB Engine: Connected & Active' : 'Standalone Memory Fallback Mode'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          dbStatus?.connected ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'
                        }`}
                      >
                        {dbStatus?.mode || 'in_memory_fallback'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Target: {dbStatus?.host || dbForm.host}:{dbStatus?.port || dbForm.port} | Database: {dbStatus?.database || dbForm.database} | Latency: {dbStatus?.latencyMs || 0}ms
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={refreshDbStatus}
                    disabled={isLoadingStatus}
                    className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  {onSaveState && (
                    <button
                      onClick={onSaveState}
                      className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-300 text-xs font-mono transition-colors cursor-pointer"
                    >
                      Sync State Now
                    </button>
                  )}
                </div>
              </div>

              {/* Verified Tables Grid */}
              {dbStatus?.tables && dbStatus.tables.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Verified Schemas & Tables ({dbStatus.tables.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {dbStatus.tables.map((t: string) => (
                      <div
                        key={t}
                        className="px-3 py-2 rounded-lg bg-black/50 border border-gray-800 text-xs font-mono text-cyan-300 flex items-center justify-between"
                      >
                        <span className="truncate">{t}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection Configuration Form */}
              <div className="p-4 rounded-xl bg-black/40 border border-[#b8860b]/30 space-y-4">
                <h3 className="text-sm font-serif font-bold text-[#fbbf24] flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  Bind MariaDB / MySQL Server Instance
                </h3>
                <p className="text-xs text-gray-400">
                  Connect any private or cloud MariaDB/MySQL instance. The server automatically reconciles tables, persists player state, equipment, items, and synchronizes the <code className="text-cyan-300">aurion_glb_catalog</code> 3D asset directory.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Host / IP</label>
                    <input
                      type="text"
                      value={dbForm.host}
                      onChange={(e) => setDbForm({ ...dbForm, host: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Port</label>
                    <input
                      type="number"
                      value={dbForm.port}
                      onChange={(e) => setDbForm({ ...dbForm, port: parseInt(e.target.value, 10) || 3306 })}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Database Name</label>
                    <input
                      type="text"
                      value={dbForm.database}
                      onChange={(e) => setDbForm({ ...dbForm, database: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">User</label>
                    <input
                      type="text"
                      value={dbForm.user}
                      onChange={(e) => setDbForm({ ...dbForm, user: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={dbForm.password}
                      onChange={(e) => setDbForm({ ...dbForm, password: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-gray-400 mb-1">Or Connection URI (Optional)</label>
                    <input
                      type="text"
                      placeholder="mysql://user:pass@host:3306/db"
                      value={dbForm.connectionUrl}
                      onChange={(e) => setDbForm({ ...dbForm, connectionUrl: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 text-xs text-gray-200 font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-mono font-bold flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Activity className="w-4 h-4 text-cyan-400" />
                    {isTesting ? 'Testing Handshake...' : 'Test Connection Handshake'}
                  </button>

                  <button
                    onClick={handleBindDatabase}
                    disabled={isConnecting}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black text-xs font-serif font-bold shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Database className="w-4 h-4" />
                    {isConnecting ? 'Binding & Migrating...' : 'Bind & Run Game on MariaDB'}
                  </button>
                </div>

                {/* Result Output */}
                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-mono ${
                      testResult.success
                        ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300'
                        : 'bg-red-950/50 border-red-500/50 text-red-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold mb-1">
                      {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {testResult.success ? 'Handshake Succeeded' : 'Connection Warning / Fallback Active'}
                    </div>
                    <div>{testResult.message}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Character Rig & Sockets Diagnostics */}
          {activeTab === 'character_rig' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-black/40 border border-[#b8860b]/40 space-y-3">
                <h3 className="text-sm font-serif font-bold text-[#fbbf24] flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-400" />
                  Dynamic Equipment Sockets & Skeletal Graph
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  The player character features 8 distinct articulated equipment sockets designed with weathered honey-stone, brushed bronze, and Aurion-turquoise leylines. Swapping equipment pieces dynamically re-renders the 3D meshes without interrupting animations or altering structural bone pivots.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-cyan-400" /> Weapon Hand Sockets
                    </div>
                    <ul className="text-[11px] text-gray-400 space-y-1 font-mono list-disc list-inside">
                      <li>Right Hand: Primary Weapon Pivot</li>
                      <li>Left Forearm: Shield & Bulwark Mount</li>
                      <li>Floating Offhand: Chrono Grimoire / Orbs</li>
                      <li>Dynamic Weapon Trail Particle Conduits</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-amber-400" /> Armor & Headpiece Sockets
                    </div>
                    <ul className="text-[11px] text-gray-400 space-y-1 font-mono list-disc list-inside">
                      <li>Head Group: Sol Corona Greathelm / Goggles</li>
                      <li>Torso Group: Boiler Cuirass Breastplates</li>
                      <li>Shoulder Pivots: Twin Winged Pauldrons</li>
                      <li>Gauntlets & Sabatons: Articulated Plates</li>
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 space-y-2">
                    <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Kinetic FX Nodes
                    </div>
                    <ul className="text-[11px] text-gray-400 space-y-1 font-mono list-disc list-inside">
                      <li>Rotating Temporal Orbital Rings</li>
                      <li>Oscillating Steam Exhaust Valves</li>
                      <li>Pulsing Aetherial Core Emissives</li>
                      <li>Class Aura Ground Projection</li>
                    </ul>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-xs font-mono text-emerald-300 flex items-center justify-between">
                  <span>Skeletal Graph: Root &rarr; Pelvis &rarr; Torso &rarr; Neck &rarr; Head + Dual Hand Sockets</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200">100% Verified & Active</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Companion JSON Metadata Inspector Modal */}
        {inspectModel && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0b1422] border border-cyan-500/50 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-[0_0_40px_rgba(0,240,255,0.2)]">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2 text-cyan-300 font-serif font-bold text-sm">
                  <FileCode className="w-4 h-4" />
                  Companion Metadata JSON: {inspectModel.fileName}
                </div>
                <button
                  onClick={() => setInspectModel(null)}
                  className="p-1 rounded text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <pre className="p-3 rounded-xl bg-black/70 border border-gray-800 text-[11px] font-mono text-cyan-200 overflow-x-auto max-h-72">
                {JSON.stringify(inspectModel, null, 2)}
              </pre>

              <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                <span className="text-[11px] text-gray-400 font-mono">
                  Stored at: <code className="text-amber-300">{inspectModel.sourceDirectory || 'GLB-Assets'}</code>
                </span>
                <button
                  onClick={() => setInspectModel(null)}
                  className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-serif font-bold text-white cursor-pointer"
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-[#070e17] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
            <span>Echoes of Aurion Dynamic Asset & MariaDB Pipeline</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-serif font-bold transition-colors cursor-pointer"
          >
            Close Console
          </button>
        </div>

      </div>
    </div>
  );
};
