# Decisions

Newest at the bottom. Each entry: what, why, and what is still unknown.

## D1: Toolchain and pinned versions (2026-11-21)

Vite 8.3.8, vite-plugin-singlefile 2.3.4, TypeScript 7.0.2, maplibre-gl 6.19.0, pmtiles 4.5.0. Dev-only for scripts: @maplibre/mlt 1.3.0, @mapbox/vector-tile 3.0.0, pbf 5.2.0. All pinned exactly in `package.json` and `package-lock.json`.

## D2: Single `docs/index.html`, MapLibre worker as an inlined blob (2026-11-21)

- Problem: MapLibre GL JS v6 builds its worker URL from `import.meta.url`. When bundled, that URL is wrong and the style never loads, with no error. (cafebabe `patterns/maplibre-gl-js-embedding.md`.) cafebabe's examples keep the worker as a separate file next to `index.html`.
- Decision: import the worker source with `?raw`, make a `Blob`, and call `maplibregl.setWorkerUrl(URL.createObjectURL(blob))`. This keeps one file. The worker is about 550 KB, so `index.html` is about 1.7 MB (463 KB gzip).
- Verified: built `docs/index.html` served from localhost in the Browser pane (visible); `BldA` features of koicha (MLT) rendered; no console errors. Not verified: GitHub Pages, Chromebook, Safari/Firefox.
- Fallback if this fails somewhere: put `maplibre-gl-worker.mjs` next to `index.html` and use `setWorkerUrl(new URL('maplibre-gl-worker.mjs', document.baseURI).href)` (dorayaki's way). This breaks "single file" and needs hfu's OK.
- Note: with maplibre-gl 6.x the import is `import * as maplibregl from 'maplibre-gl'` (no default export).

## D3: Our own Worker uses `?worker&inline` (2026-11-21)

Tested with a small ping/pong worker: build output has no `new Worker(new URL(...))`, and the worker answered in the browser (`pong:ping`). The probe was removed afterwards. cafebabe had no record of this combination (Vite `?worker&inline` + vite-plugin-singlefile). Real worker code (stage 3) is not tested yet.

## D4: No hashes in build output (2026-11-21)

`entryFileNames`, `chunkFileNames`, `assetFileNames` use plain names. In practice there is one file, `docs/index.html`, plus `.nojekyll` from `public/`.

## D5: LICENSE (2026-11-21)

The repository already had a `LICENSE` (CC0 1.0) from the initial commit. I did not add or change it. The startup prompt says to ask hfu before placing a licence. hfu confirmed on 2026-11-21: CC0 for the site content is intended.

## D6: Data sources (2026-11-21)

Base: `https://stars.optgeo.org/bvmap-koicha-hokkaido` (MLT). Supplement: `https://stars.optgeo.org/overture_buildings` (MVT, maxzoom 14). Reference for checks: `https://stars.optgeo.org/bvmap` and the GSI pmtiles. See `p0-measurements.md`.

## D7: Test area is Niseko (2026-11-21)

hfu chose Niseko as the area to look at in stages 2–3. A second, urban area (Sapporo centre) is still a good contrast; ask hfu if wanted.

## D8: Pages URL is `dwg7.unopengis.org/<repo>/` (2026-11-21)

hfu confirmed. The guide's `dwg7.opengis.org/guide` is not the form to use for cvalda. Expected URL: `https://dwg7.unopengis.org/cvalda/` (not yet published).

## D9: Coverage method and threshold (2026-11-21)

Per-building share of area covered by the union of official polygons (exact clipping). Buildings ≥ 0.95 are dropped in the worker; the rest carry `cov`. The threshold is a page-side filter, default **0.5**, range 5–95%. Reason: measured two-humped distribution; 0.5 is on the flat part (`stage3.md`). This is a measured default for three Niseko blocks, not a proven optimum. This is our own method; it does not copy the Rapid editor's overlap test (its algorithm is unconfirmed).

## D10: Fusion code runs in an inlined Worker (2026-11-21)

`src/fusion.worker.ts` via `?worker&inline`. Dependencies bundled into it: `@maplibre/mlt`, `@mapbox/vector-tile`, `pbf`, `polygon-clipping`. `index.html` grew from 1.69 MB to about 1.83 MB.

## D11: GSI aerial photo under the buildings, off by default (2026-11-21)

`https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` (checked by curl: 200, `access-control-allow-origin: *`; tiles z16 and z18 answered). maxzoom set to 18. Building fills are translucent (opacity 0.6) so the photo shows through. Default off, to keep the first view simple (hfu asked for "not too much information"). Terms read on 2026-11-21 (see `licensing.md`): credit-only for live loading; our credit text "国土地理院シームレス空中写真" with a link to the tile list page matches.

## D12: Attribution of the computed layer (2026-11-21)

The Overture additions are a GeoJSON source. A hidden vector source shows no attribution, so the OSM/Overture text (copied from the Overture TileJSON) is set on the GeoJSON source itself. Checked in the page.

## D13: Overture appears only from zoom 15; position in the URL uses MapLibre's `hash: 'map'` (2026-11-21)

- hfu's concern: at shallow zooms, a layer that shows Overture buildings while the base map shows few buildings sends a wrong message. Measured: koicha `BldA` at z13–14 holds about 15–20% of z16's area (`p0-measurements.md`).
- First step: Overture additions and the "all Overture outlines" toggle start at zoom 15.
- **hfu decided (2026-11-21): hide the official buildings below 15 as well.** No building layer (official, Overture, additions) is drawn below map zoom 15; the status line says "Zoom in to level 15 or more to see buildings." The thinned z13–14 official data stays unused.
- URL: `hash: 'map'` replaces the custom `lon/lat/z` parameters. Format: `#map=zoom/lat/lng`. Without a hash the map starts at Niseko station, zoom 16. Checked: the hash follows panning and the place buttons.

## D14: Three modes, origin colours (2026-11-21)

Mode 1 official + Overture where official has none (default), mode 2 overlay as published, mode 3 Overture + official where Overture has none. Official blue, Overture orange (Okabe-Ito); the overlap in mode 2 is the darker blend of the two translucent fills, not a third hue. Details and what is unchecked: `stage4.md`. The same slider threshold (default 50%) serves modes 1 and 3.

## D15: Mode 3 uses the same coverage function with the roles swapped (2026-11-21)

Official pieces versus all Overture buildings of the z14 ancestor. Official pieces cut at tile edges are judged separately. Measured on two blocks (`stage4.md`).

## D16: Export = what the mode shows, for the tiles that cover the view (2026-11-21)

See `stage5.md`. GeoJSON first, FlatGeobuf second (`flatgeobuf` 4.6.1, BSD-3-Clause). Per feature: `source`, Overture `id`, `datasets`, `covered_share`. Limit 100,000 features. The export reuses the Worker's caches; nothing is sent anywhere.

## D17: Credits in exports (2026-11-21)

GeoJSON: file-level `attribution`, `note`, `parameters`. FlatGeobuf: per-feature `credit` column. Wording still to be confirmed by hfu (`licensing.md`). Overture's own `sources` (dataset and licence) are kept per building as `datasets`.

## D18: Collapsible panel (2026-11-21)

Hide/Show button; state in `localStorage`; starts hidden below 600 px width unless the reader chose before.

## D19: Buildings at tile edges are fused, once, whole (2026-11-22)

Both the official tiles and the Overture z14 tiles carry buffers, so a building near an edge appears in two tiles, whole or cut. Official: overlapping parts from different tiles are fused; touching alone does not fuse (shared walls stay two). Overture: copies with the same `id` are fused, reading neighbouring z14 tiles when the z16 tile lies on a z14 edge. Each building is emitted by the tile that holds the centre of its box. Details and numbers: `stage6.md`. This corrects D9 (ownership rule, which used one copy) and the exports of D16.

## D20: Corrected earlier notes (2026-11-22)

Stages 4 and 5 notes got a correction box at the top. Released builds (PR #2, #3) carried the defect; the fix is in the stage 6 PR.
