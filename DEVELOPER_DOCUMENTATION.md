# Echoes of Aurion — Entwickler- & Systemdokumentation
**Version:** 1.4.0 • **Architektur:** Client-Server Hybrid (React 18 + Three.js + Node.js / Express + MariaDB)  
**Zielgruppe:** Entwickler, Software-Architekten und Systemintegratoren

---

## Inhaltsverzeichnis
1. [Systemübersicht & High-Level Architektur](#1-systemübersicht--high-level-architektur)
2. [Das Spiel-System (Game Core Engine)](#2-das-spiel-system-game-core-engine)
   - 2.1 Game Loop & Tick-Architektur
   - 2.2 Charakter-Steuerung, Physics & Isometric Camera
   - 2.3 Kampfsystem (Near-Miss, Combos & Weapon Masteries)
   - 2.4 World Chunking (120.000+ m² Streaming & Territorien)
3. [Das Item- & Equipment-System](#3-das-item--equipment-system)
   - 3.1 8-Slot Ausrüstungs-Pipeline
   - 3.2 Stat-Berechnung, Skalierung & Seltenheitsstufen
   - 3.3 Hybrid-Visuals (Deterministische Procedural-Shader & GLB-Swapping)
4. [Das GLB- & 3D-Asset-System](#4-das-glb--3d-asset-system)
   - 4.1 Asset-Katalog, Server-Streaming & Dynamic Endpoints
   - 4.2 `GLBModelManager` & `ItemGlbRegistry`
   - 4.3 Rigging-, Animations- & Performance-Budgets (Triangle Caps)
   - 4.4 Socket-Mapping & Mirrored Pair Transforms
5. [Nahtlose System-Integration & Verheiratung](#5-nahtlose-system-integration--verheiratung)
   - 5.1 Architektur-Bridge & Microservice-Kopplung
   - 5.2 REST API Contracts & Payload-Spezifikationen
   - 5.3 Event-Bus & State-Synchronisation
6. [MariaDB Datenbank-Anbindung & Konfiguration](#6-mariadb-datenbank-anbindung--konfiguration)
   - 6.1 Verbindungsaufbau & Umgebungsvariablen
   - 6.2 Connection Pool & Ausfallsicherer In-Memory-Fallback
   - 6.3 Schemamigrationen & Tabellenstruktur
   - 6.4 Verifikations-Script & Health-Checks

---

## 1. Systemübersicht & High-Level Architektur

Echoes of Aurion ist als modular entkoppelte, hochperformante 3D Action-MMORPG-Architektur konzipiert. Sie kombiniert WebGL/Three.js-Rendering mit einem zustandslosen/zustandsorientierten Node.js-Backend und einer relationalen MariaDB-Persistenz.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (Browser)                         │
│  ┌─────────────────────────┐ ┌───────────────────┐ ┌──────────────────┐  │
│  │   Three.js 3D Canvas    │ │  React UI Overlay │ │ Audio & Particle │  │
│  │  (GLB / Procedural PBR) │ │  (HUD, Inventory) │ │    Engine FX     │  │
│  └────────────┬────────────┘ └─────────┬─────────┘ └────────┬─────────┘  │
│               │                        │                    │            │
│  ┌────────────┴────────────────────────┴────────────────────┴─────────┐  │
│  │               GameEngine Core (Character / World / Loop)           │  │
│  │       ItemGlbRegistry  ◄──►  GLBModelManager  ◄──►  StateBus       │  │
│  └─────────────────────────────────────┬──────────────────────────────┘  │
└────────────────────────────────────────┼────────────────────────────────┘
                                         │ HTTPS / REST / JSON Stream
┌────────────────────────────────────────┼────────────────────────────────┐
│                         BACKEND SERVICE LAYER                           │
│  ┌─────────────────────────────────────┴──────────────────────────────┐  │
│  │                    Express REST API Router                         │  │
│  │    /api/player/*  •  /api/glb/*  •  /api/world/*  •  /api/mariadb  │  │
│  └────────────┬────────────────────────┬────────────────────┬─────────┘  │
│               │                        │                    │            │
│  ┌────────────┴────────────┐ ┌─────────┴─────────┐ ┌────────┴─────────┐  │
│  │      glbRegistry        │ │   Gemini AI World │ │   MariaDBService │  │
│  │ (Asset Catalog & Seeds) │ │   Dungeon Master  │ │  (Pool / Schema) │  │
│  └─────────────────────────┘ └───────────────────┘ └────────┬─────────┘  │
└─────────────────────────────────────────────────────────────┼──────────┘
                                                              │ SQL (TCP 3306)
┌─────────────────────────────────────────────────────────────┴──────────┐
│                         PERSISTENCE LAYER (MariaDB)                    │
│   aurion_players • aurion_equipment • aurion_inventory • aurion_chunks │
│   aurion_quests  • aurion_glb_catalog • aurion_world_state • audit_log │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Das Spiel-System (Game Core Engine)

### 2.1 Game Loop & Tick-Architektur
Die Core-Loop ist in `src/core/GameEngine.ts` gekapselt und arbeitet mit festen sowie variablen Delta-Zeiten (`dt`):
- **Grafik-Loop (`requestAnimationFrame`)**: Rendert die Three.js-Szene, interpoliert Mesh-Positionen, rotiert Aether-Partikel und berechnet Kamera-Damping.
- **Logik-Tick (60 Hz)**: Führt Kollisionsprüfungen, Near-Miss-Erkennungen, Abklingzeiten (Cooldown-Ticks), Ressourcenregeneration (Mana/Dampf) und Wegfindungsvektoren aus.
- **Save-Tick (Autosave)**: Asynchrones Debouncing zur Entlastung des Backends; überträgt Zustandsänderungen nur bei signifikantem Delta oder alle 30 Sekunden.

### 2.2 Charakter-Steuerung & 3/4 Isometrische Kamera
- **Perspektive**: Fester Dreiviertel-isometrischer Winkel (Offset: `[X: 14, Y: 20, Z: 18]` relativ zum Spieler), weich gedämpft mittels Lerp-Algorithmus:
  ```ts
  camera.position.lerp(targetCameraPos, 0.08);
  camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
  ```
- **Input-Handling**: Unterstützt WASD, Pfeiltasten, Gamepad API und Touch-Virtual-Stick auf mobilen Endgeräten.
- **Terrain-Raycasting**: Die Spielerhöhe (`Y`) passt sich dynamisch an Geländehöhen an (`Math.sin`-Wavefront + Chunk-Höhenmaps).

### 2.3 Kampfsystem: Near-Miss & Weapon Masteries
1. **Near-Miss-Mechanik**: Passiert ein gegnerisches Geschoss den Spieler im Abstand von $0.5 \text{m} \le d \le 1.8 \text{m}$ ohne Treffer, triggert das System ein `Near-Miss`-Event:
   - +15 % temporärer Bewegungsgeschwindigkeits-Buff
   - Aufladung der Leyline-Ressource
   - Erhöhung des Kombo-Multiplikators
2. **Klassen & Weapon Types**:
   - `blade` (Nahkampf / Ritter): Hohe Rüstungsskalierung, Physischer Spalt-Angriff.
   - `arcane` (Magier): Hoher Elementarschaden, Teleport-Blink, Manahaushalt.
   - `marksmanship` (Waldläufer): Hohe Crit-Chance, Fernkampf-Trajektorien.
   - `heavy_tech` (Ingenieur): Dampfdruck-Mechaniken, Geschütztürme, Hydraulik-Stöße.

### 2.4 World Chunking & Territoriale Politik
- Die Welt ist in **$32 \times 32\,\text{m}$ Chunks** unterteilt ($4 \times 4\,\text{m}$ Sub-Tiles).
- Das System streamt Chunks basierend auf der Spielerposition $(C_X, C_Z)$ in einem 3×3 Grid.
- Jeder Chunk besitzt einen Eintrag in `aurion_world_chunks` und `aurion_chunk_politics`, welcher Gildenbesitz, Steuersätze und Händlerbestände verwaltet.

---

## 3. Das Item- & Equipment-System

### 3.1 Die 8 Ausrüstungs-Slots
Das Spiel nutzt ein rigides 8-Slot-Ausrüstungsschema:

| Slot-Key | Deutsche Bezeichnung | Dreidimensionale Anbindung / Sockets |
| :--- | :--- | :--- |
| `head` / `helmet` | Kopfschutz / Helm | `head_socket` (Root: Kopfknochen) |
| `shoulders` | Schulterstücke / Pauldrons | `shoulder_L_socket` & `shoulder_R_socket` (gespiegelt) |
| `chest` | Brustpanzer / Gambeson | `chest_socket` / Torso-Deformation |
| `arms` | Armschienen / Handschuhe | `forearm_L_socket` & `forearm_R_socket` |
| `legs` | Beinschützer / Hosen | `thigh_L` & `thigh_R` / Unterleib |
| `feet` / `boots` | Stiefel / Sabatons | `foot_L_socket` & `foot_R_socket` |
| `weapon` | Haupthand-Waffe | `weapon_R_socket` (Waffenhand) |
| `shield` / `offhand` | Schild / Zauberfokus | `shield_L_socket` (Schildhand / Orbit-Anker) |

### 3.2 Stat-Berechnung & Rarity Tiers
Die Gesamt-Attribute des Spielers werden additiv und multiplikativ in `calculateTotalStats()` zusammengesetzt:

$$\text{FinalAttack} = (\text{BaseStrength} \times 2.5 + \sum \text{ItemAttack}) \times (1 + \text{MasteryBonus})$$

**Rarity Tiers & Farbcodierung:**
- `common` (`#94a3b8`): Basiswerte ohne Affixe.
- `uncommon` (`#22c55e`): 1 zusätzlicher Stat-Bonus.
- `rare` (`#3b82f6`): 2 Affixe + Partikeleffekt-Trigger.
- `epic` (`#a855f7`): 3 Affixe + animierte Zahnrad-/Dampf-Materialien.
- `legendary` (`#f59e0b`): 4 Affixe + Leyline-Leuchteffekte.
- `mystic` (`#00f0ff`): Aurion-Türkis-Aura, orbitierende Aetherscherben.

### 3.3 Hybrid-Visual Pipeline
Um null Ladezeiten (Zero-Latency) bei gleichzeitig höchster grafischer Qualität zu garantieren, nutzt das Item-System eine zweistufige Pipeline:
1. **Procedural Fallback Generator (`ProceduralEquipmentVisuals.ts`)**: Erzeugt sofort aus mathematischen Primitiven (Zylinder, Fasen, Boxen) und PBR-Materialien (Brushed Bronze, Damascus Steel, Weathered Stone) das sichtbare Rüstungsteil.
2. **GLB Model Swapper (`GLBModelManager.ts`)**: Lädt asynchron das optimierte 3D-Modell aus dem Katalog und ersetzt die prozedurale Geometrie nahtlos im Szenengraphen.

---

## 4. Das GLB- & 3D-Asset-System

### 4.1 Asset-Katalog & Server-Streaming
Alle 3D-Modelle werden in zwei synchronisierten Verzeichnissen verwaltet:
- `/GLB-Assets/<category>/<asset-id>.glb`
- `/public/models/glb/<asset-id>.glb`

**Dynamic Server Endpoint (`server.ts`):**
Sollte ein Asset noch nicht auf der Festplatte vorliegen, generiert der Server on-the-fly eine valide, spezifikationskonforme GLTF-2.0-Binärstruktur mit PBR-Material (`model/gltf-binary`), sodass der Browser **niemals** auf 404-HTML-Fehlerseiten (`<!doctype...`) stößt.

```ts
app.get(['/glb-assets/*', '/models/glb/*'], (req, res) => {
  const modelName = path.basename(req.path, '.glb');
  const buffer = createMinimalGLB(modelName, 0.0, 0.94, 1.0);
  res.setHeader('Content-Type', 'model/gltf-binary');
  res.send(buffer);
});
```

### 4.2 GLBModelManager & ItemGlbRegistry
- **`ItemGlbRegistry.ts`**: Enthält die statische und dynamische Zuordnungstabelle zwischen Item-IDs (z. B. `aurion-sunblade`) und 3D-GLB-URLs, Skalierungsfaktoren, Rotations-Offsets und Partikel-Ankern.
- **`GLBModelManager.ts`**: Verwaltet den Three.js `GLTFLoader`, instanziiert Caches, führt Material-Klone durch und überwacht VRAM-Freigaben (`dispose()` von Geometrien und Texturen beim Ablegen).

### 4.3 Rigging-, Animations- & Performance-Budgets
Zur Einhaltung stabiler 60 FPS auch auf mobilen Endgeräten gelten strenge Budgets:

| Asset-Typ | Max. Triangles (Dreiecke) | Bones / Skelett | Textur-Atlas | Standard-Clips |
| :--- | :--- | :--- | :--- | :--- |
| **Einhandwaffe / Schild** | $\le 500$ | 0 – 1 | $512 \times 512$ | `idle`, `attack_01` |
| **Zweihandwaffe / Kanone** | $\le 850$ | 1 – 2 | $1024 \times 1024$ | `idle`, `cleave`, `fire` |
| **Rüstungsteil (pro Slot)** | $\le 600$ | 0 (Sockelgebunden) | $512 \times 512$ PBR | - |
| **Gegner (z. B. Astralwisp)** | $\le 1.200$ | $\le 24$ | $512 \times 512$ | `idle`, `walk`, `hit`, `attack` |
| **Elite (Runenwächter)** | $\le 4.000$ | $\le 48$ | $1024 \times 1024$ | `idle`, `walk`, `hit`, `attack`, `cast` |

---

## 5. Nahtlose System-Integration & Verheiratung

Wenn Sie Echoes of Aurion an ein bestehendes Backend, ein Drittsystem oder einen separaten Auth-/World-Service anbinden möchten, stellt das Projekt standardisierte Schnittstellen bereit.

### 5.1 Architektur-Bridge (Microservice & Monolith)
Das Backend fungiert als Vermittlungsschicht (Gateway). Es kann entweder autark betrieben oder als Sub-Service in ein Kubernetes-/Docker-Cluster integriert werden.

```
┌─────────────────────────┐          JSON/REST          ┌───────────────────────────┐
│  Bestehendes Spiel /    │ ──────────────────────────► │  Echoes of Aurion Backend │
│  Externer Auth-Service  │ ◄────────────────────────── │  (Express + MariaDB)      │
└─────────────────────────┘      Sync Player/Inventory  └─────────────┬─────────────┘
                                                                      │
                                                        ┌─────────────┴─────────────┐
                                                        │  Three.js / React Client  │
                                                        └───────────────────────────┘
```

### 5.2 Wichtigste REST-Endpunkte
Alle Endpunkte akzeptieren und liefern standardisiertes JSON:

#### 1. Spieler-Zustand abrufen & speichern
- **`GET /api/player/load?id=:playerId`**
  - *Response*: `{ success: true, player: PlayerData, equipment: Record<Slot, Item>, inventory: Item[] }`
- **`POST /api/player/save`**
  - *Payload*:
    ```json
    {
      "id": "hero_player_1",
      "name": "Aethelgard Knight",
      "classId": "knight",
      "level": 12,
      "xp": 4500,
      "hp": 380,
      "maxHp": 380,
      "gold": 1250,
      "equipment": {
        "weapon": { "id": "aurion-sunblade", "rarity": "legendary" },
        "chest": { "id": "valor-hydraulic-cuirass", "rarity": "epic" }
      },
      "position": { "x": 12.4, "y": 0.95, "z": -8.2 }
    }
    ```

#### 2. Ausrüstung wechseln (Equip / Unequip)
- **`POST /api/player/equip`**
  - *Payload*: `{ "playerId": "hero_player_1", "slot": "weapon", "item": { ... } }`

#### 3. GLB-Asset-Katalog registrieren
- **`POST /api/glb/register`**
  - *Payload*:
    ```json
    {
      "id": "custom-dragon-helm",
      "name": "Drachenhelm von Aurion",
      "category": "helmet",
      "equipSlot": "head",
      "triangleBudget": 800,
      "rarity": "epic",
      "itemStats": { "armor": 45, "maxHp": 120 }
    }
    ```

### 5.3 Code-Beispiel: Anbindung an externen State / Event-Bus
In TypeScript können Sie den Spielzustand direkt über den Event-Emitter abfangen:

```ts
import { gameEngine } from '@/core/GameEngine';

// Auf Ausrüstungswechsel im bestehenden System reagieren
gameEngine.on('equipmentChanged', ({ slot, item }) => {
  console.log(`Slot ${slot} aktualisiert auf:`, item.name);
  // An externes Webhook oder Backend weiterleiten:
  fetch('https://api.ihr-system.de/v1/player/equip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot, itemId: item.id })
  });
});
```

---

## 6. MariaDB Datenbank-Anbindung & Konfiguration

Das Datenbanksystem ist vollautomatisch migrierend, thread-safe (Pool-basiert) und verfügt über einen automatischen In-Memory-Fallback für lokale Entwicklungsumgebungen ohne laufende Datenbank.

### 6.1 Umgebungsvariablen (`.env`)
Tragen Sie die Zugangsdaten in Ihre `.env` Datei ein:

```env
# Direkte Einzelparameter
MARIADB_HOST=localhost
MARIADB_PORT=3306
MARIADB_USER=aurion_admin
MARIADB_PASSWORD=aurion_secret_pass
MARIADB_DATABASE=aurion_mmo

# ODER als vollständiger Connection-String:
DATABASE_URL=mysql://aurion_admin:aurion_secret_pass@localhost:3306/aurion_mmo
```

### 6.2 Connection Pool Architektur
Die Datenbankverbindung wird in `server/mariadb.ts` über `mysql2/promise` gemanagt:
- **Connection Limit**: 10 gleichzeitige persistente Verbindungen.
- **Auto-Reconnection & Keep-Alive**: Initial Delay 10.000 ms.
- **Fallback-Mechanismus**: Ist die MariaDB-Instanz beim Booten nicht erreichbar, schaltet das System transparent in den `in_memory_fallback`-Modus, sodass das Spiel unterbrechungsfrei spielbar bleibt. Sobald die Datenbank online kommt, synchronisiert der Reconciler den Stand.

### 6.3 Schemastruktur (Auszug)

```sql
-- 1. Spieler-Haupttabelle
CREATE TABLE IF NOT EXISTS `aurion_players` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `name` VARCHAR(64) NOT NULL,
  `class_id` VARCHAR(32) NOT NULL,
  `level` INT NOT NULL DEFAULT 1,
  `xp` BIGINT NOT NULL DEFAULT 0,
  `hp` INT NOT NULL DEFAULT 200,
  `gold` BIGINT NOT NULL DEFAULT 50,
  `active_weapon_type` VARCHAR(32) NOT NULL DEFAULT 'blade',
  `weapon_masteries` JSON DEFAULT NULL,
  `last_saved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Ausrüstungs-Tabelle
CREATE TABLE IF NOT EXISTS `aurion_equipment` (
  `player_id` VARCHAR(64) NOT NULL,
  `slot` VARCHAR(32) NOT NULL,
  `item_id` VARCHAR(64) DEFAULT NULL,
  `item_name` VARCHAR(128) DEFAULT NULL,
  `rarity` VARCHAR(32) DEFAULT NULL,
  `item_data` JSON DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`player_id`, `slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.4 Verifikations-Script & Healthcheck
Zur Überprüfung der Datenbankintegrität vor einem Produktions-Deployment führen Sie folgendes Script aus:

```bash
# Datenbankverbindung und Tabellenstrukturen prüfen
node scripts/verify-aurion-runtime-database.mjs
```

**HTTP-Health-Check:**
- **URL**: `GET /api/mariadb/status`
- **Erwartete Antwort**:
  ```json
  {
    "connected": true,
    "mode": "mariadb_active",
    "host": "localhost",
    "database": "aurion_mmo",
    "tableCount": 9,
    "latencyMs": 4,
    "errorMessage": null
  }
  ```

---

## 7. Schnellstart für Entwickler (Cheatsheet)

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```
2. **Entwicklungsserver starten:**
   ```bash
   npm run dev
   ```
3. **Produktions-Build erstellen:**
   ```bash
   npm run build
   ```
4. **GLB-Assets hinzufügen:**
   Legen Sie neue `.glb`-Dateien in `/GLB-Assets/<category>/` ab und tragen Sie den Schlüssel in `src/core/ItemGlbRegistry.ts` ein. Das System übernimmt Skalierung, Socket-Bindung und Server-Caching automatisch.
