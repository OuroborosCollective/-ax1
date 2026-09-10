import { AttributeBreakpoint, CharacterAttributes, WeaponMasteryPerk, WeaponType } from '../types';

export const ATTRIBUTE_BREAKPOINTS: Record<keyof CharacterAttributes, AttributeBreakpoint[]> = {
  strength: [
    {
      attribute: 'strength',
      threshold: 25,
      name: 'Wuchtiger Schlag (Heavy Impact)',
      icon: '💥',
      description: '+12% Melee-Cleave-Schaden und Taumel-Effekt gegen normale Gegner.',
    },
    {
      attribute: 'strength',
      threshold: 50,
      name: 'Kolossale Treffer (Colossus Blows)',
      icon: '⚔️',
      description: '+20% Multiplikator auf kritische Treffer.',
    },
    {
      attribute: 'strength',
      threshold: 75,
      name: 'Unaufhaltsame Kraft (Unstoppable Force)',
      icon: '🛡️',
      description: '8% Chance bei jedem Treffer, die Abklingzeit des nächsten Waffenskills sofort zurückzusetzen.',
    },
    {
      attribute: 'strength',
      threshold: 100,
      name: 'Titanen-Zorn (Titan\'s Wrath)',
      icon: '👑',
      description: '+25% gesamter physischer Schaden und Rüstungsdurchdringung um 15% erhöht.',
    },
  ],
  agility: [
    {
      attribute: 'agility',
      threshold: 25,
      name: 'Leichtfüßigkeit (Swift Step)',
      icon: '👟',
      description: '+8% Bewegungsgeschwindigkeit und schnellere Wendungen.',
    },
    {
      attribute: 'agility',
      threshold: 50,
      name: 'Akrobatische Erholung (Acrobatic Recovery)',
      icon: '🌀',
      description: 'Abklingzeit der Ausweichrolle (Dodge-Roll) um 35% reduziert und Ausdauerkosten um 30% gesenkt.',
    },
    {
      attribute: 'agility',
      threshold: 75,
      name: 'Phantom-Reflexe (Phantom Reflexes)',
      icon: '💨',
      description: '+10% passive Ausweichchance & I-Frames bei Ausweichrolle um 0.1s verlängert.',
    },
    {
      attribute: 'agility',
      threshold: 100,
      name: 'Temporaler Klingensturm (Temporal Flurry)',
      icon: '⚡',
      description: 'Combo-Decay-Zeitfenster um 1.5s verlängert und +15% Angriffsgeschwindigkeit.',
    },
  ],
  intelligence: [
    {
      attribute: 'intelligence',
      threshold: 25,
      name: 'Aether-Fluss (Aether Flow)',
      icon: '🔮',
      description: '+2.5 Mana/Ressourcen-Regeneration pro Sekunde im und außerhalb des Kampfes.',
    },
    {
      attribute: 'intelligence',
      threshold: 50,
      name: 'Elementare Resonanz (Elemental Resonance)',
      icon: '✨',
      description: '+25% Schaden bei elementaren Synergie-Kombos (Shatter, Firestorm, Chain Discharge).',
    },
    {
      attribute: 'intelligence',
      threshold: 75,
      name: 'Arkaner Konduktor (Arcane Conduit)',
      icon: '🌟',
      description: 'Ressourcenkosten aller Fertigkeiten um 20% reduziert.',
    },
    {
      attribute: 'intelligence',
      threshold: 100,
      name: 'Geist über Materie (Mind Over Matter)',
      icon: '🧠',
      description: '15% des erlittenen Schadens werden sofort in Klassenressource umgewandelt.',
    },
  ],
  defense: [
    {
      attribute: 'defense',
      threshold: 25,
      name: 'Eisenhaut (Ironhide)',
      icon: '🛡️',
      description: '+20 Rüstungswert und 5% Schadensreduktion gegen Flächenangriffe (AoE).',
    },
    {
      attribute: 'defense',
      threshold: 50,
      name: 'Vitale Regeneration (Vigorous Vitality)',
      icon: '💖',
      description: '+200 maximale Lebenspunkte und +5 HP Lebensregeneration pro Sekunde.',
    },
    {
      attribute: 'defense',
      threshold: 75,
      name: 'Bollwerk-Aegis (Bulwark Aegis)',
      icon: '🏰',
      description: 'Fällt die Gesundheit unter 30%, wird automatisch eine 250 HP Schutzbarriere für 6s erzeugt (60s CD).',
    },
    {
      attribute: 'defense',
      threshold: 100,
      name: 'Unbeugsamer Koloss (Unyielding Juggernaut)',
      icon: '🗿',
      description: 'Erlittene kritische Treffer werden um 50% abgemildert und -15% Gesamtschaden erlitten.',
    },
  ],
};

