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

`https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` (checked by curl: 200, `access-control-allow-origin: *`; tiles z16 and z18 answered). maxzoom set to 18. Building fills are translucent (opacity 0.6) so the photo shows through. Default off, to keep the first view simple (hfu asked for "not too much information"). Terms for the photo (GSI content terms) were not read; credit text is "国土地理院シームレス空中写真" with a link. To confirm with hfu.

## D12: Attribution of the computed layer (2026-11-21)

The Overture additions are a GeoJSON source. A hidden vector source shows no attribution, so the OSM/Overture text (copied from the Overture TileJSON) is set on the GeoJSON source itself. Checked in the page.

## D13: Overture appears only from zoom 15; position in the URL uses MapLibre's `hash: 'map'` (2026-11-21)

- hfu's concern: at shallow zooms, a layer that shows Overture buildings while the base map shows few buildings sends a wrong message. Measured: koicha `BldA` at z13–14 holds about 15–20% of z16's area (`p0-measurements.md`).
- Decision: the official layer stays on from zoom 13 (it is the official map's own depiction; the status line says it is thinned below 15). Overture additions and the "all Overture outlines" toggle start at zoom 15, where the official layer is complete and the computation runs. Below 13 no building layer is drawn.
- Not decided (hfu's call): hide the official `BldA` below 15 as well, so that no building appears until the data is complete. Current behaviour keeps what the official tiles contain.
- URL: `hash: 'map'` replaces the custom `lon/lat/z` parameters. Format: `#map=zoom/lat/lng`. Without a hash the map starts at Niseko station, zoom 16. Checked: the hash follows panning and the place buttons.
