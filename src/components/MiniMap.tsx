import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Compass,
  MapPin,
  Sparkles,
  Skull,
  Crosshair,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Layers,
  Eye,
  EyeOff,
  Navigation,
  Flag,
  X,
  Target,
  ShieldAlert,
} from 'lucide-react';
import {
  EnemySpawnPoint,
  MysticFlowerWell,
  NPCCharacter,
  PlayerStats,
  WorldMobEntity,
  WorldChunkData,
} from '../types';
import { MYSTIC_FLOWER_WELLS, ENEMY_SPAWN_POINTS } from '../data/mmorpgData';

export interface MiniMapProps {
  playerStats: PlayerStats;
  facingAngle?: number; // Player rotation angle in radians
  cameraYaw?: number;
  activeMobs?: WorldMobEntity[];
  npcs?: NPCCharacter[];
  chunks?: WorldChunkData[];
  onOpenFullMap?: () => void;
  className?: string;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerStats,
  facingAngle = 0,
  cameraYaw = 0,
  activeMobs = [],
  npcs = [],
  chunks = [],
  onOpenFullMap,
  className = '',
}) => {
  // Radar Radius (view distance in meters)
  const [radarRadius, setRadarRadius] = useState<number>(100); // 50m, 100m, 200m, 350m
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Filters
  const [showWells, setShowWells] = useState<boolean>(true);
  const [showEnemies, setShowEnemies] = useState<boolean>(true);
  const [showNpcs, setShowNpcs] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  // Waypoint / Selected POI
  const [customWaypoint, setCustomWaypoint] = useState<{ x: number; z: number; label: string } | null>(null);
  const [hoveredPoi, setHoveredPoi] = useState<{
    title: string;
    subTitle: string;
    distance: number;
    description?: string;
    buff?: string;
    type: 'well' | 'spawn' | 'mob' | 'npc' | 'waypoint';
    color: string;
  } | null>(null);

  const radarRef = useRef<HTMLDivElement>(null);

  // Compute nearby Mystic Flower Wells with distances
  const nearbyWells = useMemo(() => {
    return MYSTIC_FLOWER_WELLS.map((well) => {
      const dx = well.x - playerStats.x;
      const dz = well.z - playerStats.z;
      const dist = Math.hypot(dx, dz);
      return {
        ...well,
        dist,
        relX: dx,
        relZ: dz,
        inRadar: dist <= radarRadius,
      };
    }).sort((a, b) => a.dist - b.dist);
  }, [playerStats.x, playerStats.z, radarRadius]);

  // Compute nearby Enemy Spawn Points with distances
  const nearbySpawns = useMemo(() => {
    return ENEMY_SPAWN_POINTS.map((spawn) => {
      const dx = spawn.x - playerStats.x;
      const dz = spawn.z - playerStats.z;
      const dist = Math.hypot(dx, dz);
      return {
        ...spawn,
        dist,
        relX: dx,
        relZ: dz,
        inRadar: dist <= radarRadius,
      };
    }).sort((a, b) => a.dist - b.dist);
  }, [playerStats.x, playerStats.z, radarRadius]);

  // Compute nearby active mobs
  const nearbyActiveMobs = useMemo(() => {
    return activeMobs
      .map((mob) => {
        const dx = mob.x - playerStats.x;
        const dz = mob.z - playerStats.z;
        const dist = Math.hypot(dx, dz);
        return {
          ...mob,
          dist,
          relX: dx,
          relZ: dz,
          inRadar: dist <= radarRadius,
        };
      })
      .filter((m) => m.inRadar || m.isBoss);
  }, [activeMobs, playerStats.x, playerStats.z, radarRadius]);

  // Closest Mystic Flower Well for quick summary telemetry
  const closestWell = nearbyWells[0];
  const closestSpawn = nearbySpawns[0];

  // Helper to convert relative world offset (relX, relZ) to pixel offset within radar dial
  const dialSize = isExpanded ? 280 : 168; // Radar diameter in px
  const halfDial = dialSize / 2;

  const getDialCoords = (relX: number, relZ: number) => {
    // Standard map projection: +X is East (right), +Z is South (down)
    const factor = (halfDial - 16) / radarRadius;
    const px = halfDial + relX * factor;
    const py = halfDial + relZ * factor;

    // Distance from center for radar clamping
    const distFromCenter = Math.hypot(px - halfDial, py - halfDial);
    const maxRadius = halfDial - 12;

    if (distFromCenter > maxRadius) {
      const angle = Math.atan2(py - halfDial, px - halfDial);
      return {
        x: halfDial + Math.cos(angle) * maxRadius,
        y: halfDial + Math.sin(angle) * maxRadius,
        isClamped: true,
      };
    }

    return {
      x: px,
      y: py,
      isClamped: false,
    };
  };

  // Convert player facing angle to degrees for compass orientation chevron
  // In Three.js, facingAngle 0 is +Z (South), Math.PI/2 is +X (East), Math.PI is -Z (North), -Math.PI/2 is -X (West)
  const facingDeg = (facingAngle * 180) / Math.PI;

  const handleRadarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!radarRef.current) return;
    const rect = radarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - halfDial;
    const clickY = e.clientY - rect.top - halfDial;

    const factor = radarRadius / (halfDial - 16);
    const targetWorldX = Math.round(playerStats.x + clickX * factor);
    const targetWorldZ = Math.round(playerStats.z + clickY * factor);

    // If clicking close to existing waypoint, clear it, else set it
    if (customWaypoint && Math.hypot(customWaypoint.x - targetWorldX, customWaypoint.z - targetWorldZ) < 8) {
      setCustomWaypoint(null);
    } else {
      setCustomWaypoint({
        x: targetWorldX,
        z: targetWorldZ,
        label: `Signalpunkt [${targetWorldX}, ${targetWorldZ}]`,
      });
    }
  };

  return (
    <div
      id="aurion-minimap-container"
      className={`relative flex flex-col items-end pointer-events-auto select-none ${className}`}
    >
      {/* MiniMap Outer Steampunk Vessel */}
      <div
        className={`relative transition-all duration-200 backdrop-blur-xl bg-[#0a192f]/90 border border-[#b8860b]/60 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_15px_rgba(0,240,255,0.12)] p-2 flex flex-col ${
          isExpanded ? 'w-[320px]' : 'w-[200px] sm:w-[220px]'
        }`}
      >
        {/* Header Ribbon: Zone, Coordinates & Quick Toggles */}
        <div className="flex items-center justify-between pb-1.5 border-b border-gray-800 text-[10px] font-mono">
          <div className="flex items-center gap-1.5 truncate max-w-[140px] sm:max-w-[160px]">
            <Compass className="w-3.5 h-3.5 text-[#00f0ff] animate-spin-slow flex-shrink-0" />
            <span className="font-serif font-bold text-amber-200 truncate" title={playerStats.currentZone}>
              {playerStats.currentZone}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 rounded-md bg-black/60 border border-gray-800 hover:border-amber-400 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? 'Kompakte Ansicht' : 'Vergrößerte Taktik-Ansicht'}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-md bg-black/60 border border-gray-800 hover:border-amber-400 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title={isCollapsed ? 'Minimap ausklappen' : 'Minimap einklappen'}
            >
              {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* Live Telemetry Bar */}
            <div className="flex items-center justify-between py-1 text-[9px] font-mono text-gray-400 border-b border-gray-800/60">
              <span className="text-[#00f0ff] font-bold">
                X: {Math.round(playerStats.x)} <span className="text-gray-600">|</span> Z: {Math.round(playerStats.z)}
              </span>
              <span className="text-amber-400">Alt: {playerStats.y.toFixed(1)}m</span>
              <span className="text-cyan-300 font-bold">📡 {radarRadius}m</span>
            </div>

            {/* Radar Dial Canvas Area */}
            <div className="relative my-1.5 flex items-center justify-center">
              <div
                ref={radarRef}
                onClick={handleRadarClick}
                style={{ width: dialSize, height: dialSize }}
                className="relative rounded-full border-2 border-[#b8860b] bg-[#040d1a] shadow-[inset_0_0_20px_rgba(0,0,0,0.95)] overflow-hidden cursor-crosshair group"
              >
                {/* Background Compass Concentric Rings & Leyline Grid */}
                {showGrid && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                    {/* Concentric distance rings */}
                    <circle cx={halfDial} cy={halfDial} r={halfDial * 0.33} fill="none" stroke="#00f0ff" strokeWidth="0.75" strokeDasharray="3 3" />
                    <circle cx={halfDial} cy={halfDial} r={halfDial * 0.66} fill="none" stroke="#00f0ff" strokeWidth="0.75" strokeDasharray="3 3" />
                    <circle cx={halfDial} cy={halfDial} r={halfDial - 4} fill="none" stroke="#b8860b" strokeWidth="1" />

                    {/* Crosshair Cardinal Axes */}
                    <line x1={halfDial} y1={4} x2={halfDial} y2={dialSize - 4} stroke="#00f0ff" strokeWidth="0.6" strokeOpacity="0.5" />
                    <line x1={4} y1={halfDial} x2={dialSize - 4} y2={halfDial} stroke="#00f0ff" strokeWidth="0.6" strokeOpacity="0.5" />
                  </svg>
                )}

                {/* Radar Sweep Arc Animation */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(0, 240, 255, 0.15) 360deg)',
                    animation: 'spin 4s linear infinite',
                  }}
                />

                {/* Cardinal Marks (N, S, E, W) */}
                <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-serif font-bold text-amber-300 drop-shadow pointer-events-none">
                  N
                </span>
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-serif font-bold text-gray-400 drop-shadow pointer-events-none">
                  S
                </span>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-serif font-bold text-gray-400 drop-shadow pointer-events-none">
                  E
                </span>
                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-serif font-bold text-gray-400 drop-shadow pointer-events-none">
                  W
                </span>

                {/* 1. Mystic Flower Wells on Radar */}
                {showWells &&
                  nearbyWells.map((well) => {
                    const { x, y, isClamped } = getDialCoords(well.relX, well.relZ);
                    return (
                      <div
                        key={well.id}
                        style={{ left: x, top: y }}
                        onMouseEnter={() =>
                          setHoveredPoi({
                            title: well.name,
                            subTitle: well.germanName,
                            distance: Math.round(well.dist),
                            description: well.description,
                            buff: well.buffEffect,
                            type: 'well',
                            color: well.color,
                          })
                        }
                        onMouseLeave={() => setHoveredPoi(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomWaypoint({
                            x: well.x,
                            z: well.z,
                            label: well.name,
                          });
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer transition-transform hover:scale-150 ${
                          isClamped ? 'opacity-70' : 'opacity-100'
                        }`}
                        title={`${well.name} (${Math.round(well.dist)}m)`}
                      >
                        <div className="relative flex items-center justify-center">
                          {/* Pulsing aether bloom glow */}
                          <span
                            className="absolute w-5 h-5 rounded-full animate-ping opacity-60 pointer-events-none"
                            style={{ backgroundColor: well.color }}
                          />
                          <div
                            className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-[10px] shadow-[0_0_8px_rgba(0,240,255,0.8)] bg-black/90"
                            style={{ borderColor: well.color }}
                          >
                            <span>{well.icon}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {/* 2. Enemy Spawn Points on Radar */}
                {showEnemies &&
                  nearbySpawns.map((spawn) => {
                    const { x, y, isClamped } = getDialCoords(spawn.relX, spawn.relZ);
                    const isSkull = spawn.dangerLevel === 'skull';
                    const isHigh = spawn.dangerLevel === 'high';

                    return (
                      <div
                        key={spawn.id}
                        style={{ left: x, top: y }}
                        onMouseEnter={() =>
                          setHoveredPoi({
                            title: spawn.name,
                            subTitle: spawn.germanName,
                            distance: Math.round(spawn.dist),
                            description: `Gegnergruppe: ${spawn.mobName} · Empf. Stufe: Lv.${spawn.recommendedLevel}`,
                            type: 'spawn',
                            color: isSkull ? '#ef4444' : isHigh ? '#f97316' : '#eab308',
                          })
                        }
                        onMouseLeave={() => setHoveredPoi(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomWaypoint({
                            x: spawn.x,
                            z: spawn.z,
                            label: spawn.name,
                          });
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 z-15 cursor-pointer transition-transform hover:scale-150 ${
                          isClamped ? 'opacity-65' : 'opacity-100'
                        }`}
                        title={`${spawn.name} (${Math.round(spawn.dist)}m)`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${
                            isSkull
                              ? 'bg-purple-950/90 border-purple-500 text-purple-200 shadow-[0_0_6px_#9333ea]'
                              : isHigh
                              ? 'bg-red-950/90 border-red-500 text-red-200 shadow-[0_0_6px_#ef4444]'
                              : 'bg-amber-950/90 border-amber-500 text-amber-200 shadow-[0_0_6px_#f59e0b]'
                          }`}
                        >
                          <span>{spawn.icon}</span>
                        </div>
                      </div>
                    );
                  })}

                {/* 3. Live Active Mobs */}
                {showEnemies &&
                  nearbyActiveMobs.map((mob) => {
                    const { x, y } = getDialCoords(mob.relX, mob.relZ);
                    return (
                      <div
                        key={mob.id}
                        style={{ left: x, top: y }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none"
                        title={`${mob.name} (${Math.round(mob.dist)}m)`}
                      >
                        <div
                          className={`rounded-full ${
                            mob.isBoss
                              ? 'w-3 h-3 bg-red-500 border border-white animate-pulse shadow-[0_0_8px_#ef4444]'
                              : mob.isElite
                              ? 'w-2.5 h-2.5 bg-pink-500 border border-purple-300 shadow-[0_0_5px_#ec4899]'
                              : 'w-1.5 h-1.5 bg-amber-400 border border-black shadow'
                          }`}
                        />
                      </div>
                    );
                  })}

                {/* 4. NPCs on Radar */}
                {showNpcs &&
                  npcs.map((npc) => {
                    const dx = npc.x - playerStats.x;
                    const dz = npc.z - playerStats.z;
                    const dist = Math.hypot(dx, dz);
                    if (dist > radarRadius) return null;
                    const { x, y } = getDialCoords(dx, dz);

                    return (
                      <div
                        key={npc.id}
                        style={{ left: x, top: y }}
                        onMouseEnter={() =>
                          setHoveredPoi({
                            title: npc.name,
                            subTitle: npc.title,
                            distance: Math.round(dist),
                            description: `Rolle: ${npc.role.toUpperCase()} · Fraktion: ${npc.faction}`,
                            type: 'npc',
                            color: npc.color,
                          })
                        }
                        onMouseLeave={() => setHoveredPoi(null)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer hover:scale-150"
                        title={`${npc.name} (${Math.round(dist)}m)`}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 border border-black shadow-[0_0_5px_#00f0ff] flex items-center justify-center text-[7px] font-bold text-black">
                          !
                        </div>
                      </div>
                    );
                  })}

                {/* 5. Custom Destination Waypoint Beacon */}
                {customWaypoint && (
                  (() => {
                    const dx = customWaypoint.x - playerStats.x;
                    const dz = customWaypoint.z - playerStats.z;
                    const dist = Math.hypot(dx, dz);
                    const { x, y, isClamped } = getDialCoords(dx, dz);
                    return (
                      <div
                        style={{ left: x, top: y }}
                        onMouseEnter={() =>
                          setHoveredPoi({
                            title: customWaypoint.label,
                            subTitle: 'Benutzerdefinierter Zielpunkt',
                            distance: Math.round(dist),
                            description: 'Klicke erneut auf den Punkt, um das Signal aufzuheben.',
                            type: 'waypoint',
                            color: '#fbbf24',
                          })
                        }
                        onMouseLeave={() => setHoveredPoi(null)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer animate-bounce"
                      >
                        <div className="w-4 h-4 rounded-full bg-amber-400 border-2 border-white flex items-center justify-center shadow-[0_0_10px_#f59e0b] text-black">
                          <Flag className="w-2.5 h-2.5" />
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* 6. Center Player Entity & Directional Orientation Pointer */}
                <div
                  style={{ left: halfDial, top: halfDial }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none flex items-center justify-center"
                >
                  {/* Outer player glow pulse */}
                  <div className="w-4 h-4 rounded-full bg-[#00f0ff]/25 animate-ping absolute" />

                  {/* Character Icon Center Dot */}
                  <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-[#00f0ff] to-cyan-200 border border-white shadow-[0_0_10px_#00f0ff] z-10" />

                  {/* Articulated Directional Chevron / Sight Cone pointing in facingDeg */}
                  <div
                    style={{ transform: `rotate(${facingDeg}deg)` }}
                    className="absolute w-8 h-8 pointer-events-none flex items-center justify-center transition-transform duration-75"
                  >
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[9px] border-b-[#fbbf24] -translate-y-3.5 drop-shadow-[0_0_4px_#f59e0b]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Hovered POI Tooltip Card */}
            {hoveredPoi && (
              <div
                className="p-1.5 rounded-lg bg-black/95 border text-[9px] font-sans shadow-xl my-1 animate-in fade-in duration-100"
                style={{ borderColor: hoveredPoi.color }}
              >
                <div className="flex items-center justify-between font-bold">
                  <span style={{ color: hoveredPoi.color }}>{hoveredPoi.title}</span>
                  <span className="font-mono text-white text-[8px] bg-gray-800 px-1 py-0.2 rounded">
                    {hoveredPoi.distance}m
                  </span>
                </div>
                <div className="text-gray-300 text-[8.5px] italic">{hoveredPoi.subTitle}</div>
                {hoveredPoi.buff && (
                  <div className="text-emerald-300 text-[8px] mt-0.5 font-mono">✦ {hoveredPoi.buff}</div>
                )}
                {hoveredPoi.description && (
                  <div className="text-gray-400 text-[8px] mt-0.5 line-clamp-2">{hoveredPoi.description}</div>
                )}
              </div>
            )}

            {/* Quick Proximity Cards (Mystic Flower Wells & Spawns) */}
            <div className="flex flex-col gap-1 mt-1">
              {/* Closest Mystic Flower Well */}
              {closestWell && (
                <div
                  onClick={() => {
                    setCustomWaypoint({
                      x: closestWell.x,
                      z: closestWell.z,
                      label: closestWell.name,
                    });
                  }}
                  className="flex items-center justify-between p-1 rounded-lg bg-cyan-950/40 border border-cyan-500/40 hover:border-cyan-400 text-[8.5px] font-mono cursor-pointer transition-colors"
                  title="Klicken, um Navigationspunkt zum Brunnen zu setzen"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm">{closestWell.icon}</span>
                    <div className="truncate">
                      <div className="text-cyan-200 font-bold truncate">{closestWell.name}</div>
                      <div className="text-cyan-400/80 text-[7.5px] truncate">{closestWell.buffEffect}</div>
                    </div>
                  </div>
                  <span className="text-[#00f0ff] font-bold px-1 py-0.5 rounded bg-black/60 border border-cyan-900 flex-shrink-0">
                    {Math.round(closestWell.dist)}m
                  </span>
                </div>
              )}

              {/* Closest Enemy Spawn */}
              {closestSpawn && (
                <div
                  onClick={() => {
                    setCustomWaypoint({
                      x: closestSpawn.x,
                      z: closestSpawn.z,
                      label: closestSpawn.name,
                    });
                  }}
                  className="flex items-center justify-between p-1 rounded-lg bg-red-950/30 border border-red-500/40 hover:border-red-400 text-[8.5px] font-mono cursor-pointer transition-colors"
                  title="Klicken, um Gefahrenzone anzupeilen"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm">{closestSpawn.icon}</span>
                    <div className="truncate">
                      <div className="text-red-200 font-bold truncate">{closestSpawn.name}</div>
                      <div className="text-red-400/80 text-[7.5px] truncate">
                        {closestSpawn.mobName} · Stufe {closestSpawn.recommendedLevel}
                      </div>
                    </div>
                  </div>
                  <span className="text-amber-400 font-bold px-1 py-0.5 rounded bg-black/60 border border-red-900 flex-shrink-0">
                    {Math.round(closestSpawn.dist)}m
                  </span>
                </div>
              )}
            </div>

            {/* Radar Controls & Filter Toolbar */}
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-800 text-[9px]">
              {/* Radius Zoom Steps */}
              <div className="flex items-center gap-0.5 bg-black/80 rounded-md p-0.5 border border-gray-800">
                {[50, 100, 200, 350].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadarRadius(r)}
                    className={`px-1 py-0.5 rounded text-[8px] font-mono font-bold cursor-pointer transition-colors ${
                      radarRadius === r ? 'bg-[#00f0ff] text-black shadow' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {r}m
                  </button>
                ))}
              </div>

              {/* Category Filter Toggles */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowWells(!showWells)}
                  className={`p-1 rounded cursor-pointer transition-colors ${
                    showWells ? 'text-[#00f0ff] bg-cyan-950/60 border border-cyan-600' : 'text-gray-500 bg-black/60 border border-gray-800'
                  }`}
                  title={showWells ? 'Mystische Blumenbrunnen: Sichtbar' : 'Mystische Blumenbrunnen: Ausgeblendet'}
                >
                  <Sparkles className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setShowEnemies(!showEnemies)}
                  className={`p-1 rounded cursor-pointer transition-colors ${
                    showEnemies ? 'text-red-400 bg-red-950/60 border border-red-600' : 'text-gray-500 bg-black/60 border border-gray-800'
                  }`}
                  title={showEnemies ? 'Gegner-Spawns & Monster: Sichtbar' : 'Gegner-Spawns & Monster: Ausgeblendet'}
                >
                  <Skull className="w-3 h-3" />
                </button>
                {onOpenFullMap && (
                  <button
                    onClick={onOpenFullMap}
                    className="p-1 rounded bg-[#b8860b]/20 hover:bg-[#b8860b]/40 border border-[#b8860b] text-amber-300 hover:text-white cursor-pointer transition-colors"
                    title="Vollständigen Reichsatlas öffnen [M]"
                  >
                    <Layers className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
