/**
 * SpatialHashGrid
 * High-performance 2D/3D spatial partitioning grid.
 * Replaces O(N^2) brute-force entity queries with O(1) cell lookups.
 */

export interface SpatialEntity {
  id: string;
  x: number;
  z: number;
  radius: number;
  type?: string;
  data?: any;
}

export class SpatialHashGrid<T extends SpatialEntity = SpatialEntity> {
  private cellSize: number;
  private cells: Map<string, Set<string>> = new Map();
  private entities: Map<string, T> = new Map();
  private entityCells: Map<string, Set<string>> = new Map();

  constructor(cellSize: number = 16.0) {
    this.cellSize = cellSize;
  }

  private hash(x: number, z: number): string {
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    return `${gx}:${gz}`;
  }

  private getOverlappingCellKeys(x: number, z: number, radius: number): string[] {
    const minGx = Math.floor((x - radius) / this.cellSize);
    const maxGx = Math.floor((x + radius) / this.cellSize);
    const minGz = Math.floor((z - radius) / this.cellSize);
    const maxGz = Math.floor((z + radius) / this.cellSize);

    const keys: string[] = [];
    for (let gx = minGx; gx <= maxGx; gx++) {
      for (let gz = minGz; gz <= maxGz; gz++) {
        keys.push(`${gx}:${gz}`);
      }
    }
    return keys;
  }

  public insert(entity: T): void {
    this.remove(entity.id);
    this.entities.set(entity.id, entity);

    const cellKeys = this.getOverlappingCellKeys(entity.x, entity.z, entity.radius);
    const cellSet = new Set<string>();

    for (const key of cellKeys) {
      cellSet.add(key);
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = new Set();
        this.cells.set(key, bucket);
      }
      bucket.add(entity.id);
    }

    this.entityCells.set(entity.id, cellSet);
  }

  public update(id: string, newX: number, newZ: number, newRadius?: number): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    entity.x = newX;
    entity.z = newZ;
    if (newRadius !== undefined) entity.radius = newRadius;

    // Recalculate cells
    const oldCells = this.entityCells.get(id);
    const newCellKeys = this.getOverlappingCellKeys(entity.x, entity.z, entity.radius);
    const newCellSet = new Set(newCellKeys);

    // Remove from unneeded old cells
    if (oldCells) {
      for (const cellKey of oldCells) {
        if (!newCellSet.has(cellKey)) {
          const bucket = this.cells.get(cellKey);
          bucket?.delete(id);
          if (bucket && bucket.size === 0) {
            this.cells.delete(cellKey);
          }
        }
      }
    }

    // Add to newly entered cells
    for (const cellKey of newCellKeys) {
      if (!oldCells || !oldCells.has(cellKey)) {
        let bucket = this.cells.get(cellKey);
        if (!bucket) {
          bucket = new Set();
          this.cells.set(cellKey, bucket);
        }
        bucket.add(id);
      }
    }

    this.entityCells.set(id, newCellSet);
  }

  public remove(id: string): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    const cellKeys = this.entityCells.get(id);
    if (cellKeys) {
      for (const key of cellKeys) {
        const bucket = this.cells.get(key);
        bucket?.delete(id);
        if (bucket && bucket.size === 0) {
          this.cells.delete(key);
        }
      }
      this.entityCells.delete(id);
    }
    this.entities.delete(id);
  }

  public queryRadius(x: number, z: number, radius: number): T[] {
    const cellKeys = this.getOverlappingCellKeys(x, z, radius);
    const candidateIds = new Set<string>();

    for (const key of cellKeys) {
      const bucket = this.cells.get(key);
      if (bucket) {
        for (const id of bucket) {
          candidateIds.add(id);
        }
      }
    }

    const r2 = radius * radius;
    const results: T[] = [];

    for (const id of candidateIds) {
      const entity = this.entities.get(id);
      if (!entity) continue;

      const dx = entity.x - x;
      const dz = entity.z - z;
      const maxDist = radius + entity.radius;
      if (dx * dx + dz * dz <= maxDist * maxDist) {
        results.push(entity);
      }
    }

    return results;
  }

  public get(id: string): T | undefined {
    return this.entities.get(id);
  }

  public size(): number {
    return this.entities.size;
  }

  public clear(): void {
    this.cells.clear();
    this.entities.clear();
    this.entityCells.clear();
  }
}
