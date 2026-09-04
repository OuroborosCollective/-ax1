/**
 * HierarchicalPathfinding.ts
 *
 * 2-Tier Hierarchical Pathfinding Architecture (HPA*) for Echoes of Aurion:
 * - Macro-Graph: Pre-computed topological highway network connecting trade hubs, bridges, and gates.
 * - Micro-Level: High-speed local A* with raycast string-pulling (via NavGrid).
 * - Road Surface Speed Multipliers: Enhances caravan velocities when staying on Starpaths and stone thoroughfares.
 */

import { navGrid, Waypoint } from './NavGrid';

export interface MacroNode {
  id: string;
  name: string;
  x: number;
  z: number;
  region: string;
  isTradeHub: boolean;
  connectedEdgeIds: string[];
}

export interface MacroEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  cost: number;
  roadType: 'starpath' | 'stone_highway' | 'dirt_trail' | 'wilderness';
  waypoints: Waypoint[];
}

export class HierarchicalPathfinding {
  private static instance: HierarchicalPathfinding | null = null;
  public nodes: Map<string, MacroNode> = new Map();
  public edges: Map<string, MacroEdge> = new Map();

  public static getInstance(): HierarchicalPathfinding {
    if (!HierarchicalPathfinding.instance) {
      HierarchicalPathfinding.instance = new HierarchicalPathfinding();
    }
    return HierarchicalPathfinding.instance;
  }

  constructor() {
    this.buildTopologicalHighwayNetwork();
  }