export const WEAPON_MASTERY_PERKS: Record<WeaponType, WeaponMasteryPerk[]> = {
  blade: [
    { id: 'blade_p1', weaponType: 'blade', name: 'Schnittschärfe (Razor Edge)', tier: 1, requiredMasteryLevel: 5, icon: '🗡️', description: '+8% Schwert- und Klingen-Schaden.', effectType: 'damage_mult', value: 0.08 },
    { id: 'blade_p2', weaponType: 'blade', name: 'Rüstungsspalter (Armor Cleave)', tier: 2, requiredMasteryLevel: 10, icon: '⚔️', description: 'Klingenschläge ignorieren 15% der gegnerischen Rüstung.', effectType: 'armor_penetration', value: 0.15 },
    { id: 'blade_p3', weaponType: 'blade', name: 'Klingen-Momentum (Blade Momentum)', tier: 3, requiredMasteryLevel: 15, icon: '🌪️', description: 'Nahkampf-Cleave-Winkel um 25° vergrößert.', effectType: 'cleave_radius', value: 0.25 },
    { id: 'blade_p4', weaponType: 'blade', name: 'Vampirischer Schnitt (Vampiric Slash)', tier: 4, requiredMasteryLevel: 20, icon: '🩸', description: '4% des ausgeteilten Schadens als Gesundheit heilen.', effectType: 'lifesteal', value: 0.04 },
    { id: 'blade_p5', weaponType: 'blade', name: 'Duellanten-Fokus (Duelist Focus)', tier: 5, requiredMasteryLevel: 25, icon: '🎯', description: '+12% Kritische Trefferchance mit Klingen.', effectType: 'crit_damage', value: 0.12 },
    { id: 'blade_p6', weaponType: 'blade', name: 'Aurion-Schwertmeister (Sword Saint)', tier: 6, requiredMasteryLevel: 30, icon: '👑', description: '+25% Schaden und Fertigkeiten kosten 20% weniger Ressource.', effectType: 'damage_mult', value: 0.25 },
  ],
  battleaxe: [
    { id: 'axe_p1', weaponType: 'battleaxe', name: 'Spaltaxt (Heavy Chop)', tier: 1, requiredMasteryLevel: 5, icon: '🪓', description: '+10% Wuchtschaden.', effectType: 'damage_mult', value: 0.10 },
    { id: 'axe_p2', weaponType: 'battleaxe', name: 'Blutender Spalt (Deep Rend)', tier: 2, requiredMasteryLevel: 10, icon: '🩸', description: 'Verursacht zusätzlichen Blutungsschaden über Zeit.', effectType: 'damage_mult', value: 0.12 },
    { id: 'axe_p3', weaponType: 'battleaxe', name: 'Breiter Schwung (Wide Cleave)', tier: 3, requiredMasteryLevel: 15, icon: '🪓', description: '+35% Trefferradius bei Schwüngen.', effectType: 'cleave_radius', value: 0.35 },
    { id: 'axe_p4', weaponType: 'battleaxe', name: 'Henkersschlag (Executioner)', tier: 4, requiredMasteryLevel: 20, icon: '💀', description: '+30% Schaden gegen Ziele unter 40% Gesundheit.', effectType: 'damage_mult', value: 0.30 },
    { id: 'axe_p5', weaponType: 'battleaxe', name: 'Zerschmetterer (Shattering Blow)', tier: 5, requiredMasteryLevel: 25, icon: '💥', description: '20% Rüstungsdurchdringung.', effectType: 'armor_penetration', value: 0.20 },
    { id: 'axe_p6', weaponType: 'battleaxe', name: 'Berserker-Raserei (Berserk Fury)', tier: 6, requiredMasteryLevel: 30, icon: '🔥', description: '+30% Schaden und 6% Lebensraub.', effectType: 'damage_mult', value: 0.30 },
  ],
  warhammer: [
    { id: 'hammer_p1', weaponType: 'warhammer', name: 'Wuchtstoß (Impact Force)', tier: 1, requiredMasteryLevel: 5, icon: '🔨', description: '+10% Wuchtschaden und Taumel-Chance.', effectType: 'damage_mult', value: 0.10 },
    { id: 'hammer_p2', weaponType: 'warhammer', name: 'Erdschock (Ground Tremor)', tier: 2, requiredMasteryLevel: 10, icon: '🌋', description: 'Hammer-Schläge treffen alle Feinde im 3.5m Radius.', effectType: 'cleave_radius', value: 0.30 },
    { id: 'hammer_p3', weaponType: 'warhammer', name: 'Panzerbrecher (Sunder Armor)', tier: 3, requiredMasteryLevel: 15, icon: '🛡️', description: 'Zerschmettert 25% gegnerische Rüstung.', effectType: 'armor_penetration', value: 0.25 },
    { id: 'hammer_p4', weaponType: 'warhammer', name: 'Schwere Trägheit (Heavy Momentum)', tier: 4, requiredMasteryLevel: 20, icon: '⚡', description: '+25% kritischer Hammerschaden.', effectType: 'crit_damage', value: 0.25 },
    { id: 'hammer_p5', weaponType: 'warhammer', name: 'Eisbrecher (Frost Shatterer)', tier: 5, requiredMasteryLevel: 25, icon: '❄️', description: 'Löst bei eingefrorenen Zielen 50% mehr Zerschmettern-Schaden aus.', effectType: 'elemental_potency', value: 0.50 },
    { id: 'hammer_p6', weaponType: 'warhammer', name: 'Titanenschlag (Titan Smasher)', tier: 6, requiredMasteryLevel: 30, icon: '💥', description: '+35% Hammerschaden & Schockwelle bei jedem 3. Treffer.', effectType: 'damage_mult', value: 0.35 },
  ],
  greatsword: [
    { id: 'gs_p1', weaponType: 'greatsword', name: 'Zweihand-Schwung (Great Swing)', tier: 1, requiredMasteryLevel: 5, icon: '🗡️', description: '+10% Zweihänder-Schaden.', effectType: 'damage_mult', value: 0.10 },
    { id: 'gs_p2', weaponType: 'greatsword', name: 'Wirbelklinge (Whirlwind Cleave)', tier: 2, requiredMasteryLevel: 10, icon: '🌪️', description: '+40% Trefferbogen vor dem Spieler.', effectType: 'cleave_radius', value: 0.40 },
    { id: 'gs_p3', weaponType: 'greatsword', name: 'Parierschlag (Parry Counter)', tier: 3, requiredMasteryLevel: 15, icon: '🛡️', description: '+5% Parade- und Ausweichchance.', effectType: 'damage_mult', value: 0.05 },
    { id: 'gs_p4', weaponType: 'greatsword', name: 'Vernichtender Hieb (Colossal Slam)', tier: 4, requiredMasteryLevel: 20, icon: '💥', description: '+25% Krit-Schaden.', effectType: 'crit_damage', value: 0.25 },
    { id: 'gs_p5', weaponType: 'greatsword', name: 'Stahlsturm (Steel Tempest)', tier: 5, requiredMasteryLevel: 25, icon: '⚔️', description: 'Abklingzeiten aller Großschwert-Skills um 20% verringert.', effectType: 'cooldown_reduc', value: 0.20 },
    { id: 'gs_p6', weaponType: 'greatsword', name: 'Klingenmeister (Grandmaster Blade)', tier: 6, requiredMasteryLevel: 30, icon: '👑', description: '+30% Gesamtschaden & 15% Rüstungsdurchschlag.', effectType: 'damage_mult', value: 0.30 },
  ],
  daggers: [
    { id: 'dag_p1', weaponType: 'daggers', name: 'Dolchspitze (Dagger Flurry)', tier: 1, requiredMasteryLevel: 5, icon: '🗡️', description: '+10% Angriffsgeschwindigkeit.', effectType: 'damage_mult', value: 0.10 },
    { id: 'dag_p2', weaponType: 'daggers', name: 'Giftklinge (Venomous Strike)', tier: 2, requiredMasteryLevel: 10, icon: '🧪', description: 'Schläge vergiften das Ziel für zusätzlichen Naturschaden.', effectType: 'damage_mult', value: 0.12 },
    { id: 'dag_p3', weaponType: 'daggers', name: 'Präziser Einstich (Backstab)', tier: 3, requiredMasteryLevel: 15, icon: '🎯', description: '+30% Krit-Schaden von hinten oder aus der Bewegung.', effectType: 'crit_damage', value: 0.30 },
    { id: 'dag_p4', weaponType: 'daggers', name: 'Schatten-Schritt (Shadow Step)', tier: 4, requiredMasteryLevel: 20, icon: '💨', description: '+8% Ausweichchance.', effectType: 'damage_mult', value: 0.08 },
    { id: 'dag_p5', weaponType: 'daggers', name: 'Lebensraub-Klingen (Leeching Daggers)', tier: 5, requiredMasteryLevel: 25, icon: '🩸', description: '6% Lebensraub bei jedem Dolchtreffer.', effectType: 'lifesteal', value: 0.06 },
    { id: 'dag_p6', weaponType: 'daggers', name: 'Schatten-Attentäter (Master Assassin)', tier: 6, requiredMasteryLevel: 30, icon: '💀', description: '+35% Krit-Schaden und 20% schnellere Combos.', effectType: 'crit_damage', value: 0.35 },
  ],
  arcane: [
    { id: 'arc_p1', weaponType: 'arcane', name: 'Aether-Resonanz (Aether Resonance)', tier: 1, requiredMasteryLevel: 5, icon: '✨', description: '+10% Arkan- & Zauberschaden.', effectType: 'damage_mult', value: 0.10 },
    { id: 'arc_p2', weaponType: 'arcane', name: 'Kettenblitz (Chain Overload)', tier: 2, requiredMasteryLevel: 10, icon: '⚡', description: 'Elektrizität springt automatisch auf 2 weitere Ziele über.', effectType: 'elemental_potency', value: 0.25 },
    { id: 'arc_p3', weaponType: 'arcane', name: 'Frostspaltung (Frost Shatter)', tier: 3, requiredMasteryLevel: 15, icon: '❄️', description: '+30% Schaden bei Frost-Shatter-Synergien.', effectType: 'elemental_potency', value: 0.30 },
    { id: 'arc_p4', weaponType: 'arcane', name: 'Astraler Fokus (Astral Focus)', tier: 4, requiredMasteryLevel: 20, icon: '🔮', description: 'Manakosten um 20% verringert.', effectType: 'resource_cost', value: 0.20 },
    { id: 'arc_p5', weaponType: 'arcane', name: 'Kritische Magie (Spell Surge)', tier: 5, requiredMasteryLevel: 25, icon: '🌟', description: '+25% Zauberkrit-Schaden.', effectType: 'crit_damage', value: 0.25 },
    { id: 'arc_p6', weaponType: 'arcane', name: 'Erzmagier von Aurion (Archmage Supreme)', tier: 6, requiredMasteryLevel: 30, icon: '🌌', description: '+35% gesamter Zauberschaden & +4 Mana/s.', effectType: 'damage_mult', value: 0.35 },
  ],
  staff: [
    { id: 'stf_p1', weaponType: 'staff', name: 'Stabfokus (Staff Focus)', tier: 1, requiredMasteryLevel: 5, icon: '🪄', description: '+8% Zauberkraft.', effectType: 'damage_mult', value: 0.08 },
    { id: 'stf_p2', weaponType: 'staff', name: 'Flächenzauber (Area Amplification)', tier: 2, requiredMasteryLevel: 10, icon: '🌀', description: '+25% AoE-Radius aller Zauber.', effectType: 'cleave_radius', value: 0.25 },
    { id: 'stf_p3', weaponType: 'staff', name: 'Manaschutz (Mana Ward)', tier: 3, requiredMasteryLevel: 15, icon: '🛡️', description: 'Erzeugt beim Zaubern ein 50 HP Schutzschild.', effectType: 'damage_mult', value: 0.05 },
    { id: 'stf_p4', weaponType: 'staff', name: 'Elementarsturm (Elemental Gale)', tier: 4, requiredMasteryLevel: 20, icon: '🌪️', description: '+20% Elementarschaden.', effectType: 'elemental_potency', value: 0.20 },
    { id: 'stf_p5', weaponType: 'staff', name: 'Schnellzauber (Quickcast)', tier: 5, requiredMasteryLevel: 25, icon: '⚡', description: 'Zauber-Abklingzeiten um 15% verkürzt.', effectType: 'cooldown_reduc', value: 0.15 },
    { id: 'stf_p6', weaponType: 'staff', name: 'Aurion-Sonnenszepter (Solar Scepter)', tier: 6, requiredMasteryLevel: 30, icon: '☀️', description: '+30% Zauberschaden und 25% Manaregeneration.', effectType: 'damage_mult', value: 0.30 },
  ],
  wand: [
    { id: 'wnd_p1', weaponType: 'wand', name: 'Zauberfunke (Spark Shot)', tier: 1, requiredMasteryLevel: 5, icon: '🪄', description: '+10% Zaubergeschwindigkeit mit Zauberstäben.', effectType: 'damage_mult', value: 0.10 },
    { id: 'wnd_p2', weaponType: 'wand', name: 'Arkaner Strahl (Arcane Beam)', tier: 2, requiredMasteryLevel: 10, icon: '✨', description: '+15% Durchschlagskraft.', effectType: 'armor_penetration', value: 0.15 },
    { id: 'wnd_p3', weaponType: 'wand', name: 'Schnelle Mana-Erholung (Mana Drain)', tier: 3, requiredMasteryLevel: 15, icon: '🔮', description: 'Treffer stellen 5 Mana wieder her.', effectType: 'resource_cost', value: 0.15 },
    { id: 'wnd_p4', weaponType: 'wand', name: 'Elementar-Präzision (Elemental Sniping)', tier: 4, requiredMasteryLevel: 20, icon: '🎯', description: '+20% Krit-Schaden bei Zaubern.', effectType: 'crit_damage', value: 0.20 },
    { id: 'wnd_p5', weaponType: 'wand', name: 'Überladung (Overcharge Surge)', tier: 5, requiredMasteryLevel: 25, icon: '⚡', description: '+25% Blitz- und Feuerschaden.', effectType: 'elemental_potency', value: 0.25 },
    { id: 'wnd_p6', weaponType: 'wand', name: 'Aether-Meisterstab (Wand Virtuoso)', tier: 6, requiredMasteryLevel: 30, icon: '🌟', description: '+30% Zauberschaden und sofortige Projektilflugzeit.', effectType: 'damage_mult', value: 0.30 },
  ],
  marksmanship: [
    { id: 'mrk_p1', weaponType: 'marksmanship', name: 'Präziser Schuss (Marksman Aim)', tier: 1, requiredMasteryLevel: 5, icon: '🎯', description: '+8% Fernkampf-Schaden.', effectType: 'damage_mult', value: 0.08 },
    { id: 'mrk_p2', weaponType: 'marksmanship', name: 'Durchbohrende Pfeile (Piercing Bolt)', tier: 2, requiredMasteryLevel: 10, icon: '🏹', description: 'Projektile durchschlagen 20% Rüstung.', effectType: 'armor_penetration', value: 0.20 },
    { id: 'mrk_p3', weaponType: 'marksmanship', name: 'Adlerauge (Eagle Eye)', tier: 3, requiredMasteryLevel: 15, icon: '🦅', description: '+10% Kritische Trefferchance auf Distanz.', effectType: 'crit_damage', value: 0.15 },
    { id: 'mrk_p4', weaponType: 'marksmanship', name: 'Rückzugschuss (Tactical Retreat)', tier: 4, requiredMasteryLevel: 20, icon: '💨', description: '+12% Bewegungsgeschwindigkeit nach Schüssen.', effectType: 'damage_mult', value: 0.08 },
    { id: 'mrk_p5', weaponType: 'marksmanship', name: 'Kopfschuss-Meister (Sniper Elite)', tier: 5, requiredMasteryLevel: 25, icon: '💀', description: '+35% Fernkampf-Krit-Schaden.', effectType: 'crit_damage', value: 0.35 },
    { id: 'mrk_p6', weaponType: 'marksmanship', name: 'Windläufer-Schütze (Windrunner Legend)', tier: 6, requiredMasteryLevel: 30, icon: '🏹', description: '+30% Gesamtschaden & Doppelschuss-Chance von 20%.', effectType: 'damage_mult', value: 0.30 },
  ],
  bow: [
    { id: 'bow_p1', weaponType: 'bow', name: 'Bogenspannung (Drawn Bowstring)', tier: 1, requiredMasteryLevel: 5, icon: '🏹', description: '+10% Bogenschaden.', effectType: 'damage_mult', value: 0.10 },
    { id: 'bow_p2', weaponType: 'bow', name: 'Pfeilregen (Rain of Arrows)', tier: 2, requiredMasteryLevel: 10, icon: '🌧️', description: '+25% Trefferradius bei Flächenschüssen.', effectType: 'cleave_radius', value: 0.25 },
    { id: 'bow_p3', weaponType: 'bow', name: 'Windpfeile (Zephyr Arrows)', tier: 3, requiredMasteryLevel: 15, icon: '💨', description: '+20% Projektil-Geschwindigkeit.', effectType: 'damage_mult', value: 0.10 },
    { id: 'bow_p4', weaponType: 'bow', name: 'Giftspitzen (Poison Tips)', tier: 4, requiredMasteryLevel: 20, icon: '🧪', description: 'Vergiftet getroffene Feinde.', effectType: 'damage_mult', value: 0.15 },
    { id: 'bow_p5', weaponType: 'bow', name: 'Falkenauge (Falcon Vision)', tier: 5, requiredMasteryLevel: 25, icon: '🦅', description: '+25% Krit-Schaden.', effectType: 'crit_damage', value: 0.25 },
    { id: 'bow_p6', weaponType: 'bow', name: 'Aurion-Sternenbogen (Celestial Bow)', tier: 6, requiredMasteryLevel: 30, icon: '✨', description: '+35% Gesamtschaden.', effectType: 'damage_mult', value: 0.35 },
  ],
  heavy_tech: [
    { id: 'tech_p1', weaponType: 'heavy_tech', name: 'Dampfdruck-Verstärker (Steam Booster)', tier: 1, requiredMasteryLevel: 5, icon: '⚙️', description: '+10% Dampf- und Kanonen-Schaden.', effectType: 'damage_mult', value: 0.10 },
    { id: 'tech_p2', weaponType: 'heavy_tech', name: 'Explosive Splitter (Shrapnel Core)', tier: 2, requiredMasteryLevel: 10, icon: '💣', description: '+30% Explosionsradius bei Kanonen und Granaten.', effectType: 'cleave_radius', value: 0.30 },
    { id: 'tech_p3', weaponType: 'heavy_tech', name: 'Hitzeableitung (Heat Sinks)', tier: 3, requiredMasteryLevel: 15, icon: '🔥', description: 'Klassen-Überhitzung und Ressourcenkosten um 25% reduziert.', effectType: 'resource_cost', value: 0.25 },
    { id: 'tech_p4', weaponType: 'heavy_tech', name: 'Belagerungsmodus (Siege Stance)', tier: 4, requiredMasteryLevel: 20, icon: '🛡️', description: '+20 Rüstung im Fernkampf.', effectType: 'damage_mult', value: 0.10 },
    { id: 'tech_p5', weaponType: 'heavy_tech', name: 'Geschütz-Optimierung (Turret Overdrive)', tier: 5, requiredMasteryLevel: 25, icon: '🤖', description: 'Aufgestellte Geschütze feuern 35% schneller.', effectType: 'damage_mult', value: 0.25 },
    { id: 'tech_p6', weaponType: 'heavy_tech', name: 'Großingenieur-Kern (Master Artificer)', tier: 6, requiredMasteryLevel: 30, icon: '⚡', description: '+35% Bombardierungs-Schaden & Schockwellen.', effectType: 'damage_mult', value: 0.35 },
  ],
  scythe: [
    { id: 'scy_p1', weaponType: 'scythe', name: 'Seelenschnitt (Soul Reaper)', tier: 1, requiredMasteryLevel: 5, icon: '🌾', description: '+10% Sensen-Schaden.', effectType: 'damage_mult', value: 0.10 },
    { id: 'scy_p2', weaponType: 'scythe', name: 'Kühlender Hauch (Frostbite Harvest)', tier: 2, requiredMasteryLevel: 10, icon: '❄️', description: 'Sensenschwünge kühlen Ziele und lösen Shatter aus.', effectType: 'elemental_potency', value: 0.25 },
    { id: 'scy_p3', weaponType: 'scythe', name: 'Seelenernte (Life Harvest)', tier: 3, requiredMasteryLevel: 15, icon: '🩸', description: '5% Lebensraub bei jedem Schwung.', effectType: 'lifesteal', value: 0.05 },
    { id: 'scy_p4', weaponType: 'scythe', name: 'Weite Schneise (Wide Sweep)', tier: 4, requiredMasteryLevel: 20, icon: '🌪️', description: '+45% Cleave-Radius.', effectType: 'cleave_radius', value: 0.45 },
    { id: 'scy_p5', weaponType: 'scythe', name: 'Todesurteil (Death Mark)', tier: 5, requiredMasteryLevel: 25, icon: '💀', description: '+30% Schaden gegen geschwächte Ziele.', effectType: 'damage_mult', value: 0.30 },
    { id: 'scy_p6', weaponType: 'scythe', name: 'Aurion-Todesbote (Reaper of Aurion)', tier: 6, requiredMasteryLevel: 30, icon: '👑', description: '+35% Schaden & 8% Lebensraub.', effectType: 'damage_mult', value: 0.35 },
  ],
  knuckles: [
    { id: 'knk_p1', weaponType: 'knuckles', name: 'Eisenfaust (Iron Fist)', tier: 1, requiredMasteryLevel: 5, icon: '🥊', description: '+10% Faustschaden.', effectType: 'damage_mult', value: 0.10 },
    { id: 'knk_p2', weaponType: 'knuckles', name: 'Schnellfeuer-Schläge (Flurry Strike)', tier: 2, requiredMasteryLevel: 10, icon: '⚡', description: '+20% Angriffsgeschwindigkeit und Combo-Aufbau.', effectType: 'damage_mult', value: 0.15 },
    { id: 'knk_p3', weaponType: 'knuckles', name: 'Betäubender Hieb (Stun Strike)', tier: 3, requiredMasteryLevel: 15, icon: '💥', description: '10% Chance, Feinde kurzzeitig zu taumeln.', effectType: 'damage_mult', value: 0.10 },
    { id: 'knk_p4', weaponType: 'knuckles', name: 'Kampffluss (Brawler Flow)', tier: 4, requiredMasteryLevel: 20, icon: '🌀', description: 'Ausweichrolle kostet keine Ausdauer nach 10 Combos.', effectType: 'cooldown_reduc', value: 0.25 },
    { id: 'knk_p5', weaponType: 'knuckles', name: 'Knochenbrecher (Bone Shatter)', tier: 5, requiredMasteryLevel: 25, icon: '🦴', description: '20% Rüstungsdurchschlag.', effectType: 'armor_penetration', value: 0.20 },
    { id: 'knk_p6', weaponType: 'knuckles', name: 'Drachenfaust (Dragon Fist Master)', tier: 6, requiredMasteryLevel: 30, icon: '🐉', description: '+35% Faustschaden und Schockwellen bei Krits.', effectType: 'damage_mult', value: 0.35 },
  ],
  spear: [
    { id: 'spr_p1', weaponType: 'spear', name: 'Lange Reichweite (Long Reach)', tier: 1, requiredMasteryLevel: 5, icon: '🗡️', description: '+2m Angriffsreichweite und +8% Schaden.', effectType: 'damage_mult', value: 0.08 },
    { id: 'spr_p2', weaponType: 'spear', name: 'Durchstoß (Armor Pierce)', tier: 2, requiredMasteryLevel: 10, icon: '🎯', description: 'Speerstöße ignorieren 20% Rüstung.', effectType: 'armor_penetration', value: 0.20 },
    { id: 'spr_p3', weaponType: 'spear', name: 'Linien-Stoß (Linear Thrust)', tier: 3, requiredMasteryLevel: 15, icon: '⚡', description: 'Trifft alle Feinde in einer geraden Linie.', effectType: 'cleave_radius', value: 0.30 },
    { id: 'spr_p4', weaponType: 'spear', name: 'Präziser Konter (Spear Counter)', tier: 4, requiredMasteryLevel: 20, icon: '🛡️', description: '+25% Krit-Schaden nach einer Ausweichrolle.', effectType: 'crit_damage', value: 0.25 },
    { id: 'spr_p5', weaponType: 'spear', name: 'Wirbelsturm (Whirlwind Spear)', tier: 5, requiredMasteryLevel: 25, icon: '🌪️', description: 'Rundumschlag trifft im 4m Umkreis.', effectType: 'cleave_radius', value: 0.40 },
    { id: 'spr_p6', weaponType: 'spear', name: 'Walküren-Speer (Valkyrie Lance)', tier: 6, requiredMasteryLevel: 30, icon: '👑', description: '+35% Schaden & 20% Rüstungsdurchdringung.', effectType: 'damage_mult', value: 0.35 },
  ],
};

