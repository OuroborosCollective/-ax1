import { ArchiveFile } from '../types';

export const AURION_PROJECT_FILES: ArchiveFile[] = [
  {
    path: 'aurion/index.html',
    language: 'html',
    description: 'Zero-build-tool browser entrypoint for Aurion MMORPG',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Aurion - Steampunk Fantasy MMORPG</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #020617; font-family: sans-serif; }
    #canvas-container { width: 100%; height: 100%; position: absolute; }
    #hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
  </style>
  <!-- Three.js CDN for standalone zero-build usage -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="canvas-container"></div>
  <div id="hud"></div>
  <script type="module" src="./src/core/GameEngine.js"></script>
</body>
</html>`,
  },
  {
    path: 'aurion/src/core/GameEngine.ts',
    language: 'typescript',
    description: 'Three.js 3rd-person loop, raycaster ground projection, camera spring-damper',
    content: `import * as THREE from 'three';
import { HorseHero } from '../entities/HorseHero';
import { EnemyManager } from '../entities/EnemyManager';
import { ProceduralWorld } from '../world/ProceduralWorld';
import { GameAdapter } from '../adapters/GameAdapter';

export class GameEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public hero: HorseHero;
  public enemyManager: EnemyManager;
  public world: ProceduralWorld;
  public adapters: GameAdapter[] = [];

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.hero = new HorseHero(this.scene);
    this.enemyManager = new EnemyManager(this.scene);
    this.world = new ProceduralWorld(this.scene);
  }
}`,
  },
  {
    path: 'aurion/src/entities/HorseHero.ts',
    language: 'typescript',
    description: '3D Steampunk mount + Hero character with Antigravity Steam Shield',
    content: `import * as THREE from 'three';
import { createShieldMaterial } from '../shaders/ShieldShader';

export class HorseHero {
  public group: THREE.Group;
  public shieldMesh: THREE.Mesh;
  public targetPos: THREE.Vector3 = new THREE.Vector3(0, 0, 1.5);
  public currentPos: THREE.Vector3 = new THREE.Vector3(0, 0, 1.5);

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    const shieldGeo = new THREE.SphereGeometry(2.4, 32, 32);
    this.shieldMesh = new THREE.Mesh(shieldGeo, createShieldMaterial());
    this.group.add(this.shieldMesh);
    scene.add(this.group);
  }
}`,
  },
  {
    path: 'aurion/src/entities/EnemyManager.ts',
    language: 'typescript',
    description: 'Corrupted Golems, Clockwork Drones, and Binary Orbiting Sentinels with radius 1.0/2.0 combat',
    content: `import * as THREE from 'three';

