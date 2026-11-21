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
- MapLibre v6 worker is inlined as a blob and passed to `setWorkerUrl` (D2). Own workers: `?worker&inline` (D3, D10).
- Fusion: per-building covered share, exact clipping, in a Worker; threshold is a page filter, default 0.5 (D9, `notes/stage3.md`).
- GSI aerial photo toggle, translucent fills (D11).
- Three modes with origin colours (D14, D15).
- Export (D16, D17): GeoJSON and FlatGeobuf of the tiles in view; collapsible panel (D18).
- No building layer below map zoom 15, because koicha `BldA` is thinned at z13–14 (D13; hfu decided). URL position: `hash: 'map'`.
- `import * as maplibregl from 'maplibre-gl'` (no default export in v6).
- LICENSE (CC0) pre-existed; hfu confirmed on 2026-11-21 that CC0 for the site content is intended (D5).

## Data (measured 2026-11-21; see `notes/p0-measurements.md`)

- Base: `https://stars.optgeo.org/bvmap-koicha-hokkaido`: MLT, z4–16, `BldA` z13–16, extent 8192, fields `vt_code`, `vt_lvorder`.
- Supplement: `https://stars.optgeo.org/overture_buildings`: MVT, **maxzoom 14** (z15+ is 404), layer `building`, extent 4096, has `id`, `height`, `sources`. Tiles have a buffer and the same `id` appears in neighbouring tiles. The code does not dedupe by `id`: a z16 tile owns the buildings whose bounding-box centre lies in it (D9, `notes/stage3.md`).
- Reference: `https://stars.optgeo.org/bvmap` (MVT, whole Japan), GSI pmtiles.
- At z16, koicha `BldA` equals official `BldA` in all tiles tested (21 tiles, 5 places).
- stars caches 4 hours. CORS reflects `Origin`.

## Gotchas

- **Test in a visible Browser pane.** A hidden pane stops `requestAnimationFrame`; MapLibre's style never finishes loading and it looks like a bug. Use `show_pane preview`.
- MapLibre v6 worker 404/silent failure when bundled: see D2.

## Status

- Stages 1–3 released: PR #1 merged; Pages live at `https://dwg7.unopengis.org/cvalda/` and checked (`notes/reachability.md`).
- Stage 4 (three modes): released (PR #2 merged); Pages checked (`notes/reachability.md`). Stage 5 (export in GeoJSON and FlatGeobuf, collapsible panel): released (PR #3 merged); Pages checked (`notes/reachability.md`). Stage 6 (re-joining at tile edges) not started; branch `claude/cvalda-stage6` is ready.
- cafebabe was consulted on 2026-11-21 (reply recorded in D2/D3). `guide`: not reachable (a cloud agent, per hfu). hfu asked for a light review of `github.com/dwg7/guide` instead; done in `notes/guide-review.md`. The onboarding questions in that note are still unasked.

## Open questions for hfu

1. GSI attribution wording; mixed-export licence notice (`notes/licensing.md`).
2. (Resolved 2026-11-21) GSI aerial photo credit: matches the tile list rules (`notes/licensing.md`).
3. Is a default threshold of 0.5 acceptable after you look at Niseko? (`notes/stage3.md`)

Decided: Pages URL form is `dwg7.unopengis.org/<repo>/` (D8).

Decided: test area for stage 2/3 is **Niseko** (hfu, 2026-11-21).
