# P0 measurements (stage 1)

Date: 2026-11-21. Method: Node scripts in `scripts/` (bundle with `npx rolldown <script> --platform node --format esm --file scripts/out/<name>.mjs`, then run). Only facts that were measured are written as facts. Everything else is marked **unmeasured**.

## 1. koicha-hokkaido

- TileJSON `https://stars.optgeo.org/bvmap-koicha-hokkaido`: tilejson 3.0.0, minzoom 4, maxzoom 16, bounds [135.0, 40.98, 157.5, 55.78], 24 layers (same names as bvmap).
- Tile `.../15/29250/12032`: `content-type: application/vnd.maplibre-tile` → **MLT**. Decoded with `@maplibre/mlt` 1.3.0. Layer `BldA` has `extent` 8192.
- `BldA`: minzoom 13, maxzoom 16. Fields: `vt_code`, `vt_lvorder` only. No id, no height.
- MapLibre GL JS 6.19.0 renders it with `encoding: 'mlt'` (657 `BldA` features rendered at z14 near Sapporo, in a visible pane).

## 2. overture-buildings

- TileJSON `https://stars.optgeo.org/overture_buildings`: minzoom 0, **maxzoom 14**, layers `building` (5–14) and `building_part` (8–14). Built by planetiler 0.10.2 (2026-03-28). Attribution: OpenStreetMap and Overture Maps Foundation.
- `building` fields: `id`, `height`, `min_height`, `num_floors`, `class`, `subtype`, `names`, `roof_*`, `facade_*`, `sources` (JSON string, includes `license`, `dataset`, `record_id`), `version`, and others.
- Tile format: MVT (`application/x-protobuf`), extent 4096.
- z15 tile request returns **404** (`15/29250/12032`). So z15–z16 need over-zooming from the z14 parent. MapLibre does this itself for display; our Worker must do it for computation.
- Tile size: z14 tiles in built-up areas are about 1.1–1.5 MB (gunzipped). 3,500–5,000 buildings per tile.
- **Tile edges** (2 z14 tiles, 2 locations: `14/14625/6016` and `14/14709/6025`, each with its east neighbour):
  - 342 of 3,553 and 439 of 5,012 features have vertices outside 0..extent. So tiles have a **buffer**.
  - 226 and 185 `id`s appear in **both** neighbouring tiles. So the same building can appear twice. Dedupe by `id` before counting.
  - Every feature had an `id`.
  - **Unmeasured:** whether buildings in the buffer are whole or clipped. Check by comparing the two copies of one `id`.

## 3. koicha vs official bvmap at the finest level (z16)

- GSI pmtiles header: minZoom 4, maxZoom 16, tileType 1 (MVT), gzip.
- `BldA` feature count, GSI pmtiles vs koicha, same z16 tile, 5 tiles (Sapporo ×2, Obihiro, Bibai area, Abashiri area): **equal in all 5** (`scripts/gsi-vs-koicha.mjs`).
- koicha vs `https://stars.optgeo.org/bvmap` (MVT, extent 4096, `BldA` minzoom 14, maxzoom 16, whole Japan), 4 tiles × 4 places = 16 tiles with buildings: same feature count, same total area, and each covers 100% of the other on a 512×512 raster (`scripts/compare-tiles.mjs`).
- Answer: **at z16, `BldA` in koicha and in bvmap are the same, as far as these 16–21 tiles show.** Coverage of the whole of Hokkaido is unmeasured.
- Note: koicha `BldA` starts at z13, official at z14. So koicha has `BldA` one zoom level earlier. Content at z13–z15 is **unmeasured** (we only compared z16).
- `vt_flag17` is not a field of `BldA`. It is not needed for buildings, as far as the TileJSON shows.

## 4. Overture vs official: fraction of Overture area covered by official

Measured on a 512×512 raster per z16 tile; Overture taken from the z14 ancestor. `overture⊂official` = share of Overture building pixels that are inside official building pixels. (`scripts/compare-tiles.mjs`)

| Place (z16 tile block of 2×2) | overture⊂official | official⊂overture |
|---|---|---|
| Sapporo centre | 0.82–0.93 | 0.83–0.88 |
| Obihiro | 0.76–0.88 | 0.84–0.92 |
| Bibai area | 0.83–0.95 | 0.77–0.85 |
| Abashiri area | 0.65–0.71 | 0.67–0.76 |

- Asahikawa edge (43.65, 142.46): no buildings in either source in the 4 tiles.
- These places were picked by hand; whether they are "rural" or "urban" was not checked. Do not read the table as urban vs rural.
- Reading: even where both sources describe the same buildings, the overlap is about 0.7–0.95, not 1. Position gaps and shape differences are real. A threshold of 0.5 on "fraction of an Overture building covered" is **plausible but not yet tested per building.** Stage 3 must measure per building, not per pixel.
- **Unmeasured:** per-building coverage distribution, and which Overture buildings are really missing from official (needs visual check by hfu).

## Other facts worth keeping

- Hidden browser pane → `requestAnimationFrame` stops → MapLibre style never finishes loading. Looks like a code bug but is not. Show the pane (`show_pane preview`) before testing.
- GeoParquet: not looked for in this stage. Not needed yet (§4.4 of the startup prompt).

## Niseko (added 2026-11-21, same method as section 4)

Chosen by hfu as the area to look at. Centres are approximate; each row is a 2×2 block of z16 tiles. (`scripts/compare-tiles.mjs`)

| Place | official BldA per tile | Overture in tile | overture⊂official | official⊂overture |
|---|---|---|---|---|
| Hirafu (42.8627, 140.6988) | 8–144 | 3–133 | 0.63–0.89 | 0.73–0.84 |
| Niseko station (42.8035, 140.6797) | 0–79 | 2–143 | **0.00–0.50** | 0.00–0.55 |
| Kutchan (42.9017, 140.7597) | 304–347 | 302–355 | 0.69–0.84 | 0.90–0.97 |
| Farmland west (42.83, 140.62) | 0–8 | 0–19 | 0.00–0.16 | 0.00–0.22 |

- Niseko station: in one tile the official layer has 79 buildings and Overture has 143. This is the clearest "official lacks buildings" case seen so far. The area ratio there is 0.30.
- In the farmland block most tiles have almost no buildings in either source.
- Check by eye in stage 2: the Overture-only buildings at Niseko station and Hirafu look like real buildings in the map view, but this has not been checked against imagery.
