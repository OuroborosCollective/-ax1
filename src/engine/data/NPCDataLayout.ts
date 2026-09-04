/**
 * NPCDataLayout.ts
 *
 * Data-Oriented Design (DOD) Struct-of-Arrays (SoA) TypedArray Buffer for Autonomous NPCs.
 * Eliminates Garbage Collection (GC) pauses during high-frequency 20Hz ticks.
 * Contiguously packs spatial, needs, traits, and inventory data into linear memory.
 */

export const MAX_NPC_CAPACITY = 256;
export const MAX_COMMODITY_TYPES = 8;

export class NPCDataLayout {
  public capacity: number;
  public count: number = 0;

  // Spatial buffers: 6 floats per NPC [x, z, prevX, prevZ, targetX, targetZ]
  public spatialBuffer: Float32Array;

  // Needs & Stats: 6 floats per NPC [hunger, fatigue, hp, maxHp, wealthCopper, moveSpeed]
  public needsBuffer: Float32Array;

  // Genetic Traits: 4 floats per NPC [tradeProwess, harvestYield, combatGrit, frugality]
  public traitsBuffer: Float32Array;

  // States: 4 uint8 per NPC [macroState, subState, isAlive, generation]
  public statesBuffer: Uint8Array;

  // Inventory matrix: MAX_COMMODITY_TYPES uint16 per NPC
  public inventoryBuffer: Uint16Array;

  constructor(capacity: number = MAX_NPC_CAPACITY) {
    this.capacity = capacity;
    this.spatialBuffer = new Float32Array(capacity * 6);
    this.needsBuffer = new Float32Array(capacity * 6);
    this.traitsBuffer = new Float32Array(capacity * 4);
    this.statesBuffer = new Uint8Array(capacity * 4);
    this.inventoryBuffer = new Uint16Array(capacity * MAX_COMMODITY_TYPES);
  }

  // --- Spatial Accessors ---
  public setSpatial(
    idx: number,
    x: number,
    z: number,
    prevX: number,
    prevZ: number,
    targetX: number,
    targetZ: number
  ): void {
    const o = idx * 6;
    this.spatialBuffer[o] = x;
    this.spatialBuffer[o + 1] = z;
    this.spatialBuffer[o + 2] = prevX;
    this.spatialBuffer[o + 3] = prevZ;
    this.spatialBuffer[o + 4] = targetX;
    this.spatialBuffer[o + 5] = targetZ;
  }

  public getPositionX(idx: number): number {
    return this.spatialBuffer[idx * 6];
  }

  public getPositionZ(idx: number): number {
    return this.spatialBuffer[idx * 6 + 1];
  }

  public getPrevPositionX(idx: number): number {
    return this.spatialBuffer[idx * 6 + 2];
  }

  public getPrevPositionZ(idx: number): number {
    return this.spatialBuffer[idx * 6 + 3];
  }

  public setPosition(idx: number, x: number, z: number): void {
    const o = idx * 6;
    this.spatialBuffer[o] = x;
    this.spatialBuffer[o + 1] = z;
  }

  public setPrevPosition(idx: number, px: number, pz: number): void {
    const o = idx * 6;
    this.spatialBuffer[o + 2] = px;
    this.spatialBuffer[o + 3] = pz;
  }

  public setTarget(idx: number, tx: number, tz: number): void {
    const o = idx * 6;
    this.spatialBuffer[o + 4] = tx;
    this.spatialBuffer[o + 5] = tz;
  }

  public getTargetX(idx: number): number {
    return this.spatialBuffer[idx * 6 + 4];
  }

  public getTargetZ(idx: number): number {
    return this.spatialBuffer[idx * 6 + 5];
  }

  // --- Needs Accessors ---
  public setNeeds(
    idx: number,
    hunger: number,
    fatigue: number,
    hp: number,
    maxHp: number,
    wealthCopper: number,
    moveSpeed: number = 2.4
  ): void {
    const o = idx * 6;
    this.needsBuffer[o] = hunger;
    this.needsBuffer[o + 1] = fatigue;
    this.needsBuffer[o + 2] = hp;
    this.needsBuffer[o + 3] = maxHp;
    this.needsBuffer[o + 4] = wealthCopper;
    this.needsBuffer[o + 5] = moveSpeed;
  }

