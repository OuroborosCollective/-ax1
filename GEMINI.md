# Echoes of Aurion — Gemini Instructions & Art Direction

## Core Art Direction
**Style:** Cinematic stylized 3D action adventure with a three-quarter isometric camera, weathered honey-stone, brushed bronze, midnight-petrol negative space, and purposeful Aurion-Türkis energy (`#00f0ff` / `#06b6d4` / `#14b8a6`). Characters have articulated silhouettes and real material distinction; nothing important reads as a simple cube.

### Palette & Materiality
- **Honey-stone & Weathered Sandstone**: Base ancient masonry, archways, and monuments (`#d4af37`, `#b8860b`, `#e6c687`, `#292524`).
- **Brushed Bronze**: Metallic trims, machinery, armors, and conduits (`#cd7f32`, `#a0522d`, `#8b5a2b`).
- **Midnight-Petrol Negative Space**: Rich deep void, dark skybox gradients, and backdrop depth (`#040d1a`, `#081a2e`, `#0a192f`).
- **Aurion-Türkis (Turquoise Energy)**: Aetherial glows, runes, particle vents, combat strikes, and leyline currents (`#00f0ff`, `#22d3ee`, `#06b6d4`, `#14b8a6`).

---

## Managed Visual Assets & References
| Asset | Managed Path / URL | Role |
| --- | --- | --- |
| **Aurion key art** | `/manus-storage/aurion-key-art_21dcbd0d.jpg` | Visual QA target and connection-gate panorama |
| **Ruin skybox** | `/manus-storage/aurion-ruin-skybox_e34b0508.jpg` | World-scale backdrop reference |
| **Celestial Sentinel** | `/manus-storage/aurion-sentinel_c61957b4.png` | Partner-link visual and enemy silhouette reference |
| **Aurion sigil** | `/manus-storage/aurion-sigil_e1fd1a34.png` | Header emblem, browser icon, and portal rune source |
| **Console detail** | `/manus-storage/aurion-console-detail_4ce4a515.jpg` | Subtle menu material surface |

---

## Open-World Asset Families & Triangle Budgets
| Familie | Weltfunktion | Browser-/Mobilvertrag | Umsetzung |
| --- | --- | --- | --- |
| **Turmportal & Rückkehrstein** | Übergang Turm → Aurion-Expanse | Max 2.500 Dreiecke, ein PBR-Atlas mit 1024² | Prozedurale Vorstufe, GLB-Katalogfreigabe |
| **Windhain-Kit** | Erste offene Zone | Höchstens 4 wiederkehrende Thin-Instance-Typen | Modulare Props & Vegetation |
| **Astralwisp** | Erste Gegnerfamilie | Max 1.200 Dreiecke, 24 Bones, Textur 512² | Prozedurale Vorstufe, GLB-Pipeline |
| **Runenwächter** | Elite & Questbegegnung | Max 4.000 Dreiecke, 48 Bones, Textur 1024² | GLB-Spezifikation vor Erzeugung |
| **Aschengewölbe-Torset** | Dungeonzugang | Max 3.500 Dreiecke, ein Atlas 1024² | Bronze-/Türkis-Architektur |

### Rigging & Animation Standard
Neue GLB-Charaktere erhalten PBR Metallic-Roughness, maximal vier Bone-Einflüsse pro Vertex und die getrennten Animations-Clips:
- `idle`
- `walk`
- `run`
- `hit`
- `attack_01`
- `cast_01`

---

## Expanse-Terrain- und Wegenetzmaterialien
| Oberfläche | Verwalteter Pfad | Mobilevertrag | Laufzeitzuweisung |
| --- | --- | --- | --- |
| **Gras** | `/manus-storage/aurion-terrain-grass_811245e1.png` | Wiederholbar, 1024², Chunk-Budget | Schwellen-Tiles |
| **Blumenwiese** | `/manus-storage/aurion-terrain-flower-meadow_c5078eb0.png` | Wiederholbar, 1024², keine Einzelblumen-Geometrie | Windhollow-Tiles |
| **Erde** | `/manus-storage/aurion-terrain-earth_f53862cb.png` | Wiederholbar, 1024², gebündelter Materialtyp | Emberfall-/Gewölbe-Tiles |
| **Acker** | `/manus-storage/aurion-terrain-farmland_2c4edf2e.png` | Wiederholbar, 1024², 20 Feld-Tiles im 8×8-Referenzchunk | Emberfall-Felder |
| **Gartenparzellen** | `/manus-storage/aurion-terrain-garden-parcels_8810616b.png` | Wiederholbar, 1024², 5 Garten-Tiles im 8×8-Referenzchunk | Emberfall-Gärten |
| **Sternenweg** | `/manus-storage/aurion-terrain-starpath_37c69d4b.png` | Wiederholbar, 1024², Thin Instances je Typ | Wegetiles |
| **Sternenweg-Kreuzung** | `/manus-storage/aurion-terrain-starpath-crossing_ead3a305.png` | Wiederholbar, 1024², eine Kreuzung im Referenzchunk | Kreuzungstile |

---

## Deployment & Production Runtime Architecture
- **Deploy Path:** `./deploy/` containing production schema reconcilers, Traefik configurations, Nginx rate-limiting, and runtime monitors.
- **Reverse Proxy:** Traefik on external network `areloria_arelorian-network` routing `Host(arelogic.space)` with Let's Encrypt TLS.
- **Port:** Container internal port `3000` with `/healthz` healthcheck.
- **Database Verification:** `verify-aurion-runtime-database.mjs` verifies readback against private MariaDB instance without leaking connection URLs.
