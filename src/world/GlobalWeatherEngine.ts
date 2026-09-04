/**
 * GlobalWeatherEngine.ts
 *
 * Implements a globally synchronized, deterministic weather & Leyline cycle.
 *
 * All clients compute the identical weather state directly from synchronized Unix timestamps
 * without needing dedicated network packet broadcasts:
 * 1. Clear Radiance (Sonnig / Neutral)
 * 2. Leyline Tempest (Blitzsturm / +18% Elektro- & Arkan-Schaden)
 * 3. Aether Mist & Rain (Aetherregen / +15% Mana- & HP-Regeneration)
 * 4. Astral Eclipse (Sonnenfinsternis / +20% Schatten-Krit & verdoppelte Runenmacht)
 */

import * as THREE from 'three';

export type WeatherType = 'clear_radiance' | 'leyline_tempest' | 'aether_rain' | 'astral_eclipse';

export interface WeatherState {
  type: WeatherType;
  name: string;
  lore: string;
  ambientLightColor: number;
  ambientIntensity: number;
  fogDensity: number;
  fogColor: number;
  combatBuffDescription: string;
  damageMultiplierElectricArcane: number;
  regenMultiplier: number;
  critMultiplierShadow: number;
  timeRemainingSec: number;
}

export class GlobalWeatherEngine {
  private static instance: GlobalWeatherEngine | null = null;
  public static getInstance(): GlobalWeatherEngine {
    if (!GlobalWeatherEngine.instance) {
      GlobalWeatherEngine.instance = new GlobalWeatherEngine();
    }
    return GlobalWeatherEngine.instance;
  }

  // 300 seconds (5 minutes) per weather phase
  public readonly phaseDurationSec: number = 300;

  /**
   * Computes the current deterministic weather state based on current time.
   */
  public getCurrentWeather(nowMs: number = Date.now()): WeatherState {
    const totalSec = Math.floor(nowMs / 1000);
    const phaseIndex = Math.floor(totalSec / this.phaseDurationSec) % 4;
    const timeRemainingSec = this.phaseDurationSec - (totalSec % this.phaseDurationSec);

    switch (phaseIndex) {
      case 0:
        return {
          type: 'clear_radiance',
          name: 'Aurion-Sonnenglanz',
          lore: 'Reines goldenes Sonnenlicht über den Hochplateaus von Aethelgard.',
          ambientLightColor: 0xfff7ed,
          ambientIntensity: 0.95,
          fogDensity: 0.003,
          fogColor: 0xd4d4d8,
          combatBuffDescription: 'Standardbedingungen (+0% neutrale Resonanz)',
          damageMultiplierElectricArcane: 1.0,
          regenMultiplier: 1.0,
          critMultiplierShadow: 1.0,
          timeRemainingSec,
        };
      case 1:
        return {
          type: 'leyline_tempest',
          name: 'Leylinien-Sturm',
          lore: 'Türkise Aether-Blitze entladen sich aus den uralten Schmelzkern-Adern.',
          ambientLightColor: 0x06b6d4,
          ambientIntensity: 1.15,
          fogDensity: 0.007,
          fogColor: 0x083344,
          combatBuffDescription: '+18% Arkan- & Blitzschaden für alle Zaubernden',
          damageMultiplierElectricArcane: 1.18,
          regenMultiplier: 1.0,
          critMultiplierShadow: 1.0,
          timeRemainingSec,
        };
      case 2:
        return {
          type: 'aether_rain',
          name: 'Aetherregen & Flüstertau',
          lore: 'Smaragdfarbene Regenschauer aus verflüssigtem Mana nähren die Clockwork Woods.',
          ambientLightColor: 0x10b981,
          ambientIntensity: 0.85,
          fogDensity: 0.009,
          fogColor: 0x064e3b,
          combatBuffDescription: '+25% Lebens- und Ressourcenregeneration',
          damageMultiplierElectricArcane: 1.0,
          regenMultiplier: 1.25,
          critMultiplierShadow: 1.0,
          timeRemainingSec,
        };
      case 3:
      default:
        return {
          type: 'astral_eclipse',
          name: 'Astrale Sonnenfinsternis',
          lore: 'Der Himmel verdunkelt sich in mitternächtlichem Petrol und violetten Sternen.',
          ambientLightColor: 0x7c3aed,
          ambientIntensity: 0.65,
          fogDensity: 0.012,
          fogColor: 0x1e1b4b,
          combatBuffDescription: '+20% Kritische Trefferchance für Schattenschläge',
          damageMultiplierElectricArcane: 1.0,
          regenMultiplier: 1.0,
          critMultiplierShadow: 1.2,
          timeRemainingSec,
        };
    }
  }

  /**
   * Applies the current weather lighting and atmosphere to the Three.js scene.
   */
  public applyToScene(scene: THREE.Scene, ambientLight: THREE.AmbientLight, nowMs: number = Date.now()): WeatherState {
    const weather = this.getCurrentWeather(nowMs);

    ambientLight.color.setHex(weather.ambientLightColor);
    ambientLight.intensity = weather.ambientIntensity;

    if (scene.fog) {
      scene.fog.color.setHex(weather.fogColor);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.density = weather.fogDensity;
      }
    }

    return weather;
  }
}

export const globalWeather = GlobalWeatherEngine.getInstance();
