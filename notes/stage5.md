# Stage 5: export from the tiles in view (and a collapsible panel)

> **Correction (2026-11-22, `stage6.md`):** the exports described here could hold a building twice near tile edges (official: whole or partial copies from the tile buffer; Overture: copies cut at z14 edges). Stage 6 fuses them. "Known limits" below is superseded. Counts below are as measured then.

Date: 2026-11-21. Code: `src/export.ts`, `exportTile` in `src/fusion/compute.ts`, export message in `src/fusion.worker.ts`, UI in `src/main.ts` and `index.html`.

## What the reader gets

- Panel section "Export what you see": **GeoJSON** and **FlatGeobuf** buttons. Active from map zoom 15, when the view is within the tile limit (48 z16 tiles, the same limit as the view). Otherwise the status line says why.
- The export holds **what the current mode shows**, for **the z16 tiles that cover the view** (a little more than the view itself):

| Mode | Exported |
|---|---|
| 1. official first | all official pieces + Overture buildings with `covered_share` < threshold |
| 2. overlay | all official pieces + all Overture buildings (threshold not used) |
| 3. Overture first | all Overture buildings + official pieces with `covered_share` < threshold |

- Nothing goes to a server. The Worker rebuilds the tiles from its caches (`exportTile`), the page builds the file and starts the download.
- File name: `cvalda-<mode>-<lat>-<lon>.geojson|fgb`.
- Limit: 100,000 features per export (`EXPORT_MAX_FEATURES`). Above it, the status line asks to zoom in. **Not triggered in tests** (the largest export so far had 967 features).

## Properties of each feature

| Property | Official | Overture |
|---|---|---|
| `source` | `official` | `overture` |
| `id` | — (the official tiles carry none) | the Overture id |
| `height` | — | Overture `height`, when present |
| `datasets` | — | data set and licence recorded by Overture, e.g. `OpenStreetMap (ODbL-1.0)` (from the `sources` property) |
| `covered_share` | share covered by Overture | share covered by official |
| `credit` (FlatGeobuf only) | 国土地理院最適化ベクトルタイルを加工して作成 | © OpenStreetMap contributors, © Overture Maps Foundation (link) |

Official properties `vt_code` and `vt_lvorder` are **not** exported (the decoder drops them). Adding them is a small change if wanted.

## Credits in the files

- **GeoJSON:** the FeatureCollection has foreign members `attribution` (the GSI text taken from the published style's source, plus the Overture/OSM text), `note` (how it was made, the tile-edge cut, what `datasets` and `covered_share` mean), `parameters` (mode, threshold, zoom, centre, number of tiles, bbox of the tiles) and `generated` (time).
- **FlatGeobuf:** the library cannot set a header description, so each feature carries a `credit` column instead. A longer notice is not in this file type.
- **Open (hfu):** the wording of these notices is not confirmed (`licensing.md`, questions 1–3). The export keeps the Overture dataset/licence text per building so that nothing recorded by Overture is lost. This is a design choice, not a legal conclusion.

## Known limits of the exported data

- **Official buildings are cut at z16 tile edges** (the tiles cut them). One building can be two features. Stage 6 (re-joining) is the answer; not done.
- A feature near the view edge may belong to a tile that only partly lies in the view.
- Overture buildings are owned by one tile each (bbox centre), so no Overture building appears twice.
- `covered_share` can be `null` when the geometry could not be processed (not seen so far). Such buildings are kept in the supplement.

## Checked (local server, Browser pane visible, Niseko station, zoom 17.2, 4 tiles)

The downloads were captured in the page (the click was intercepted) and read back.

| Export | Features | Matches the page? |
|---|---|---|
| Mode 1, GeoJSON | 872 = 391 official + 481 Overture | yes: status "pieces 391", "Added: 481" |
| Mode 2, GeoJSON | 967 = 391 + 576 | yes: 576 Overture candidates in view |
| Mode 3, GeoJSON | 890 = 314 official + 576 Overture | yes: "Added: 314" |
| Mode 2, FlatGeobuf | 967 = 391 + 576, 260 KB | read back with the `flatgeobuf` reader (Node): same counts, all features carry `credit` |

- In modes 1 and 3, no supplementing feature had `covered_share` at or above the threshold (0 found).
- GeoJSON sample Overture properties: `{source, id, datasets: "OpenStreetMap (ODbL-1.0)", covered_share}`.
- The file written by the page was posted to a local one-shot receiver (`scripts/receive.mjs`) and read by `scripts/check-fgb.mjs`.
- **Not checked:** opening the files in QGIS or another GIS; the 100,000-feature limit; the "too many tiles" message; the real browser download dialog (clicks were intercepted); Safari/Firefox; a 4 GB Chromebook.

## Bugs found while testing, fixed

1. Tiles failed once with `TypeError: Failed to fetch` at load and were never retried. Now: up to 3 attempts with a short delay; a new view gives lost tiles a fresh set of attempts. The cause of the first failures was not found (a passing network error is likely).
2. In overlay mode the tile list was not built, so the export stayed disabled. The list is now built whenever the zoom is 15 or more; only the computation is skipped in overlay mode.

## Panel

- "Hide" / "Show" button in the panel header. The state is kept in `localStorage` (guarded; works without it). On a screen narrower than 600 px the panel starts hidden unless the reader chose before.
- Checked: the panel height went from 475 px to 38 px when hidden, `aria-expanded` follows, the setting is saved. Screenshot: `notes/img/stage5-panel-export.jpg`.
- Not checked: a real phone.
