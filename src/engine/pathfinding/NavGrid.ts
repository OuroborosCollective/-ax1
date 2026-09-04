import { collisionSystem } from '../../world/WorldCollisionSystem';

export interface Waypoint {
  x: number;
  z: number;
}

interface Node {
  gx: number;
  gz: number;
  x: number;
  z: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
  walkable: boolean;
}

/**
 * NavGrid
 * Obstacle-aware A* Pathfinding Grid with Line-of-Sight Path Smoothing.
 * Prevents mobs from walking through solid rocks, trees, towers, and walls.
 */
export class NavGrid {
  private static instance: NavGrid | null = null;
  public nodeSize: number = 1.5; // 1.5m per grid node
  private safetyMargin: number = 0.8;

  public static getInstance(): NavGrid {
    if (!NavGrid.instance) {
      NavGrid.instance = new NavGrid();
    }
    return NavGrid.instance;
  }

  /**
   * Tests whether a straight line between (x0, z0) and (x1, z1) is clear of obstacles.
   */
  public hasLineOfSight(x0: number, z0: number, x1: number, z1: number, agentRadius: number = 0.6): boolean {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(dist / 0.8));
    const dx = (x1 - x0) / steps;
    const dz = (z1 - z0) / steps;

    for (let i = 0; i <= steps; i++) {
      const cx = x0 + dx * i;
      const cz = z0 + dz * i;
      const nearby = collisionSystem.getNearbyObstacles(cx, cz, agentRadius + 0.2);
      for (const obs of nearby) {
        const d = Math.hypot(cx - obs.x, cz - obs.z);
        if (d < obs.radius + agentRadius) {
          return false; // Line of sight blocked by obstacle
        }
      }
    }
    return true;
  }

  /**
   * High performance A* pathfinding between start and goal
   */
  public findPath(
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number,
    maxSearchRadius: number = 32.0
  ): Waypoint[] {
    // If direct line of sight is open, return direct line immediately!
    if (this.hasLineOfSight(startX, startZ, goalX, goalZ)) {
      return [{ x: goalX, z: goalZ }];
    }

    const distToGoal = Math.hypot(goalX - startX, goalZ - startZ);
    if (distToGoal > maxSearchRadius * 1.5) {
      // Too far, clamp search towards goal
      const angle = Math.atan2(goalX - startX, goalZ - startZ);
      return [{ x: startX + Math.sin(angle) * 3.0, z: startZ + Math.cos(angle) * 3.0 }];
    }

    const startGx = Math.round(startX / this.nodeSize);
    const startGz = Math.round(startZ / this.nodeSize);
    const goalGx = Math.round(goalX / this.nodeSize);
    const goalGz = Math.round(goalZ / this.nodeSize);

    const openSet = new Map<string, Node>();
    const closedSet = new Set<string>();

    const getKey = (gx: number, gz: number) => `${gx}:${gz}`;

    const isWalkable = (gx: number, gz: number): boolean => {
      const wx = gx * this.nodeSize;
      const wz = gz * this.nodeSize;
      const obstacles = collisionSystem.getNearbyObstacles(wx, wz, this.nodeSize + this.safetyMargin);
      for (const obs of obstacles) {
        if (Math.hypot(wx - obs.x, wz - obs.z) < obs.radius + this.safetyMargin) {
          return false;
        }
      }
      return true;
    };

    const startNode: Node = {
      gx: startGx,
      gz: startGz,
      x: startX,
      z: startZ,
      g: 0,
      h: Math.hypot(goalGx - startGx, goalGz - startGz),
      f: Math.hypot(goalGx - startGx, goalGz - startGz),
      parent: null,
      walkable: true,
    };

    openSet.set(getKey(startGx, startGz), startNode);

    let iterations = 0;
    const maxIterations = 200; // Hard limit for 60fps performance
    let closestNode = startNode;

    const neighbors = [
      { dx: 1, dz: 0, cost: 1.0 },
      { dx: -1, dz: 0, cost: 1.0 },
      { dx: 0, dz: 1, cost: 1.0 },
      { dx: 0, dz: -1, cost: 1.0 },
      { dx: 1, dz: 1, cost: 1.414 },
      { dx: -1, dz: 1, cost: 1.414 },
      { dx: 1, dz: -1, cost: 1.414 },
      { dx: -1, dz: -1, cost: 1.414 },
    ];

    while (openSet.size > 0 && iterations++ < maxIterations) {
      // Find node with lowest f
      let current: Node | null = null;
      openSet.forEach((node) => {
        if (!current || node.f < current.f) {
          current = node;
        }
      });

      if (!current) break;
      const currentKey = getKey((current as Node).gx, (current as Node).gz);

      if ((current as Node).h < closestNode.h) {
        closestNode = current;
      }

      // Reached goal
      if ((current as Node).gx === goalGx && (current as Node).gz === goalGz) {
        return this.reconstructAndSmoothPath(current, startX, startZ, goalX, goalZ);
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      for (const n of neighbors) {
        const ngx = (current as Node).gx + n.dx;
        const ngz = (current as Node).gz + n.dz;
        const nKey = getKey(ngx, ngz);

        if (closedSet.has(nKey)) continue;

        if (!isWalkable(ngx, ngz)) {
          closedSet.add(nKey);
          continue;
        }

        const tentativeG = (current as Node).g + n.cost;
        let neighborNode = openSet.get(nKey);

        if (!neighborNode) {
          const h = Math.hypot(goalGx - ngx, goalGz - ngz);
          neighborNode = {
            gx: ngx,
            gz: ngz,
            x: ngx * this.nodeSize,
            z: ngz * this.nodeSize,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
            walkable: true,
          };
          openSet.set(nKey, neighborNode);
        } else if (tentativeG < neighborNode.g) {
          neighborNode.g = tentativeG;
          neighborNode.f = tentativeG + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }

    // If goal couldn't be reached in time, path to the closest node reached
    return this.reconstructAndSmoothPath(closestNode, startX, startZ, goalX, goalZ);
  }

  /**
   * Reconstructs raw A* node chain and applies string-pulling (Raycast smoothing)
   */
  private reconstructAndSmoothPath(
    endNode: Node,
    startX: number,
    startZ: number,
    goalX: number,
    goalZ: number
  ): Waypoint[] {
    const rawPath: Waypoint[] = [];
    let curr: Node | null = endNode;
    while (curr && curr.parent) {
      rawPath.push({ x: curr.x, z: curr.z });
      curr = curr.parent;
    }
    rawPath.reverse();

    if (rawPath.length === 0) {
      return [{ x: goalX, z: goalZ }];
    }

    // Path smoothing (string pulling)
    const smoothed: Waypoint[] = [];
    let currentPos = { x: startX, z: startZ };
    let i = 0;

    while (i < rawPath.length) {
      // Find furthest waypoint visible from currentPos
      let furthest = i;
      for (let j = rawPath.length - 1; j >= i; j--) {
        if (this.hasLineOfSight(currentPos.x, currentPos.z, rawPath[j].x, rawPath[j].z)) {
          furthest = j;
          break;
        }
      }
      smoothed.push(rawPath[furthest]);
      currentPos = rawPath[furthest];
      i = furthest + 1;
    }

    return smoothed;
  }
}

export const navGrid = NavGrid.getInstance();
