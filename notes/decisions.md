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

The repository already had a `LICENSE` (CC0 1.0) from the initial commit. I did not add or change it. The startup prompt says to ask hfu before placing a licence. **Open question for hfu:** is CC0 for this code intended?

## D6: Data sources (2026-11-21)

Base: `https://stars.optgeo.org/bvmap-koicha-hokkaido` (MLT). Supplement: `https://stars.optgeo.org/overture_buildings` (MVT, maxzoom 14). Reference for checks: `https://stars.optgeo.org/bvmap` and the GSI pmtiles. See `p0-measurements.md`.