/**
 * Mob Elemental Resistances & Vulnerabilities
 */
export interface MobElementalAffinity {
  physicalResist: number; // e.g. 0.85 (-15% taken), 1.25 (+25% taken = vulnerability)
  arcaneResist: number;
  fireResist: number;
  frostResist: number;
  electricResist: number;
  vulnerabilityLabel: string;
  resistanceLabel: string;
}

export const MOB_ELEMENTAL_AFFINITIES: Record<string, MobElementalAffinity> = {
  clockwork_stalker: {
    physicalResist: 0.85,  // Armored metal
    arcaneResist: 1.0,
    fireResist: 1.0,
    frostResist: 0.95,
    electricResist: 1.45, // Vulnerable to electric EMP shock
    vulnerabilityLabel: '⚡ Blitz / Schock (+45%)',
    resistanceLabel: '🛡️ Physisch (-15%)',
  },
  centurion_elite: {
    physicalResist: 0.75, // Heavy bronze armor
    arcaneResist: 0.9,
    fireResist: 1.1,
    frostResist: 0.9,
    electricResist: 1.5,  // Vulnerable to lightning
    vulnerabilityLabel: '⚡ Blitz / Schock (+50%)',
    resistanceLabel: '🛡️ Physische Panzerung (-25%)',
  },
  aether_wisp: {
    physicalResist: 1.40, // Fragile to heavy physical blunt impact
    arcaneResist: 0.65,  // High aether resistance
    fireResist: 1.15,
    frostResist: 1.15,
    electricResist: 0.75,
    vulnerabilityLabel: '⚔️ Physische Wucht (+40%)',
    resistanceLabel: '🔮 Arkan / Aether (-35%)',
  },
  corrupted_golem: {
    physicalResist: 0.80, // Dense rock
    arcaneResist: 1.10,
    fireResist: 0.70,   // Magma resistant
    frostResist: 1.45,  // Thermal shock vulnerability to ice/frost
    electricResist: 1.0,
    vulnerabilityLabel: '❄️ Frost / Shatter (+45%)',
    resistanceLabel: '🔥 Feuer & Stein (-30%)',
  },
  steam_drake: {
    physicalResist: 0.95,
    arcaneResist: 1.15,
    fireResist: 0.50,   // Fire immune/resistant
    frostResist: 1.55,  // Quenches fire organs
    electricResist: 1.10,
    vulnerabilityLabel: '❄️ Frost / Kälte (+55%)',
    resistanceLabel: '🔥 Feuer (-50%)',
  },
  titan_boss: {
    physicalResist: 0.85,
    arcaneResist: 0.85,
    fireResist: 0.85,
    frostResist: 0.85,
    electricResist: 1.30, // Vulnerable to synchronized electric discharges
    vulnerabilityLabel: '⚡ Synchron-Entladung (+30%)',
    resistanceLabel: '🛡️ Titanen-Aura (-15%)',
  },
};