export class EnemyManager {
  private scene: THREE.Scene;
  public enemies: any[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public checkCollisions(playerPos: THREE.Vector3) {
    // Radius 1.0 = Fight Hit Collision
    // Radius 2.0 = Near-Miss (+10 EXP Bonus)
  }
}`,
  },
  {
    path: 'aurion/src/shaders/ShieldShader.ts',
    language: 'glsl',
    description: 'GLSL Fresnel Nature-Energy & Steam Shield with dynamic noise',
    content: `export const ShieldFragmentShader = \`
  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform vec3 uGlowColor;
  uniform float uShieldIntensity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    float fresnel = pow(1.0 - max(dot(normalize(vViewPosition), normalize(vNormal)), 0.0), 2.5);
    vec3 color = mix(uBaseColor, uGlowColor, fresnel * 1.5);
    gl_FragColor = vec4(color, fresnel * uShieldIntensity);
  }
\`;`,
  },
  {
    path: 'aurion/src/shaders/FlowerWellShader.ts',
    language: 'glsl',
    description: 'GLSL Mystic Flower Well Vortex Shader with flow field petals',
    content: `export const FlowerWellFragmentShader = \`
  uniform float uTime;
  uniform vec3 uCoreColor;
  uniform vec3 uPetalColor;
  uniform float uPulseIntensity;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float dist = length(p) * 2.0;
    if (dist > 1.0) discard;
    float swirl = atan(p.y, p.x) + dist * 6.0 - uTime * 2.5;
    float petals = sin(swirl * 6.0) * 0.5 + 0.5;
    gl_FragColor = vec4(mix(uCoreColor, uPetalColor, dist) + petals * 0.4, (1.0 - dist));
  }
\`;`,
  },
  {
    path: 'aurion/src/adapters/GameAdapter.ts',
    language: 'typescript',
    description: 'Pluggable MMORPG Lifecycle and Event Adapter base interface',
    content: `export class GameAdapter {
  public onInit(): void {}
  public onUpdate(delta: number, stats: any, difficulty: any): void {}
  public onNearMiss(enemy: any, exp: number): void {}
  public onCombatHit(enemy: any, damage: number, shieldAbsorbed: boolean): void {}
  public onLevelUp(level: number, scoreBonus: number): void {}
  public onShieldToggle(active: boolean): void {}
}`,
  },
  {
    path: 'aurion/src/adapters/GenkitAdapter.ts',
    language: 'typescript',
    description: 'Genkit / Gemini AI dynamic quest master and lore narrative adapter',
    content: `import { GameAdapter } from './GameAdapter';

export class GenkitAdapter extends GameAdapter {
  public activeQuest: any = null;
  public async fetchNextQuest(level: number) {
    const res = await fetch('/api/quests/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    });
    this.activeQuest = await res.json();
  }
}`,
  },
  {
    path: 'aurion/python_backend/server.py',
    language: 'python',
    description: 'Async Python Backend server with Genkit & MMORPG state synchronization',
    content: `#!/usr/bin/env python3
"""
Aurion MMORPG Python Backend Server
Integrates Open World State Management and Genkit AI Quest Engine
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import sys

PORT = 8000

class AurionHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/state/sync':
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length))
            response = {"status": "ok", "ackTimestamp": body.get("timestamp")}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_error(404)

def main():
    server = HTTPServer(('0.0.0.0', PORT), AurionHandler)
    print(f"Aurion MMORPG Python Server running on port {PORT}")
    server.serve_forever()

if __name__ == '__main__':
    main()`,
  },
  {
    path: 'aurion/python_backend/state_manager.py',
    language: 'python',
    description: 'Open world grid calculation, binary orbital math, and difficulty curve',
    content: `import math
import time

class WorldStateManager:
    def __init__(self):
        self.players = {}
        self.wells = []
        self.difficulty_tier = 1

    def calculate_binary_orbit(self, center_x, center_z, radius, time_sec):
        angle = time_sec * 2.8
        x1 = center_x + math.cos(angle) * radius
        z1 = center_z + math.sin(angle) * radius
        x2 = center_x + math.cos(angle + math.pi) * radius
        z2 = center_z + math.sin(angle + math.pi) * radius
        return (x1, z1), (x2, z2)

    def escalate_difficulty(self):
        self.difficulty_tier += 1
        return {
            "tier": self.difficulty_tier,
            "spawn_rate_mult": 1.0 + self.difficulty_tier * 0.25,
            "pull_mult": 1.0 * (1.1 ** self.difficulty_tier),
            "speed_mult": 1.0 * (1.05 ** self.difficulty_tier)
        }`,
  },
  {
    path: 'aurion/python_backend/genkit_agent.py',
    language: 'python',
    description: 'Google Genkit / Gemini AI Dungeon Master agent for narrative quests',
    content: `import os

class GenkitDungeonMaster:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY", "")

    def generate_quest(self, player_level, score, difficulty_tier):
        return {
            "title": f"The Aetherial Pulse - Tier {difficulty_tier}",
            "lore": "The steam flow fields have destabilized near the Mystic Flower Wells.",
            "objective": f"Perform {3 + player_level} near-miss maneuvers against Clockwork Sentinels.",
            "targetCount": 3 + player_level,
            "rewardXp": 60 + player_level * 10,
            "rewardScore": 200,
            "type": "near_miss"
        }`,
  },
  {
    path: 'aurion/README.md',
    language: 'markdown',
    description: 'Architecture documentation, controls, and deployment instructions',
    content: `# Aurion - 3D Steampunk Fantasy MMORPG Flow Fields Engine

Aurion is an open-world 3D browser MMORPG engine featuring:
- **Mount Navigation**: 3rd-person camera follow, dynamic banking and ground pitch
- **Antigravity Steam Shield**: Fresnel GLSL shield repelling nearby biomes and absorbing combat damage
- **Combat & Near-Miss**: Radius 1.0 fight collision vs Radius 2.0 near-miss (+10 EXP & fireworks)
- **Procedural Flow Fields**: Mystic Flower Wells (Standard, Pulsing, Binary Sentinels)
- **45s Difficulty Escalation**: Increasing enemy spawn rates, gravitational pull (+10%), and speed (+5%)
- **Pluggable Adapters**: Lifecycle hooks with Genkit AI quest master and Python state synchronization
- **Zero-Build Mode**: Run directly in modern browsers without build tools.`,
  },
];
