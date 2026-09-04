import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { mariaDB } from './server/mariadb';
import { glbRegistry, createMinimalGLB } from './server/glbRegistry';
import { multiplayerServer } from './server/multiplayerServer';
import { writeBehindBuffer } from './server/writeBehindBuffer';

dotenv.config();

// Lazy Gemini client helper
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support up to 50mb payloads for GLB file base64 uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Static serving for external GLB models directory
  const glbStaticPath = path.join(process.cwd(), 'public', 'models', 'glb');
  app.use('/models/glb', express.static(glbStaticPath));

  const glbAssetsStaticPath = path.join(process.cwd(), 'GLB-Assets');
  app.use('/glb-assets', express.static(glbAssetsStaticPath));

  // Dynamic fallback for any unseeded GLB model requests to prevent 404 HTML fallback parsing errors
  app.get(['/glb-assets/*', '/models/glb/*'], (req, res) => {
    const rawPath = req.path.replace(/^\/(glb-assets|models\/glb)\//, '');
    const modelName = path.basename(rawPath, '.glb');
    const buffer = createMinimalGLB(modelName, 0.0, 0.94, 1.0);

    // Save to disk for future static requests
    try {
      const diskPath = path.join(process.cwd(), 'GLB-Assets', rawPath);
      fs.mkdirSync(path.dirname(diskPath), { recursive: true });
      fs.writeFileSync(diskPath, buffer);
    } catch (e) {}

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.send(buffer);
  });

  // Initialize DB and GLB Catalog in background
  mariaDB.autoConnect().catch(() => {});
  glbRegistry.ensureDirectoriesAndSeed();

  // Production Healthcheck (Traefik / Nginx / Docker container healthcheck)
  app.get(['/healthz', '/api/health'], async (req, res) => {
    const status = await mariaDB.getStatus();
    res.json({
      status: 'healthy',
      server: 'aurion-expanse-node',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        mode: status.mode,
        connected: status.connected,
        tables: status.tableCount,
        latencyMs: status.latencyMs,
      },
      modelsVault: {
        registeredModels: glbRegistry.getAll().length,
      },
    });
  });

  // --- MariaDB / MySQL Management Endpoints ---
  app.get('/api/database/status', async (req, res) => {
    try {
      const status = await mariaDB.getStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/database/test', async (req, res) => {
    try {
      const result = await mariaDB.testConnection(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/database/configure', async (req, res) => {
    try {
      const result = await mariaDB.connectAndMigrate(req.body, false);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/database/migrate', async (req, res) => {
    try {
      await mariaDB.runMigrations();
      const status = await mariaDB.getStatus();
      res.json({ success: true, message: 'Schema migration applied successfully.', tables: status.tables });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- Player State Persistence (MariaDB with Scalable Write-Behind Buffer) ---
  app.post('/api/player/save', async (req, res) => {
    try {
      const playerId = req.body.id || req.body.playerId || 'hero_player_1';
      // Fast path: queue into write-behind buffer to avoid thread blocking
      writeBehindBuffer.queuePlayerSave(playerId, req.body);

      // Perform optimistic persistence
      const result = await mariaDB.savePlayerState(req.body);
      res.json({ ...result, buffered: true, writeBehindStats: writeBehindBuffer.stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/player/load', async (req, res) => {
    try {
      const playerId = (req.query.id as string) || 'hero_player_1';
      // Check writeBehindBuffer first for unflushed memory state
      const buffered = writeBehindBuffer.getBufferedState(playerId);
      const player = await mariaDB.loadPlayerState(playerId);
      res.json({ player: buffered ? { ...player, ...buffered } : player });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Atomic Inventory Lock/Unlock for Race-free Trading/Dropping
  app.post('/api/player/lock', async (req, res) => {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    const acquired = await writeBehindBuffer.acquireLock(playerId);
    res.json({ acquired });
  });

  app.post('/api/player/unlock', (req, res) => {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId required' });
    writeBehindBuffer.releaseLock(playerId);
    res.json({ released: true });
  });

  app.post('/api/buffer/flush', async (req, res) => {
    const flushResult = await writeBehindBuffer.flush();
    res.json({ success: true, ...flushResult, stats: writeBehindBuffer.stats });
  });

  // --- World State Persistence ---
  app.get('/api/world/state', async (req, res) => {
    try {
      const state = await mariaDB.loadWorldState();
      res.json({ state });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/world/state', async (req, res) => {
    try {
      const success = await mariaDB.saveWorldState(req.body);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Asynchronous Delta-Snapshot Ingestion Endpoint (Engine Web Worker 60s Heartbeat)
  app.post('/api/world/delta-snapshot', async (req, res) => {
    try {
      const result = await mariaDB.saveWorldDeltaSnapshot(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/world/delta-snapshots', async (req, res) => {
    try {
      const limit = parseInt((req.query.limit as string) || '10', 10);
      const snapshots = await mariaDB.getLatestDeltaSnapshots(limit);
      res.json({ snapshots });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- External GLB Model Catalog & Directory Watcher Endpoints ---
  app.get(['/api/models/glb', '/api/models/catalog'], async (req, res) => {
    try {
      const models = glbRegistry.getAll();
      mariaDB.syncGlbCatalog(models).catch(() => {});
      res.json({ models });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Manual or Synchronous Directory Scan Endpoint
  app.all(['/api/models/scan', '/api/admin/models/sync'], async (req, res) => {
    try {
      const customDir = (req.query.dir as string) || (req.body?.directory as string);
      const targetDir = customDir
        ? path.isAbsolute(customDir)
          ? customDir
          : path.join(process.cwd(), customDir)
        : path.join(process.cwd(), 'GLB-Assets');

      const models = glbRegistry.scanDirectory(targetDir);
      await mariaDB.syncGlbCatalog(models).catch(() => {});

      res.json({
        success: true,
        scannedDirectory: targetDir,
        totalModels: models.length,
        models,
        watchStatus: glbRegistry.getWatchStatus(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Watcher Status and History
  app.get('/api/models/watch/status', (req, res) => {
    try {
      const status = glbRegistry.getWatchStatus();
      res.json({ success: true, status });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Toggle or Update Watcher Directory
  app.post('/api/models/watch/toggle', (req, res) => {
    try {
      const { active = true, directory } = req.body;
      const targetDir = directory
        ? path.isAbsolute(directory)
          ? directory
          : path.join(process.cwd(), directory)
        : path.join(process.cwd(), 'GLB-Assets');

      if (active) {
        glbRegistry.startWatcher(targetDir);
      } else {
        glbRegistry.stopWatcher(targetDir);
      }

      res.json({
        success: true,
        isWatching: active,
        status: glbRegistry.getWatchStatus(),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Recent File Watch Events
  app.get('/api/models/events', (req, res) => {
    try {
      const status = glbRegistry.getWatchStatus();
      res.json({ success: true, events: status.recentEvents });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server-Sent Events (SSE) Stream for Real-Time File Changes
  app.get('/api/models/events/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Initial greeting / handshake
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    const unsubscribe = glbRegistry.onEvent((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  app.get('/api/models/glb/:id', (req, res) => {
    const item = glbRegistry.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'GLB model not found.' });
    }
    res.json({ model: item });
  });

  // External Admin Upload Endpoint: Admins can upload .glb files externally via base64 or file payload
  app.post('/api/admin/models/upload', (req, res) => {
    try {
      const { fileName, base64Data, metadata = {} } = req.body;
      if (!fileName) {
        return res.status(400).json({ error: 'fileName is required.' });
      }

      let buffer: Buffer | null = null;
      if (base64Data) {
        // Strip data:*;base64, header if provided
        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
        buffer = Buffer.from(cleanBase64, 'base64');
      }

      const item = glbRegistry.registerOrUploadModel(fileName, buffer, metadata);
      mariaDB.syncGlbCatalog([item]).catch(() => {});
      res.json({ success: true, model: item });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/models/register', (req, res) => {
    try {
      const { fileName, metadata = {} } = req.body;
      if (!fileName) {
        return res.status(400).json({ error: 'fileName is required.' });
      }
      const item = glbRegistry.registerOrUploadModel(fileName, null, metadata);
      mariaDB.syncGlbCatalog([item]).catch(() => {});
      res.json({ success: true, model: item });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/models/:id', (req, res) => {
    const success = glbRegistry.deleteModel(req.params.id);
    res.json({ success });
  });

  // API Route: AI Dynamic Quest Generation via Gemini / Genkit
  app.post('/api/quests/generate', async (req, res) => {
    try {
      const { playerLevel = 1, score = 0, difficultyTier = 1 } = req.body;
      const ai = getGeminiClient();

      if (ai) {
        const prompt = `You are the Genkit Dungeon Master for "Aurion", a Steampunk Fantasy MMORPG with Mystic Flower Wells, 3rd-person Steam Mount navigation, and Antigravity Shields.
Generate an engaging, short dynamic quest tailored to a player at Level ${playerLevel}, Score ${score}, Difficulty Tier ${difficultyTier}.
Return a JSON object with:
- title: A short evocative steampunk quest title (max 5 words)
- lore: 1-2 atmospheric fantasy sentences explaining the crisis in the flow fields
- objective: 1 clear actionable sentence
- targetCount: integer between ${3 + playerLevel} and ${8 + playerLevel * 2}
- rewardXp: integer (e.g. 50-150)
- rewardScore: integer (e.g. 150-400)
- type: one of "near_miss", "shield_repel", "survive_time", "reach_score"`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                lore: { type: Type.STRING },
                objective: { type: Type.STRING },
                targetCount: { type: Type.INTEGER },
                rewardXp: { type: Type.INTEGER },
                rewardScore: { type: Type.INTEGER },
                type: { type: Type.STRING },
              },
              required: ['title', 'lore', 'objective', 'targetCount', 'rewardXp', 'rewardScore', 'type'],
            },
          },
        });

        if (response.text) {
          const quest = JSON.parse(response.text);
          return res.json(quest);
        }
      }

      // High quality rule-based fallback if API key is not configured
      const questTypes = ['near_miss', 'shield_repel', 'reach_score'];
      const chosenType = questTypes[(playerLevel + difficultyTier) % questTypes.length];
      const titles = [
        'Aetherial Leyline Traverse',
        'Vortex Repulsion Protocol',
        'Clockwork Sentinel Grazing',
        'Mystic Well Overcharge',
        'Steam Conduit Stabilization',
      ];
      const selectedTitle = titles[(playerLevel - 1) % titles.length];

      return res.json({
        title: `${selectedTitle} - Tier ${difficultyTier}`,
        lore: `Ancient corrupted steam constructs are perturbing the Mystic Wells. Channel your antigravity energy to rebalance the grid.`,
        objective: chosenType === 'near_miss'
          ? `Perform ${4 + playerLevel} near-miss glides within enemy radius 2.0.`
          : chosenType === 'shield_repel'
          ? `Activate your Antigravity Shield to repel ${3 + playerLevel} hazards.`
          : `Attain a score of ${(playerLevel + 1) * 300} points.`,
        targetCount: chosenType === 'reach_score' ? (playerLevel + 1) * 300 : 4 + playerLevel,
        rewardXp: 60 + playerLevel * 15,
        rewardScore: 200 + difficultyTier * 50,
        type: chosenType,
      });
    } catch (err) {
      console.error('Quest generation error:', err);
      return res.json({
        title: 'Emergency Steam Divergence',
        lore: 'A high-pressure vortex has ruptured the northern flow fields.',
        objective: 'Execute 5 near-miss glides without taking lethal combat damage.',
        targetCount: 5,
        rewardXp: 80,
        rewardScore: 250,
        type: 'near_miss',
      });
    }
  });

  // API Route: AI Dungeon Master Tactical Advice / Lore
  app.post('/api/lore/generate', async (req, res) => {
    try {
      const { playerLevel = 1, currentScore = 0 } = req.body;
      const ai = getGeminiClient();

      if (ai) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: `Provide 1 short sentence (under 25 words) of tactical advice from an ancient Clockwork Sage to an Aurion mount pilot at level ${playerLevel} and score ${currentScore}.`,
        });

        if (response.text) {
          return res.json({ lore: response.text.trim() });
        }
      }

      return res.json({
        lore: 'Graze the perimeter of Corrupted Golems to harvest near-miss kinetic energy for faster level advancement.',
      });
    } catch {
      return res.json({
        lore: 'Activate your Antigravity Steam Shield to dissipate combat blows and push away approaching vortex wells.',
      });
    }
  });

  // API Route: Game State Sync Ping (Python Bridge Compatible)
  app.post('/api/gamestate/sync', (req, res) => {
    const { playerId, level, score, hp, stamina, difficultyLevel, timestamp } = req.body;
    res.json({
      status: 'synced',
      playerId: playerId || 'hero_mount_1',
      serverTick: Date.now(),
      echoTimestamp: timestamp,
      serverMetrics: {
        activePlayers: 1,
        worldState: 'operational',
        difficultyLevel,
        playerHealthPct: Math.round((hp / 100) * 100),
      },
    });
  });

  // API Route: Combat & Telemetry Event
  app.post('/api/gamestate/event', (req, res) => {
    res.json({ status: 'event_logged', ack: true });
  });

  // --- Persistent World Chunks API (Dynamic 120,000+ sqm World Generation & Expansion) ---
  app.get('/api/world/chunks', async (req, res) => {
    try {
      const chunks = await mariaDB.getAllWorldChunks();
      res.json({ success: true, chunks, count: chunks.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/world/chunks', async (req, res) => {
    try {
      const { chunk, chunks } = req.body;
      if (Array.isArray(chunks)) {
        for (const c of chunks) {
          await mariaDB.saveWorldChunk(c);
        }
        res.json({ success: true, savedCount: chunks.length });
      } else if (chunk) {
        const result = await mariaDB.saveWorldChunk(chunk);
        res.json(result);
      } else {
        res.status(400).json({ success: false, error: 'No chunk data provided' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/world/stats', async (req, res) => {
    try {
      const stats = await mariaDB.getWorldSummaryStats();
      res.json({ success: true, ...stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Politics & Territory Administration API ---
  app.get('/api/world/politics/:chunkKey', async (req, res) => {
    try {
      const { chunkKey } = req.params;
      const politics = await mariaDB.getChunkPolitics(chunkKey);
      res.json({ success: true, politics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/world/politics/:chunkKey', async (req, res) => {
    try {
      const { chunkKey } = req.params;
      const politicsData = req.body;
      const result = await mariaDB.saveChunkPolitics(chunkKey, politicsData);
      res.json({ success: result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- Guild Management, Shared Bank & Sovereign Kingdom Consolidation API ---
  app.get('/api/guild', async (req, res) => {
    try {
      const guildId = (req.query.id as string) || 'guild_aether_guardians';
      let guild = await mariaDB.getGuildData(guildId);
      if (!guild) {
        // Fallback to default guild if not yet saved
        const { createDefaultGuildData } = await import('./src/data/defaultGuildData');
        guild = createDefaultGuildData();
        await mariaDB.saveGuildData(guild);
      }
      res.json({ success: true, guild });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/guild/save', async (req, res) => {
    try {
      const guildData = req.body;
      const success = await mariaDB.saveGuildData(guildData);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Consolidate minimum 6 lands into a unified Kingdom under Guild Leadership
  app.post('/api/guild/consolidate-kingdom', async (req, res) => {
    try {
      const { guildId = 'guild_aether_guardians', kingdomName, bannerIcon, bannerColor, chunkKeys, capitalChunkKey, rulerName } = req.body;
      const result = await mariaDB.consolidateGuildKingdom(guildId, {
        kingdomName: kingdomName || 'Großkönigreich von Aurion',
        bannerIcon: bannerIcon || '👑',
        bannerColor: bannerColor || '#00f0ff',
        chunkKeys: chunkKeys || [],
        capitalChunkKey: capitalChunkKey || '0,0',
        rulerName: rulerName || 'Hero',
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Guild Bank: Deposit Gold
  app.post('/api/guild/bank/deposit-gold', async (req, res) => {
    const { guildId = 'guild_aether_guardians', amount, playerName = 'Hero' } = req.body;
    const lockKey = `guild_transaction_${guildId}`;
    if (!(await writeBehindBuffer.acquireLock(lockKey, 2000))) {
      return res.status(409).json({ success: false, error: 'Treasury busy. Please try again.' });
    }
    
    try {
      const goldAmt = Math.max(0, parseInt(amount, 10) || 0);
      let guild = await mariaDB.getGuildData(guildId);
      if (!guild) {
        const { createDefaultGuildData } = await import('./src/data/defaultGuildData');
        guild = createDefaultGuildData();
      }

      guild.bank.treasuryGold += goldAmt;
      guild.bank.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        action: 'deposit_gold',
        playerName,
        details: `Hat ${goldAmt.toLocaleString()} Gold in die Gildenbank eingezahlt.`,
      });

      // Update goal progress if applicable
      const bankGoal = guild.goals.find((g: any) => g.id === 'goal_treasury_fill');
      if (bankGoal) {
        bankGoal.currentProgress = guild.bank.treasuryGold;
        if (bankGoal.currentProgress >= bankGoal.targetProgress) {
          bankGoal.completed = true;
        }
      }

      await mariaDB.saveGuildData(guild);
      res.json({ success: true, treasuryGold: guild.bank.treasuryGold, guild });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    } finally {
      writeBehindBuffer.releaseLock(lockKey);
    }
  });

  // Guild Bank: Withdraw Gold
  app.post('/api/guild/bank/withdraw-gold', async (req, res) => {
    const { guildId = 'guild_aether_guardians', amount, playerName = 'Hero' } = req.body;
    const lockKey = `guild_transaction_${guildId}`;
    if (!(await writeBehindBuffer.acquireLock(lockKey, 2000))) {
      return res.status(409).json({ success: false, error: 'Treasury busy. Please try again.' });
    }
    
    try {
      const goldAmt = Math.max(0, parseInt(amount, 10) || 0);
      let guild = await mariaDB.getGuildData(guildId);
      if (!guild) return res.status(404).json({ error: 'Gilde nicht gefunden' });

      if (guild.bank.treasuryGold < goldAmt) {
        return res.status(400).json({ error: 'Nicht genügend Gold in der Gilden-Schatzkammer' });
      }

      guild.bank.treasuryGold -= goldAmt;
      guild.bank.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        action: 'withdraw_gold',
        playerName,
        details: `Hat ${goldAmt.toLocaleString()} Gold aus der Schatzkammer entnommen.`,
      });

      await mariaDB.saveGuildData(guild);
      res.json({ success: true, withdrawn: goldAmt, treasuryGold: guild.bank.treasuryGold, guild });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    } finally {
      writeBehindBuffer.releaseLock(lockKey);
    }
  });

  // Guild Bank: Deposit Item
  app.post('/api/guild/bank/deposit-item', async (req, res) => {
    const { guildId = 'guild_aether_guardians', item, playerName = 'Hero' } = req.body;
    if (!item) return res.status(400).json({ error: 'Item data required' });
    
    const lockKey = `guild_transaction_${guildId}`;
    if (!(await writeBehindBuffer.acquireLock(lockKey, 2000))) {
      return res.status(409).json({ success: false, error: 'Vault busy. Please try again.' });
    }

    try {
      let guild = await mariaDB.getGuildData(guildId);
      if (!guild) {
        const { createDefaultGuildData } = await import('./src/data/defaultGuildData');
        guild = createDefaultGuildData();
      }

      if (guild.bank.items.length >= guild.bank.maxSlots) {
        return res.status(400).json({ error: 'Gildenbank-Fächer sind voll!' });
      }

      const bankItem = {
        id: 'gbank_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: item.name,
        rarity: item.rarity || 'common',
        icon: item.icon || '📦',
        type: item.slot || 'misc',
        quantity: 1,
        itemData: item,
        depositedBy: playerName,
        depositedAt: 'Gerade eben',
      };

      guild.bank.items.push(bankItem);
      guild.bank.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        action: 'deposit_item',
        playerName,
        details: `Hat [${item.name}] in das Gilden-Tresorfach gelegt.`,
      });

      await mariaDB.saveGuildData(guild);
      res.json({ success: true, item: bankItem, guild });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    } finally {
      writeBehindBuffer.releaseLock(lockKey);
    }
  });

  // Guild Bank: Withdraw Item
  app.post('/api/guild/bank/withdraw-item', async (req, res) => {
    const { guildId = 'guild_aether_guardians', itemId, playerName = 'Hero' } = req.body;
    const lockKey = `guild_transaction_${guildId}`;
    if (!(await writeBehindBuffer.acquireLock(lockKey, 2000))) {
      return res.status(409).json({ success: false, error: 'Vault busy. Please try again.' });
    }
    
    try {
      let guild = await mariaDB.getGuildData(guildId);
      if (!guild) return res.status(404).json({ error: 'Gilde nicht gefunden' });

      const idx = guild.bank.items.findIndex((i: any) => i.id === itemId);
      if (idx === -1) return res.status(404).json({ error: 'Item im Tresorfach nicht gefunden' });

      const [removedItem] = guild.bank.items.splice(idx, 1);
      guild.bank.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        action: 'withdraw_item',
        playerName,
        details: `Hat [${removedItem.name}] aus dem Tresorfach entnommen.`,
      });

      await mariaDB.saveGuildData(guild);
      res.json({ success: true, item: removedItem, guild });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    } finally {
      writeBehindBuffer.releaseLock(lockKey);
    }
  });

  // Kingdom Building Upgrade
  app.post('/api/guild/kingdom/upgrade-building', async (req, res) => {
    const { guildId = 'guild_aether_guardians', buildingId, playerName = 'Hero' } = req.body;
    const lockKey = `guild_transaction_${guildId}`;
    if (!(await writeBehindBuffer.acquireLock(lockKey, 2000))) {
      return res.status(409).json({ success: false, error: 'Kingdom management is busy. Please try again.' });
    }
    
    try {
      let guild = await mariaDB.getGuildData(guildId);
      if (!guild || !guild.kingdom) {
        return res.status(400).json({ error: 'Kein aktives Königreich vorhanden. Bitte zuerst Gebiete vereinen!' });
      }

      const building = guild.kingdom.buildings.find((b: any) => b.id === buildingId);
      if (!building) return res.status(404).json({ error: 'Gebäude nicht gefunden' });

      if (building.level >= building.maxLevel) {
        return res.status(400).json({ error: 'Dieses Gebäude hat bereits die Maximalstufe erreicht.' });
      }

      // Check resources
      const cost = building.cost;
      if (guild.bank.treasuryGold < cost.gold) {
        return res.status(400).json({ error: `Nicht genügend Gold in der Gildenbank (${guild.bank.treasuryGold}/${cost.gold})` });
      }
      if (guild.kingdom.resources.wood < cost.wood || guild.kingdom.resources.stone < cost.stone || guild.kingdom.resources.aether < cost.aether) {
        return res.status(400).json({ error: 'Nicht genügend Königreich-Ressourcen vorhanden.' });
      }

      // Deduct resources
      guild.bank.treasuryGold -= cost.gold;
      guild.kingdom.resources.wood -= cost.wood;
      guild.kingdom.resources.stone -= cost.stone;
      guild.kingdom.resources.aether -= cost.aether;

      // Upgrade building
      building.level += 1;
      building.built = true;

      // Scale cost for next tier
      building.cost = {
        gold: Math.round(cost.gold * 1.5),
        wood: Math.round(cost.wood * 1.4),
        stone: Math.round(cost.stone * 1.4),
        aether: Math.round(cost.aether * 1.6),
      };

      // Kingdom bonuses increase
      guild.kingdom.defenseRating += 25;
      guild.kingdom.passiveIncomeGoldPerHour += 50;

      guild.bank.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        action: 'kingdom_upgrade',
        playerName,
        details: `Hat [${building.name}] auf Stufe ${building.level} ausgebaut!`,
      });

      await mariaDB.saveGuildData(guild);
      res.json({ success: true, building, kingdom: guild.kingdom, guild });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    } finally {
      writeBehindBuffer.releaseLock(lockKey);
    }
  });

  // Kingdom Resource Donation
  app.post('/api/guild/kingdom/donate-resources', async (req, res) => {
    try {
      const { guildId = 'guild_aether_guardians', resources, playerName = 'Hero' } = req.body;
      let guild = await mariaDB.getGuildData(guildId);
      if (!guild) return res.status(404).json({ error: 'Gilde nicht gefunden' });

      if (guild.kingdom) {
        if (resources.wood) guild.kingdom.resources.wood += resources.wood;
        if (resources.stone) guild.kingdom.resources.stone += resources.stone;
        if (resources.aether) guild.kingdom.resources.aether += resources.aether;
        if (resources.crops) guild.kingdom.resources.crops += resources.crops;
      }

      guild.bank.logs.unshift({
        id: 'log_' + Date.now(),
        timestamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        action: 'donate_resource',
        playerName,
        details: `Hat Ressourcen gespendet (Holz: +${resources.wood || 0}, Stein: +${resources.stone || 0}, Äther: +${resources.aether || 0}).`,
      });

      await mariaDB.saveGuildData(guild);
      res.json({ success: true, kingdom: guild.kingdom, guild });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  multiplayerServer.attach(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Aurion Game Server with Realtime WebSocket Realm running on http://localhost:${PORT}`);
  });
}

startServer();
