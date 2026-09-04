import mysql, { Pool, PoolOptions } from 'mysql2/promise';

export interface MariaDBConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionUrl?: string;
}

export interface MariaDBStatus {
  connected: boolean;
  mode: 'mariadb_active' | 'in_memory_fallback';
  host: string;
  port: number;
  database: string;
  user: string;
  tableCount: number;
  tables: string[];
  latencyMs: number;
  lastSyncAt: string | null;
  errorMessage: string | null;
  totalSavedPlayers: number;
}

// In-Memory Fallback Store (when MariaDB is not yet configured or during standalone testing)
class InMemoryStore {
  players: Map<string, any> = new Map();
  equipment: Map<string, Map<string, any>> = new Map();
  inventory: Map<string, any[]> = new Map();
  quests: Map<string, any[]> = new Map();
  worldState: any = {
    id: 'aurion_prime',
    time_of_day: 0.25,
    weather: 'clear',
    leyline_charge: 100,
    active_events: ['Aetherial Convergence', 'Windhollow Bloom'],
    updated_at: new Date().toISOString(),
  };
  glbCatalog: Map<string, any> = new Map();
  worldChunks: Map<string, any> = new Map();
  worldSnapshots: any[] = [];
  logs: any[] = [];
}

class MariaDBService {
  private pool: Pool | null = null;
  private inMemory = new InMemoryStore();
  private isConnected = false;
  private lastLatencyMs = 0;
  private lastError: string | null = null;
  private lastSyncTime: string | null = null;
  private currentConfig: MariaDBConfig = {};
  private knownTables: string[] = [];

  constructor() {
    this.currentConfig = {
      host: process.env.MARIADB_HOST || 'localhost',
      port: parseInt(process.env.MARIADB_PORT || '3306', 10),
      user: process.env.MARIADB_USER || 'aurion_admin',
      password: process.env.MARIADB_PASSWORD || '',
      database: process.env.MARIADB_DATABASE || 'aurion_mmo',
      connectionUrl: process.env.DATABASE_URL || '',
    };
  }

  public async autoConnect() {
    // Try to connect using environment variables if provided
    try {
      if (this.currentConfig.connectionUrl || (this.currentConfig.host && this.currentConfig.database)) {
        await this.connectAndMigrate(this.currentConfig, false);
      }
    } catch {
      // Graceful fallback to in-memory mode without crashing
      this.isConnected = false;
      this.lastError = 'MariaDB instance not reachable yet. Operating in High-Performance Standalone Memory Mode.';
    }
  }