  public getHunger(idx: number): number {
    return this.needsBuffer[idx * 6];
  }

  public setHunger(idx: number, val: number): void {
    this.needsBuffer[idx * 6] = val;
  }

  public getFatigue(idx: number): number {
    return this.needsBuffer[idx * 6 + 1];
  }

  public setFatigue(idx: number, val: number): void {
    this.needsBuffer[idx * 6 + 1] = val;
  }

  public getHp(idx: number): number {
    return this.needsBuffer[idx * 6 + 2];
  }

  public setHp(idx: number, val: number): void {
    this.needsBuffer[idx * 6 + 2] = val;
  }

  public getWealthCopper(idx: number): number {
    return this.needsBuffer[idx * 6 + 4];
  }

  public setWealthCopper(idx: number, val: number): void {
    this.needsBuffer[idx * 6 + 4] = val;
  }

  public getMoveSpeed(idx: number): number {
    return this.needsBuffer[idx * 6 + 5];
  }

  // --- Traits Accessors ---
  public setTraits(
    idx: number,
    tradeProwess: number,
    harvestYield: number,
    combatGrit: number,
    frugality: number
  ): void {
    const o = idx * 4;
    this.traitsBuffer[o] = tradeProwess;
    this.traitsBuffer[o + 1] = harvestYield;
    this.traitsBuffer[o + 2] = combatGrit;
    this.traitsBuffer[o + 3] = frugality;
  }

  public getTradeProwess(idx: number): number {
    return this.traitsBuffer[idx * 4];
  }

  public getHarvestYield(idx: number): number {
    return this.traitsBuffer[idx * 4 + 1];
  }

  public getCombatGrit(idx: number): number {
    return this.traitsBuffer[idx * 4 + 2];
  }

  public getFrugality(idx: number): number {
    return this.traitsBuffer[idx * 4 + 3];
  }

  // --- States Accessors ---
  public setState(idx: number, macro: number, sub: number, alive: boolean, generation: number): void {
    const o = idx * 4;
    this.statesBuffer[o] = macro;
    this.statesBuffer[o + 1] = sub;
    this.statesBuffer[o + 2] = alive ? 1 : 0;
    this.statesBuffer[o + 3] = Math.min(255, generation);
  }

  public isAlive(idx: number): boolean {
    return this.statesBuffer[idx * 4 + 2] === 1;
  }

  public setAlive(idx: number, alive: boolean): void {
    this.statesBuffer[idx * 4 + 2] = alive ? 1 : 0;
  }

  public getMacroState(idx: number): number {
    return this.statesBuffer[idx * 4];
  }

  public setMacroState(idx: number, macro: number): void {
    this.statesBuffer[idx * 4] = macro;
  }

  public getSubState(idx: number): number {
    return this.statesBuffer[idx * 4 + 1];
  }

  public setSubState(idx: number, sub: number): void {
    this.statesBuffer[idx * 4 + 1] = sub;
  }

  public getGeneration(idx: number): number {
    return this.statesBuffer[idx * 4 + 3];
  }

  // --- Inventory Accessors ---
  public getItemCount(npcIdx: number, resourceId: number): number {
    if (resourceId < 0 || resourceId >= MAX_COMMODITY_TYPES) return 0;
    return this.inventoryBuffer[npcIdx * MAX_COMMODITY_TYPES + resourceId];
  }

  public setItemCount(npcIdx: number, resourceId: number, count: number): void {
    if (resourceId < 0 || resourceId >= MAX_COMMODITY_TYPES) return;
    this.inventoryBuffer[npcIdx * MAX_COMMODITY_TYPES + resourceId] = Math.max(0, Math.min(65535, count));
  }

  public addItemCount(npcIdx: number, resourceId: number, delta: number): void {
    const current = this.getItemCount(npcIdx, resourceId);
    this.setItemCount(npcIdx, resourceId, current + delta);
  }
}
