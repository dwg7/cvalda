# AGENTS.md — cvalda

Owner: hfu. Reports to hfu are in Japanese (polite). English text in the product (README, UI) is short, plain and polite. Commit messages are in English. Commit author email must be `18297+hfu@users.noreply.github.com` (never the form without the ID prefix).

## What this is

A browser viewer and exporter for Hokkaido. It fills gaps in GSI buildings (bvmap family) with Overture Maps buildings, **computed in the browser** from tiles. No pre-joined data is ever built or shipped (licence reasons: Overture buildings include OSM/ODbL; GSI data has its own attribution rules). Official data is the base; Overture only adds buildings that official data lacks.

The original startup prompt is in `notes/startup-prompt.md`. Read it for the stage plan (§6) and rules (§7).

## Rules

- Do not state unverified things as facts. Write "unmeasured" and how to check.
- Do not post to external services (GitHub issues/comments, mail, SNS). Draft for hfu.
- Do not guess URLs, layer names or fields. Use `notes/p0-measurements.md`.
- No legal conclusions. Only list questions (`notes/licensing.md`).
- Stop at the end of each stage and report. Move on only when hfu says so.
- `docs/` is build output only. Never edit by hand. Hand-written docs go in `README.md`, `AGENTS.md`, `notes/`.

## Build

```
npm install
npm run dev        # dev server
npm run build      # writes docs/index.html (single file, no hashes)
npm run preview    # serves docs/
npm run typecheck
```

Measurement scripts (not part of the build): `scripts/*.mjs`. Run with
`npx rolldown scripts/X.mjs --platform node --format esm --file scripts/out/X.mjs && node scripts/out/X.mjs ...`
(`@maplibre/mlt` cannot be imported by plain Node because of extension-less imports.)

## Decisions (details in `notes/decisions.md`)

- Pinned: Vite 8, vite-plugin-singlefile, MapLibre GL JS 6.19.0, pmtiles 4.5.0.
- MapLibre v6 worker is inlined as a blob and passed to `setWorkerUrl` (D2). Own workers: `?worker&inline` (D3).
- `import * as maplibregl from 'maplibre-gl'` (no default export in v6).
- LICENSE (CC0) pre-existed; hfu confirmed on 2026-11-21 that CC0 for the site content is intended (D5).

## Data (measured 2026-11-21; see `notes/p0-measurements.md`)

- Base: `https://stars.optgeo.org/bvmap-koicha-hokkaido`: MLT, z4–16, `BldA` z13–16, extent 8192, fields `vt_code`, `vt_lvorder`.
- Supplement: `https://stars.optgeo.org/overture_buildings`: MVT, **maxzoom 14** (z15+ is 404), layer `building`, extent 4096, has `id`, `height`, `sources`. Tiles have a buffer and the same `id` appears in neighbouring tiles → dedupe by `id`.
- Reference: `https://stars.optgeo.org/bvmap` (MVT, whole Japan), GSI pmtiles.
- At z16, koicha `BldA` equals official `BldA` in all tiles tested (21 tiles, 5 places).
- stars caches 4 hours. CORS reflects `Origin`.

## Gotchas

- **Test in a visible Browser pane.** A hidden pane stops `requestAnimationFrame`; MapLibre's style never finishes loading and it looks like a bug. Use `show_pane preview`.
- MapLibre v6 worker 404/silent failure when bundled: see D2.

## Status

- Stage 1: done except hfu's review (see report). Stage 2 not started.
- cafebabe was consulted on 2026-11-21 (reply recorded in D2/D3). `guide`: hfu renamed the session, but a retry on 2026-11-21 still failed (`SendMessage` to `guide`: "No agent named 'guide' is reachable"; not in `ListAgents` or the session list). **Not consulted yet.**

## Open questions for hfu

1. GSI attribution wording; mixed-export licence notice (`notes/licensing.md`).
2. `guide` session is not reachable (see Status).

Decided: test area for stage 2/3 is **Niseko** (hfu, 2026-11-21).