  /**
   * Constructs the Aurion Highway & Trade Route Network
   */
  private buildTopologicalHighwayNetwork(): void {
    // 1. Define Major Territorial Nodes
    const macroNodes: Omit<MacroNode, 'connectedEdgeIds'>[] = [
      { id: 'sun_spire', name: 'Sun-Spire Citadel', x: 0, z: 0, region: 'Citadel Core', isTradeHub: true },
      { id: 'starpath_crossing', name: 'Sternenweg-Kreuzung', x: -22, z: 28, region: 'Windhollow Pass', isTradeHub: false },
      { id: 'windhollow_market', name: 'Windhain Marktplatz', x: -55, z: 65, region: 'Windhollow Meadows', isTradeHub: true },
      { id: 'farmland_junction', name: 'Emberfall Acker-Kreuzung', x: 32, z: 42, region: 'Emberfall Outskirts', isTradeHub: false },
      { id: 'emberfall_foundry', name: 'Emberfall Schmelze', x: 75, z: -40, region: 'Emberfall Terraces', isTradeHub: true },
      { id: 'garden_parcels', name: 'Gartenparzellen Oase', x: 48, z: 18, region: 'Emberfall Terraces', isTradeHub: false },
      { id: 'aschengewoelbe_gate', name: 'Aschengewölbe Portal', x: -80, z: -70, region: 'Aschengewölbe Ruins', isTradeHub: true },
      { id: 'south_watchtower', name: 'Süd-Wachturm', x: -45, z: -35, region: 'Borderland', isTradeHub: false },
    ];

    for (const n of macroNodes) {
      this.nodes.set(n.id, { ...n, connectedEdgeIds: [] });
    }

    // 2. Define Bi-directional Highway Edges with Intermediate Waypoints
    const edgeDefs: Array<{
      from: string;
      to: string;
      roadType: 'starpath' | 'stone_highway' | 'dirt_trail' | 'wilderness';
      waypoints?: Waypoint[];
    }> = [
      // Sun-Spire to Starpath Crossing
      {
        from: 'sun_spire',
        to: 'starpath_crossing',
        roadType: 'starpath',
        waypoints: [{ x: -10, z: 12 }, { x: -22, z: 28 }],
      },
      // Starpath Crossing to Windhollow Market
      {
        from: 'starpath_crossing',
        to: 'windhollow_market',
        roadType: 'starpath',
        waypoints: [{ x: -38, z: 48 }, { x: -55, z: 65 }],
      },
      // Sun-Spire to Farmland Junction
      {
        from: 'sun_spire',
        to: 'farmland_junction',
        roadType: 'stone_highway',
        waypoints: [{ x: 16, z: 20 }, { x: 32, z: 42 }],
      },
      // Farmland Junction to Emberfall Foundry
      {
        from: 'farmland_junction',
        to: 'emberfall_foundry',
        roadType: 'dirt_trail',
        waypoints: [{ x: 52, z: 10 }, { x: 75, z: -40 }],
      },
      // Sun-Spire to Garden Parcels
      {
        from: 'sun_spire',
        to: 'garden_parcels',
        roadType: 'dirt_trail',
        waypoints: [{ x: 24, z: 8 }, { x: 48, z: 18 }],
      },
      // Garden Parcels to Emberfall Foundry
      {
        from: 'garden_parcels',
        to: 'emberfall_foundry',
        roadType: 'dirt_trail',
        waypoints: [{ x: 62, z: -10 }, { x: 75, z: -40 }],
      },
      // Sun-Spire to South Watchtower
      {
        from: 'sun_spire',
        to: 'south_watchtower',
        roadType: 'stone_highway',
        waypoints: [{ x: -20, z: -18 }, { x: -45, z: -35 }],
      },
      // South Watchtower to Aschengewölbe Gate
      {
        from: 'south_watchtower',
        to: 'aschengewoelbe_gate',
        roadType: 'wilderness',
        waypoints: [{ x: -62, z: -52 }, { x: -80, z: -70 }],
      },
      // Starpath Crossing to South Watchtower (Connector)
      {
        from: 'starpath_crossing',
        to: 'south_watchtower',
        roadType: 'dirt_trail',
        waypoints: [{ x: -34, z: -5 }, { x: -45, z: -35 }],
      },
    ];

    for (const def of edgeDefs) {
      const fromNode = this.nodes.get(def.from);
      const toNode = this.nodes.get(def.to);
      if (!fromNode || !toNode) continue;

      const directDist = Math.hypot(toNode.x - fromNode.x, toNode.z - fromNode.z);
      const speedModifier = def.roadType === 'starpath' ? 0.7 : def.roadType === 'stone_highway' ? 0.8 : 1.0;
      const cost = directDist * speedModifier;

      const edgeIdFwd = `${def.from}_to_${def.to}`;
      const edgeFwd: MacroEdge = {
        id: edgeIdFwd,
        fromNodeId: def.from,
        toNodeId: def.to,
        cost,
        roadType: def.roadType,
        waypoints: def.waypoints || [{ x: toNode.x, z: toNode.z }],
      };
      this.edges.set(edgeIdFwd, edgeFwd);
      fromNode.connectedEdgeIds.push(edgeIdFwd);

      // Bi-directional reverse edge
      const edgeIdRev = `${def.to}_to_${def.from}`;
      const revWaypoints = [...(def.waypoints || [{ x: toNode.x, z: toNode.z }])].reverse();
      const edgeRev: MacroEdge = {
        id: edgeIdRev,
        fromNodeId: def.to,
        toNodeId: def.from,
        cost,
        roadType: def.roadType,
        waypoints: revWaypoints,
      };
      this.edges.set(edgeIdRev, edgeRev);
      toNode.connectedEdgeIds.push(edgeIdRev);
    }
  }

  /**
   * Finds the closest topological macro-node to any arbitrary 3D position
   */
  public getNearestMacroNode(x: number, z: number): MacroNode {
    let nearest: MacroNode | null = null;
    let minDist = Infinity;

    for (const node of this.nodes.values()) {
      const d = Math.hypot(node.x - x, node.z - z);
      if (d < minDist) {
        minDist = d;
        nearest = node;
      }
    }

    return nearest || Array.from(this.nodes.values())[0];
  }

