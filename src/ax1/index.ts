/**
 * index.ts - AX1 Neutral Module Entry Point
 *
 * Exportiert den vollständigen Vertrag für AX1 vor der Aurion-Überführung:
 * - HostProjectionPort (100ms / 10Hz Tick, StateEnvelopes, CanonicalIntents, Mutations)
 * - SourceManifest (Komponenten-Hashes, SHA-256, Revisionsnachweis)
 * - PresentationPorts (bestätigte Präsentationsschnittstellen für Combat, DPS, Minimap, WorldHash)
 * - ContractTests (Invariantenprüfungen gegen Datenhalluzination)
 */

export * from './HostProjectionPort';
export * from './SourceManifest';
export * from './PresentationPorts';
export * from './ax1ContractTests';