  public async testConnection(config: MariaDBConfig): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const startTime = Date.now();
    let tempPool: Pool | null = null;
    try {
      const opts = this.buildPoolOptions(config);
      tempPool = mysql.createPool({ ...opts, connectionLimit: 1, connectTimeout: 3000 });
      const [rows] = await tempPool.query('SELECT 1 as ping, VERSION() as version');
      const latencyMs = Date.now() - startTime;
      const version = Array.isArray(rows) && (rows[0] as any)?.version ? (rows[0] as any).version : 'Unknown';
      await tempPool.end();
      return {
        success: true,
        latencyMs,
        message: `Handshake verified successfully with MariaDB/MySQL server (Version: ${version}) in ${latencyMs}ms.`,
      };
    } catch (err: any) {
      if (tempPool) {
        try { await tempPool.end(); } catch {}
      }
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        message: err.message || 'Connection handshake failed.',
      };
    }
  }

  public async connectAndMigrate(config: MariaDBConfig, throwOnError = true): Promise<{ success: boolean; message: string; tables: string[] }> {
    try {
      if (this.pool) {
        try { await this.pool.end(); } catch {}
      }

      this.currentConfig = { ...config };
      const opts = this.buildPoolOptions(config);
      
      // Step 1: Connect to server without specific database first to ensure database exists
      const serverPool = mysql.createPool({
        host: opts.host,
        port: opts.port,
        user: opts.user,
        password: opts.password,
        connectionLimit: 2,
        connectTimeout: 4000,
      });

      const dbName = opts.database || 'aurion_mmo';
      await serverPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await serverPool.end();

      // Step 2: Connect directly to the database
      this.pool = mysql.createPool({
        ...opts,
        database: dbName,
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
      });

      // Step 3: Run table migrations and reconcilers
      await this.runMigrations();

      // Step 4: Verify connectivity and table listing
      const start = Date.now();
      const [tableRows] = await this.pool.query('SHOW TABLES');
      this.lastLatencyMs = Date.now() - start;
      this.knownTables = (tableRows as any[]).map((r) => Object.values(r)[0] as string);

      this.isConnected = true;
      this.lastError = null;
      this.lastSyncTime = new Date().toISOString();

      return {
        success: true,
        message: `Connected to MariaDB database '${dbName}' with ${this.knownTables.length} tables verified.`,
        tables: this.knownTables,
      };
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err.message || 'Failed to bind MariaDB database.';
      if (throwOnError) {
        throw err;
      }
      return {
        success: false,
        message: this.lastError,
        tables: [],
      };
    }
  }

  private buildPoolOptions(config: MariaDBConfig): PoolOptions {
    if (config.connectionUrl && config.connectionUrl.trim().length > 0) {
      return { uri: config.connectionUrl.trim() };
    }
    return {
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user || 'root',
      password: config.password || '',
      database: config.database || 'aurion_mmo',
    };
  }

  public async runMigrations() {
    if (!this.pool) return;

    const migrationQueries = [
      // 1. Players Table
      `CREATE TABLE IF NOT EXISTS \`aurion_players\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(64) NOT NULL,
        \`class_id\` VARCHAR(32) NOT NULL,
        \`level\` INT NOT NULL DEFAULT 1,
        \`xp\` BIGINT NOT NULL DEFAULT 0,
        \`xp_to_next_level\` BIGINT NOT NULL DEFAULT 100,
        \`hp\` INT NOT NULL DEFAULT 200,
        \`max_hp\` INT NOT NULL DEFAULT 200,
        \`resource\` INT NOT NULL DEFAULT 100,
        \`max_resource\` INT NOT NULL DEFAULT 100,
        \`gold\` BIGINT NOT NULL DEFAULT 50,
        \`score\` BIGINT NOT NULL DEFAULT 0,
        \`stat_points\` INT NOT NULL DEFAULT 0,
        \`strength\` INT NOT NULL DEFAULT 10,
        \`agility\` INT NOT NULL DEFAULT 10,
        \`intelligence\` INT NOT NULL DEFAULT 10,
        \`defense\` INT NOT NULL DEFAULT 10,
        \`pos_x\` FLOAT NOT NULL DEFAULT 0,
        \`pos_y\` FLOAT NOT NULL DEFAULT 0.95,
        \`pos_z\` FLOAT NOT NULL DEFAULT 0,
        \`facing_angle\` FLOAT NOT NULL DEFAULT 0,
        \`active_weapon_type\` VARCHAR(32) NOT NULL DEFAULT 'blade',
        \`is_mounted\` TINYINT(1) NOT NULL DEFAULT 0,
        \`active_model_glb\` VARCHAR(256) DEFAULT NULL,
        \`weapon_masteries\` JSON DEFAULT NULL,
        \`unlocked_titles\` JSON DEFAULT NULL,
        \`active_title\` VARCHAR(128) DEFAULT NULL,
        \`last_saved_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_player_level\` (\`level\`),
        INDEX \`idx_player_score\` (\`score\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 2. Equipment Table (Slot-based)
      `CREATE TABLE IF NOT EXISTS \`aurion_equipment\` (
        \`player_id\` VARCHAR(64) NOT NULL,
        \`slot\` VARCHAR(32) NOT NULL,
        \`item_id\` VARCHAR(64) DEFAULT NULL,
        \`item_name\` VARCHAR(128) DEFAULT NULL,
        \`rarity\` VARCHAR(32) DEFAULT NULL,
        \`item_data\` JSON DEFAULT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`player_id\`, \`slot\`),
        INDEX \`idx_equip_player\` (\`player_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 3. Inventory Bag Items
      `CREATE TABLE IF NOT EXISTS \`aurion_inventory\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`player_id\` VARCHAR(64) NOT NULL,
        \`slot_index\` INT NOT NULL,
        \`item_id\` VARCHAR(64) NOT NULL,
        \`item_name\` VARCHAR(128) NOT NULL,
        \`item_data\` JSON NOT NULL,
        \`quantity\` INT NOT NULL DEFAULT 1,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_inv_player\` (\`player_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 4. Quests Progress
      `CREATE TABLE IF NOT EXISTS \`aurion_quests\` (
        \`player_id\` VARCHAR(64) NOT NULL,
        \`quest_id\` VARCHAR(64) NOT NULL,
        \`title\` VARCHAR(128) NOT NULL,
        \`lore\` TEXT,
        \`objective\` TEXT,
        \`type\` VARCHAR(32) DEFAULT 'near_miss',
        \`progress\` INT NOT NULL DEFAULT 0,
        \`target_count\` INT NOT NULL DEFAULT 5,
        \`reward_xp\` INT NOT NULL DEFAULT 50,
        \`reward_score\` INT NOT NULL DEFAULT 150,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'active',
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`player_id\`, \`quest_id\`),
        INDEX \`idx_quest_status\` (\`player_id\`, \`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 5. World State
      `CREATE TABLE IF NOT EXISTS \`aurion_world_state\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`time_of_day\` FLOAT NOT NULL DEFAULT 0.25,
        \`weather\` VARCHAR(32) NOT NULL DEFAULT 'clear',
        \`leyline_charge\` FLOAT NOT NULL DEFAULT 100,
        \`active_events\` JSON DEFAULT NULL,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 6. External GLB Model Catalog
      `CREATE TABLE IF NOT EXISTS \`aurion_glb_catalog\` (
        \`id\` VARCHAR(64) NOT NULL PRIMARY KEY,
        \`name\` VARCHAR(128) NOT NULL,
        \`file_name\` VARCHAR(256) NOT NULL,
        \`url\` VARCHAR(256) NOT NULL,
        \`category\` VARCHAR(64) NOT NULL DEFAULT 'prop',
        \`triangle_count\` INT NOT NULL DEFAULT 0,
        \`bone_count\` INT NOT NULL DEFAULT 0,
        \`file_size_bytes\` INT NOT NULL DEFAULT 0,
        \`status\` VARCHAR(32) NOT NULL DEFAULT 'ready',
        \`animation_clips\` JSON DEFAULT NULL,
        \`metadata_json\` JSON DEFAULT NULL,
        \`registered_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_glb_cat\` (\`category\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 7. System Audit Logs
      `CREATE TABLE IF NOT EXISTS \`aurion_system_logs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`event_type\` VARCHAR(64) NOT NULL,
        \`message\` TEXT NOT NULL,
        \`details\` JSON DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_log_event\` (\`event_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 8. Persistent World Chunks (Dynamic procedural expansion up to 120,000+ qm for up to 2900 players)
      `CREATE TABLE IF NOT EXISTS \`aurion_world_chunks\` (
        \`chunk_key\` VARCHAR(32) NOT NULL PRIMARY KEY,
        \`chunk_x\` INT NOT NULL,
        \`chunk_z\` INT NOT NULL,
        \`center_x\` FLOAT NOT NULL,
        \`center_z\` FLOAT NOT NULL,
        \`size\` FLOAT NOT NULL DEFAULT 80.0,
        \`biome\` VARCHAR(64) NOT NULL,
        \`kingdom\` VARCHAR(128) NOT NULL,
        \`landmark_type\` VARCHAR(64) NOT NULL,
        \`landmark_name\` VARCHAR(128) NOT NULL,
        \`elevation_base\` FLOAT NOT NULL DEFAULT 0,
        \`material_theme\` VARCHAR(64) NOT NULL DEFAULT 'grass',
        \`obstacles_json\` JSON NOT NULL,
        \`feature_description\` TEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_chunk_coords\` (\`chunk_x\`, \`chunk_z\`),
        INDEX \`idx_chunk_kingdom\` (\`kingdom\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 9. Politics & Territory Control (Region Administration & Händler/Bank)
      `CREATE TABLE IF NOT EXISTS \`aurion_chunk_politics\` (
        \`chunk_key\` VARCHAR(32) NOT NULL PRIMARY KEY,
        \`owner_id\` VARCHAR(128) DEFAULT NULL,
        \`owner_name\` VARCHAR(128) DEFAULT NULL,
        \`stability\` INT NOT NULL DEFAULT 50,
        \`admin_points_json\` JSON NOT NULL,
        \`merchant_inventory_json\` JSON NOT NULL,
        \`bank_inventory_json\` JSON NOT NULL,
        \`guard_count\` INT NOT NULL DEFAULT 0,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_politics_owner\` (\`owner_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      // 10. Asynchronous Delta Snapshots (Periodic 60s World & Player Delta Resilience)
      `CREATE TABLE IF NOT EXISTS \`aurion_world_snapshots\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`sequence_id\` INT NOT NULL,
        \`timestamp\` BIGINT NOT NULL,
        \`payload_size_bytes\` INT NOT NULL DEFAULT 0,
        \`player_count\` INT NOT NULL DEFAULT 1,
        \`world_state\` JSON NOT NULL,
        \`player_deltas\` JSON DEFAULT NULL,
        \`chunk_keys\` JSON DEFAULT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_snap_seq\` (\`sequence_id\`),
        INDEX \`idx_snap_time\` (\`timestamp\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
    ];

    for (const sql of migrationQueries) {
      await this.pool.query(sql);
    }
  }

  // --- Player Persistence Operations ---
  public async savePlayerState(data: any): Promise<{ success: boolean; timestamp: string }> {
    const playerId = data.id || 'hero_player_1';
    const timestamp = new Date().toISOString();

    if (this.isConnected && this.pool) {
      try {
        const stats = data.stats || {};
        const attrs = stats.attributes || {};
        const pos = data.position || { x: 0, y: 0.95, z: 0 };

        // 1. Upsert aurion_players
        const playerSql = `
          INSERT INTO \`aurion_players\` (
            \`id\`, \`name\`, \`class_id\`, \`level\`, \`xp\`, \`xp_to_next_level\`,
            \`hp\`, \`max_hp\`, \`resource\`, \`max_resource\`, \`gold\`, \`score\`,
            \`stat_points\`, \`strength\`, \`agility\`, \`intelligence\`, \`defense\`,
            \`pos_x\`, \`pos_y\`, \`pos_z\`, \`facing_angle\`, \`active_weapon_type\`,
            \`is_mounted\`, \`active_model_glb\`, \`weapon_masteries\`, \`unlocked_titles\`, \`active_title\`
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            \`name\` = VALUES(\`name\`),
            \`class_id\` = VALUES(\`class_id\`),
            \`level\` = VALUES(\`level\`),
            \`xp\` = VALUES(\`xp\`),
            \`xp_to_next_level\` = VALUES(\`xp_to_next_level\`),
            \`hp\` = VALUES(\`hp\`),
            \`max_hp\` = VALUES(\`max_hp\`),
            \`resource\` = VALUES(\`resource\`),
            \`max_resource\` = VALUES(\`max_resource\`),
            \`gold\` = VALUES(\`gold\`),
            \`score\` = VALUES(\`score\`),
            \`stat_points\` = VALUES(\`stat_points\`),
            \`strength\` = VALUES(\`strength\`),
            \`agility\` = VALUES(\`agility\`),
            \`intelligence\` = VALUES(\`intelligence\`),
            \`defense\` = VALUES(\`defense\`),
            \`pos_x\` = VALUES(\`pos_x\`),
            \`pos_y\` = VALUES(\`pos_y\`),
            \`pos_z\` = VALUES(\`pos_z\`),
            \`facing_angle\` = VALUES(\`facing_angle\`),
            \`active_weapon_type\` = VALUES(\`active_weapon_type\`),
            \`is_mounted\` = VALUES(\`is_mounted\`),
            \`active_model_glb\` = VALUES(\`active_model_glb\`),
            \`weapon_masteries\` = VALUES(\`weapon_masteries\`),
            \`unlocked_titles\` = VALUES(\`unlocked_titles\`),
            \`active_title\` = VALUES(\`active_title\`)
        `;

        await this.pool.query(playerSql, [
          playerId,
          data.name || 'Aurion Wanderer',
          data.classId || 'sentinel',
          stats.level || 1,
          stats.xp || 0,
          stats.xpToNextLevel || 100,
          stats.hp || 200,
          stats.maxHp || 200,
          stats.resource || 100,
          stats.maxResource || 100,
          stats.gold || 50,
          stats.score || 0,
          stats.statPoints || 0,
          attrs.strength || 10,
          attrs.agility || 10,
          attrs.intelligence || 10,
          attrs.defense || 10,
          pos.x || 0,
          pos.y || 0.95,
          pos.z || 0,
          data.facingAngle || 0,
          stats.activeWeaponType || 'blade',
          stats.isMounted ? 1 : 0,
          data.activeModelGlb || null,
          JSON.stringify(stats.weaponMasteries || {}),
          JSON.stringify(stats.unlockedTitles || []),
          stats.activeTitle || null,
        ]);

        // 2. Upsert Equipment
        if (data.equipment && typeof data.equipment === 'object') {
          for (const [slot, item] of Object.entries(data.equipment)) {
            const equipSql = `
              INSERT INTO \`aurion_equipment\` (\`player_id\`, \`slot\`, \`item_id\`, \`item_name\`, \`rarity\`, \`item_data\`)
              VALUES (?, ?, ?, ?, ?, ?)
              ON DUPLICATE KEY UPDATE
                \`item_id\` = VALUES(\`item_id\`),
                \`item_name\` = VALUES(\`item_name\`),
                \`rarity\` = VALUES(\`rarity\`),
                \`item_data\` = VALUES(\`item_data\`)
            `;
            const it = item as any;
            await this.pool.query(equipSql, [
              playerId,
              slot,
              it ? it.id : null,
              it ? it.name : null,
              it ? it.rarity : null,
              it ? JSON.stringify(it) : null,
            ]);
          }
        }

        // 3. Upsert Inventory
        if (Array.isArray(data.inventory)) {
          await this.pool.query('DELETE FROM `aurion_inventory` WHERE `player_id` = ?', [playerId]);
          for (let i = 0; i < data.inventory.length; i++) {
            const item = data.inventory[i];
            if (!item) continue;
            await this.pool.query(
              'INSERT INTO `aurion_inventory` (`id`, `player_id`, `slot_index`, `item_id`, `item_name`, `item_data`, `quantity`) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                `${playerId}_slot_${i}`,
                playerId,
                i,
                item.id || `item_${i}`,
                item.name || 'Mystic Relic',
                JSON.stringify(item),
                item.quantity || 1,
              ]
            );
          }
        }

        // 4. Upsert Quests
        if (Array.isArray(data.quests)) {
          for (const q of data.quests) {
            if (!q || !q.id) continue;
            await this.pool.query(
              `INSERT INTO \`aurion_quests\` (\`player_id\`, \`quest_id\`, \`title\`, \`lore\`, \`objective\`, \`type\`, \`progress\`, \`target_count\`, \`reward_xp\`, \`reward_score\`, \`status\`)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 \`progress\` = VALUES(\`progress\`),
                 \`status\` = VALUES(\`status\`)`,
              [
                playerId,
                q.id,
                q.title || 'Leyline Protocol',
                q.lore || '',
                q.objective || '',
                q.type || 'near_miss',
                q.progress || 0,
                q.targetCount || 5,
                q.rewardXp || 50,
                q.rewardScore || 150,
                q.status || 'active',
              ]
            );
          }
        }

        this.lastSyncTime = timestamp;
        return { success: true, timestamp };
      } catch (err: any) {
        console.error('Failed to write to MariaDB, falling back to memory store:', err.message);
      }
    }

    // In-memory fallback persistence
    this.inMemory.players.set(playerId, { ...data, lastSavedAt: timestamp });
    if (data.equipment) {
      this.inMemory.equipment.set(playerId, new Map(Object.entries(data.equipment)));
    }
    if (data.inventory) {
      this.inMemory.inventory.set(playerId, [...data.inventory]);
    }
    if (data.quests) {
      this.inMemory.quests.set(playerId, [...data.quests]);
    }
    this.lastSyncTime = timestamp;
    return { success: true, timestamp };
  }

  public async loadPlayerState(playerId = 'hero_player_1'): Promise<any> {
    if (this.isConnected && this.pool) {
      try {
        const [playerRows] = await this.pool.query<any[]>('SELECT * FROM `aurion_players` WHERE `id` = ?', [playerId]);
        if (playerRows && playerRows.length > 0) {
          const row = playerRows[0];

          // Load equipment
          const [equipRows] = await this.pool.query<any[]>('SELECT * FROM `aurion_equipment` WHERE `player_id` = ?', [playerId]);
          const equipment: Record<string, any> = {};
          for (const eq of equipRows) {
            if (eq.item_data) {
              try {
                equipment[eq.slot] = typeof eq.item_data === 'string' ? JSON.parse(eq.item_data) : eq.item_data;
              } catch {
                equipment[eq.slot] = null;
              }
            } else {
              equipment[eq.slot] = null;
            }
          }

          // Load inventory
          const [invRows] = await this.pool.query<any[]>(
            'SELECT * FROM `aurion_inventory` WHERE `player_id` = ? ORDER BY `slot_index` ASC',
            [playerId]
          );
          const inventory = invRows.map((r) => {
            try {
              return typeof r.item_data === 'string' ? JSON.parse(r.item_data) : r.item_data;
            } catch {
              return null;
            }
          }).filter(Boolean);

          // Load quests
          const [questRows] = await this.pool.query<any[]>('SELECT * FROM `aurion_quests` WHERE `player_id` = ?', [playerId]);
          const quests = questRows.map((q) => ({
            id: q.quest_id,
            title: q.title,
            lore: q.lore,
            objective: q.objective,
            type: q.type,
            progress: q.progress,
            targetCount: q.target_count,
            rewardXp: q.reward_xp,
            rewardScore: q.reward_score,
            status: q.status,
          }));

          let weaponMasteries = {};
          let unlockedTitles: string[] = [];
          try {
            if (row.weapon_masteries) {
              weaponMasteries = typeof row.weapon_masteries === 'string' ? JSON.parse(row.weapon_masteries) : row.weapon_masteries;
            }
            if (row.unlocked_titles) {
              unlockedTitles = typeof row.unlocked_titles === 'string' ? JSON.parse(row.unlocked_titles) : row.unlocked_titles;
            }
          } catch {}

          return {
            source: 'mariadb',
            id: row.id,
            name: row.name,
            classId: row.class_id,
            activeModelGlb: row.active_model_glb,
            position: { x: row.pos_x, y: row.pos_y, z: row.pos_z },
            facingAngle: row.facing_angle,
            stats: {
              level: row.level,
              xp: Number(row.xp),
              xpToNextLevel: Number(row.xp_to_next_level),
              hp: row.hp,
              maxHp: row.max_hp,
              resource: row.resource,
              maxResource: row.max_resource,
              gold: Number(row.gold),
              score: Number(row.score),
              statPoints: row.stat_points,
              attributes: {
                strength: row.strength,
                agility: row.agility,
                intelligence: row.intelligence,
                defense: row.defense,
              },
              activeWeaponType: row.active_weapon_type,
              isMounted: Boolean(row.is_mounted),
              weaponMasteries,
              unlockedTitles,
              activeTitle: row.active_title,
            },
            equipment,
            inventory,
            quests,
            lastSavedAt: row.last_saved_at,
          };
        }
      } catch (err: any) {
        console.error('Error loading player from MariaDB, falling back to memory:', err.message);
      }
    }

    // Fallback from in-memory store
    const memPlayer = this.inMemory.players.get(playerId);
    if (memPlayer) {
      return {
        source: 'in_memory_fallback',
        ...memPlayer,
      };
    }

    return null;
  }

  // --- World State Operations ---
  public async saveWorldState(worldData: any): Promise<boolean> {
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO \`aurion_world_state\` (\`id\`, \`time_of_day\`, \`weather\`, \`leyline_charge\`, \`active_events\`)
           VALUES ('aurion_prime', ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             \`time_of_day\` = VALUES(\`time_of_day\`),
             \`weather\` = VALUES(\`weather\`),
             \`leyline_charge\` = VALUES(\`leyline_charge\`),
             \`active_events\` = VALUES(\`active_events\`)`,
          [
            worldData.time_of_day || 0.25,
            worldData.weather || 'clear',
            worldData.leyline_charge || 100,
            JSON.stringify(worldData.active_events || []),
          ]
        );
        return true;
      } catch (err) {
        console.error('World state save error:', err);
      }
    }
    this.inMemory.worldState = { ...worldData, updated_at: new Date().toISOString() };
    return true;
  }

  public async loadWorldState(): Promise<any> {
    if (this.isConnected && this.pool) {
      try {
        const [rows] = await this.pool.query<any[]>('SELECT * FROM `aurion_world_state` WHERE `id` = "aurion_prime"');
        if (rows && rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            time_of_day: r.time_of_day,
            weather: r.weather,
            leyline_charge: r.leyline_charge,
            active_events: typeof r.active_events === 'string' ? JSON.parse(r.active_events) : r.active_events,
            updated_at: r.updated_at,
          };
        }
      } catch {}
    }
    return this.inMemory.worldState;
  }

  // --- Asynchronous Delta Snapshot Operations ---
  public async saveWorldDeltaSnapshot(payload: {
    sequenceId: number;
    timestamp: number;
    worldState: any;
    playerDeltas?: any[];
    chunkKeys?: string[];
  }): Promise<{ success: boolean; snapshotId?: number; memoryMode: boolean; error?: string }> {
    const payloadStr = JSON.stringify(payload);
    const payloadBytes = Buffer.byteLength(payloadStr, 'utf8');

    // Also update main world state
    if (payload.worldState) {
      await this.saveWorldState(payload.worldState).catch(() => {});
    }

    if (this.isConnected && this.pool) {
      try {
        const [result] = await this.pool.query<any>(
          `INSERT INTO \`aurion_world_snapshots\` 
           (\`sequence_id\`, \`timestamp\`, \`payload_size_bytes\`, \`player_count\`, \`world_state\`, \`player_deltas\`, \`chunk_keys\`)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            payload.sequenceId || 1,
            payload.timestamp || Date.now(),
            payloadBytes,
            payload.playerDeltas?.length || 1,
            JSON.stringify(payload.worldState || {}),
            JSON.stringify(payload.playerDeltas || []),
            JSON.stringify(payload.chunkKeys || []),
          ]
        );

        this.lastSyncTime = new Date().toISOString();
        return {
          success: true,
          snapshotId: result.insertId,
          memoryMode: false,
        };
      } catch (err: any) {
        console.error('MariaDB delta snapshot insert failed, using memory store:', err.message);
      }
    }

    // In-memory fallback
    const snapshotEntry = {
      id: this.inMemory.worldSnapshots.length + 1,
      sequence_id: payload.sequenceId,
      timestamp: payload.timestamp,
      payload_size_bytes: payloadBytes,
      world_state: payload.worldState,
      player_deltas: payload.playerDeltas,
      chunk_keys: payload.chunkKeys,
      created_at: new Date().toISOString(),
    };
    this.inMemory.worldSnapshots.push(snapshotEntry);
    if (this.inMemory.worldSnapshots.length > 50) {
      this.inMemory.worldSnapshots.shift(); // Keep last 50 snapshots in ring buffer
    }

    return {
      success: true,
      snapshotId: snapshotEntry.id,
      memoryMode: true,
    };
  }

  public async getLatestDeltaSnapshots(limit: number = 10): Promise<any[]> {
    if (this.isConnected && this.pool) {
      try {
        const [rows] = await this.pool.query<any[]>(
          'SELECT * FROM `aurion_world_snapshots` ORDER BY `id` DESC LIMIT ?',
          [limit]
        );
        return rows.map((r) => ({
          ...r,
          world_state: typeof r.world_state === 'string' ? JSON.parse(r.world_state) : r.world_state,
          player_deltas: typeof r.player_deltas === 'string' ? JSON.parse(r.player_deltas) : r.player_deltas,
          chunk_keys: typeof r.chunk_keys === 'string' ? JSON.parse(r.chunk_keys) : r.chunk_keys,
        }));
      } catch {}
    }
    return this.inMemory.worldSnapshots.slice(-limit).reverse();
  }

  // --- GLB Catalog Operations in MariaDB ---
  public async syncGlbCatalog(models: any[]) {
    if (this.isConnected && this.pool) {
      try {
        for (const m of models) {
          await this.pool.query(
            `INSERT INTO \`aurion_glb_catalog\` (\`id\`, \`name\`, \`file_name\`, \`url\`, \`category\`, \`triangle_count\`, \`bone_count\`, \`file_size_bytes\`, \`status\`, \`animation_clips\`, \`metadata_json\`)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               \`name\` = VALUES(\`name\`),
               \`category\` = VALUES(\`category\`),
               \`triangle_count\` = VALUES(\`triangle_count\`),
               \`bone_count\` = VALUES(\`bone_count\`),
               \`file_size_bytes\` = VALUES(\`file_size_bytes\`),
               \`status\` = VALUES(\`status\`),
               \`animation_clips\` = VALUES(\`animation_clips\`),
               \`metadata_json\` = VALUES(\`metadata_json\`)`,
            [
              m.id,
              m.name,
              m.fileName,
              m.url,
              m.category || 'prop',
              m.triangleBudget || 0,
              m.boneCount || 0,
              m.fileSizeBytes || 0,
              m.status || 'ready',
              JSON.stringify(m.animations || []),
              JSON.stringify(m),
            ]
          );
        }
      } catch (err) {
        console.error('GLB Catalog DB sync error:', err);
      }
    }
    for (const m of models) {
      this.inMemory.glbCatalog.set(m.id, m);
    }
  }

  // --- World Chunk Persistence Operations ---
  public async saveWorldChunk(chunk: any): Promise<{ success: boolean; chunkKey: string }> {
    const key = chunk.chunkKey;
    if (!key) throw new Error('Missing chunkKey');

    // 1. In-memory update
    this.inMemory.worldChunks.set(key, chunk);

    // 2. MariaDB write if connected
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO \`aurion_world_chunks\`
           (\`chunk_key\`, \`chunk_x\`, \`chunk_z\`, \`center_x\`, \`center_z\`, \`size\`, \`biome\`, \`kingdom\`, \`landmark_type\`, \`landmark_name\`, \`elevation_base\`, \`material_theme\`, \`obstacles_json\`, \`feature_description\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             \`biome\` = VALUES(\`biome\`),
             \`kingdom\` = VALUES(\`kingdom\`),
             \`landmark_type\` = VALUES(\`landmark_type\`),
             \`landmark_name\` = VALUES(\`landmark_name\`),
             \`elevation_base\` = VALUES(\`elevation_base\`),
             \`material_theme\` = VALUES(\`material_theme\`),
             \`obstacles_json\` = VALUES(\`obstacles_json\`),
             \`feature_description\` = VALUES(\`feature_description\`)`,
          [
            chunk.chunkKey,
            chunk.chunkX,
            chunk.chunkZ,
            chunk.centerX,
            chunk.centerZ,
            chunk.size || 80.0,
            chunk.biome,
            chunk.kingdom,
            chunk.landmarkType,
            chunk.landmarkName,
            chunk.elevationBase || 0,
            chunk.materialTheme || 'grass',
            JSON.stringify(chunk.obstacles || []),
            chunk.featureDescription || '',
          ]
        );
      } catch (err) {
        console.error('Save world chunk to MariaDB failed:', err);
      }
    }

    return { success: true, chunkKey: key };
  }

  public async getAllWorldChunks(): Promise<any[]> {
    if (this.isConnected && this.pool) {
      try {
        const [rows] = await this.pool.query<any[]>('SELECT * FROM `aurion_world_chunks` ORDER BY `created_at` ASC');
        if (Array.isArray(rows) && rows.length > 0) {
          const mapped = rows.map((r) => ({
            chunkKey: r.chunk_key,
            chunkX: r.chunk_x,
            chunkZ: r.chunk_z,
            centerX: r.center_x,
            centerZ: r.center_z,
            size: r.size,
            biome: r.biome,
            kingdom: r.kingdom,
            landmarkType: r.landmark_type,
            landmarkName: r.landmark_name,
            elevationBase: r.elevation_base,
            materialTheme: r.material_theme,
            obstacles: typeof r.obstacles_json === 'string' ? JSON.parse(r.obstacles_json) : r.obstacles_json || [],
            featureDescription: r.feature_description,
            createdAt: r.created_at,
          }));
          // Sync inMemory
          mapped.forEach((c) => this.inMemory.worldChunks.set(c.chunkKey, c));
          return mapped;
        }
      } catch (err) {
        console.error('Failed to load chunks from MariaDB:', err);
      }
    }

    return Array.from(this.inMemory.worldChunks.values());
  }

  public async getWorldSummaryStats(): Promise<{
    totalChunks: number;
    totalAreaSqMeters: number;
    targetMaxPlayers: number;
    discoveredKingdoms: string[];
  }> {
    const chunks = await this.getAllWorldChunks();
    const kingdoms = new Set<string>();
    chunks.forEach((c) => kingdoms.add(c.kingdom));
    const totalArea = chunks.length * (80 * 80); // 6,400 m² per chunk

    return {
      totalChunks: chunks.length,
      totalAreaSqMeters: totalArea,
      targetMaxPlayers: 2900,
      discoveredKingdoms: Array.from(kingdoms),
    };
  }

  // --- Politics & Territory Control Operations ---
  public async getChunkPolitics(chunkKey: string): Promise<any> {
    if (this.isConnected && this.pool) {
      try {
        const [rows] = await this.pool.query<any[]>('SELECT * FROM `aurion_chunk_politics` WHERE `chunk_key` = ?', [chunkKey]);
        if (Array.isArray(rows) && rows.length > 0) {
          const r = rows[0];
          return {
            chunkKey: r.chunk_key,
            ownerId: r.owner_id,
            ownerName: r.owner_name,
            stability: r.stability,
            adminPoints: typeof r.admin_points_json === 'string' ? JSON.parse(r.admin_points_json) : (r.admin_points_json || {}),
            merchantInventory: typeof r.merchant_inventory_json === 'string' ? JSON.parse(r.merchant_inventory_json) : (r.merchant_inventory_json || []),
            bankInventory: typeof r.bank_inventory_json === 'string' ? JSON.parse(r.bank_inventory_json) : (r.bank_inventory_json || []),
            guardCount: r.guard_count,
            updatedAt: r.updated_at,
          };
        }
      } catch (err) {
        console.error('Failed to get chunk politics from MariaDB:', err);
      }
    }
    // Default fallback if not found or no DB
    return {
      chunkKey,
      ownerId: null,
      ownerName: null,
      stability: 50,
      adminPoints: {},
      merchantInventory: [],
      bankInventory: [],
      guardCount: 0,
      updatedAt: new Date().toISOString(),
    };
  }

  public async saveChunkPolitics(chunkKey: string, politicsData: any): Promise<boolean> {
    if (this.isConnected && this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO \`aurion_chunk_politics\`
           (\`chunk_key\`, \`owner_id\`, \`owner_name\`, \`stability\`, \`admin_points_json\`, \`merchant_inventory_json\`, \`bank_inventory_json\`, \`guard_count\`)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             \`owner_id\` = VALUES(\`owner_id\`),
             \`owner_name\` = VALUES(\`owner_name\`),
             \`stability\` = VALUES(\`stability\`),
             \`admin_points_json\` = VALUES(\`admin_points_json\`),
             \`merchant_inventory_json\` = VALUES(\`merchant_inventory_json\`),
             \`bank_inventory_json\` = VALUES(\`bank_inventory_json\`),
             \`guard_count\` = VALUES(\`guard_count\`)`,
          [
            chunkKey,
            politicsData.ownerId || null,
            politicsData.ownerName || null,
            politicsData.stability || 50,
            JSON.stringify(politicsData.adminPoints || {}),
            JSON.stringify(politicsData.merchantInventory || []),
            JSON.stringify(politicsData.bankInventory || []),
            politicsData.guardCount || 0,
          ]
        );
        return true;
      } catch (err) {
        console.error('Save chunk politics to MariaDB failed:', err);
      }
    }
    return false;
  }

  public async getStatus(): Promise<MariaDBStatus> {
    let latency = this.lastLatencyMs;
    let tables = this.knownTables;

    if (this.isConnected && this.pool) {
      try {
        const start = Date.now();
        const [rows] = await this.pool.query('SELECT 1 as ping');
        latency = Date.now() - start;
        this.lastLatencyMs = latency;
        const [tableRows] = await this.pool.query('SHOW TABLES');
        tables = (tableRows as any[]).map((r) => Object.values(r)[0] as string);
        this.knownTables = tables;
      } catch (err: any) {
        this.isConnected = false;
        this.lastError = err.message;
      }
    }

    let savedPlayersCount = 0;
    if (this.isConnected && this.pool) {
      try {
        const [pRows] = await this.pool.query<any[]>('SELECT COUNT(*) as count FROM `aurion_players`');
        savedPlayersCount = pRows[0]?.count || 0;
      } catch {}
    } else {
      savedPlayersCount = this.inMemory.players.size;
    }

    return {
      connected: this.isConnected,
      mode: this.isConnected ? 'mariadb_active' : 'in_memory_fallback',
      host: this.currentConfig.host || 'localhost',
      port: this.currentConfig.port || 3306,
      database: this.currentConfig.database || 'aurion_mmo',
      user: this.currentConfig.user || 'aurion_admin',
      tableCount: tables.length,
      tables,
      latencyMs: latency,
      lastSyncAt: this.lastSyncTime,
      errorMessage: this.lastError,
      totalSavedPlayers: savedPlayersCount,
    };
  }
}

export const mariaDB = new MariaDBService();