  /**
   * Solves topological A* on the macro-graph between two macro nodes
   */
  public findMacroRoute(startNodeId: string, goalNodeId: string): MacroNode[] {
    if (startNodeId === goalNodeId) {
      const node = this.nodes.get(startNodeId);
      return node ? [node] : [];
    }

    const openSet = new Set<string>([startNodeId]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    gScore.set(startNodeId, 0);

    const goalNode = this.nodes.get(goalNodeId);
    if (!goalNode) return [];

    const startNode = this.nodes.get(startNodeId);
    if (startNode) {
      fScore.set(startNodeId, Math.hypot(goalNode.x - startNode.x, goalNode.z - startNode.z));
    }

    while (openSet.size > 0) {
      let current: string | null = null;
      let lowestF = Infinity;

      for (const nodeId of openSet) {
        const f = fScore.get(nodeId) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = nodeId;
        }
      }

      if (!current) break;

      if (current === goalNodeId) {
        const path: MacroNode[] = [];
        let curr: string | undefined = current;
        while (curr) {
          const n = this.nodes.get(curr);
          if (n) path.unshift(n);
          curr = cameFrom.get(curr);
        }
        return path;
      }

      openSet.delete(current);
      const currNode = this.nodes.get(current);
      if (!currNode) continue;

      for (const edgeId of currNode.connectedEdgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) continue;

        const neighborId = edge.toNodeId;
        const tentativeG = (gScore.get(current) ?? Infinity) + edge.cost;

        if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
          cameFrom.set(neighborId, current);
          gScore.set(neighborId, tentativeG);
          const neighborNode = this.nodes.get(neighborId);
          const h = neighborNode ? Math.hypot(goalNode.x - neighborNode.x, goalNode.z - neighborNode.z) : 0;
          fScore.set(neighborId, tentativeG + h);
          openSet.add(neighborId);
        }
      }
    }

    return [];
  }

  /**
   * Master 2-Tier Hierarchical Path Query:
   * 1. If distance is short (< 35m), uses high-res NavGrid micro-path immediately.
   * 2. If long distance (> 35m), navigates to nearest highway node, follows macro corridor, then paths to exact goal.
   */
  public computeHierarchicalPath(
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number
  ): Waypoint[] {
    const directDist = Math.hypot(goalX - startX, goalZ - startZ);

    // Short-range query -> Direct Micro A*
    if (directDist <= 35.0) {
      return navGrid.findPath(startX, startZ, goalX, goalZ);
    }

    // Long-range query -> HPA* Macro Corridor
    const startMacro = this.getNearestMacroNode(startX, startZ);
    const goalMacro = this.getNearestMacroNode(goalX, goalZ);

    if (startMacro.id === goalMacro.id) {
      return navGrid.findPath(startX, startZ, goalX, goalZ);
    }

    const macroPath = this.findMacroRoute(startMacro.id, goalMacro.id);
    if (macroPath.length < 2) {
      return navGrid.findPath(startX, startZ, goalX, goalZ);
    }

    // Assemble comprehensive composite waypoint corridor
    const compositeWaypoints: Waypoint[] = [];

    // 1. First leg: Start to First Macro Node
    const initialLeg = navGrid.findPath(startX, startZ, macroPath[0].x, macroPath[0].z);
    compositeWaypoints.push(...initialLeg);

    // 2. Highway corridor
    for (let i = 0; i < macroPath.length - 1; i++) {
      const from = macroPath[i].id;
      const to = macroPath[i + 1].id;
      const edge = this.edges.get(`${from}_to_${to}`);
      if (edge && edge.waypoints.length > 0) {
        compositeWaypoints.push(...edge.waypoints);
      } else {
        compositeWaypoints.push({ x: macroPath[i + 1].x, z: macroPath[i + 1].z });
      }
    }

    // 3. Final leg: Last Macro Node to Goal
    const lastNode = macroPath[macroPath.length - 1];
    const finalLeg = navGrid.findPath(lastNode.x, lastNode.z, goalX, goalZ);
    compositeWaypoints.push(...finalLeg);

    return compositeWaypoints;
  }
}

export const hierarchicalPathfinding = HierarchicalPathfinding.getInstance();
