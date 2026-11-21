# Reachability

Checked from the agent's shell (curl, Node fetch) on 2026-11-21. Not yet checked from the Chromebook.

| Host / URL | Result |
|---|---|
| `https://stars.optgeo.org/bvmap-koicha-hokkaido` (TileJSON) | 200, CORS echoes `Origin` |
| `https://stars.optgeo.org/bvmap` (TileJSON) | 200 |
| `https://stars.optgeo.org/overture_buildings` (TileJSON) | 200 |
| `https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles` | 200; range requests work (pmtiles client read header and tiles) |
| `https://docs.overturemaps.org/` | 200 |

Notes:

- stars sends `cache-control: max-age=14400` (4 hours). Right after a tile swap, old data may remain.
- CORS on stars reflects the `Origin` header. `curl` without `Origin` shows no CORS header. Test with `-H "Origin: ..."`.
- Not yet tested: browser `fetch` from `https://dwg7.unopengis.org/cvalda/` (the future Pages origin). Localhost worked.
- The URLs above were given by hfu in chat on 2026-11-21 (`bvmap-koicha-hokkaido`, `overture_buildings`, `bvmap`). hfu called the Overture one a "style.json", but it is a TileJSON (not a style).

Added 2026-11-21 (stage 3):

| Host / URL | Result |
|---|---|
| `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg` (z16, z18 tiles near Niseko) | 200, `image/jpeg`, `access-control-allow-origin: *`; also loaded in the page |

## After release 1 (checked 2026-11-21, once PR #1 was merged)

- Pages build for `main` (commit d940a36): status `built`. The earlier `errored` status on the Pages record was from the build before `docs/` existed.
- `http://dwg7.unopengis.org/cvalda/` and `https://dwg7.unopengis.org/cvalda/`: 200, 1,829,124 bytes, byte-identical to `docs/index.html`; no external `<script src>` or stylesheet link. `cache-control: max-age=600`.
- Opened in the Browser pane at `https://dwg7.unopengis.org/cvalda/#map=16/42.8035/140.6797`: the hash was kept, the status line showed 239 Overture buildings in view and 207 added, 88 official and 165 added features rendered, no console errors.
- From the page origin `https://dwg7.unopengis.org`, `fetch` returned 200 for: the koicha TileJSON and a koicha z16 tile, an Overture z14 tile, the published style, and a seamlessphoto tile. So **CORS works from the Pages origin** for all four hosts' resources used.
- The Browser pane was in the background, so `requestAnimationFrame` was stalled (`map.loaded()` stayed false). The data and rendered-feature counts above come from queries, not from looking at the screen. A look at the live page by hfu is still worth doing.
- The HTTPS certificate covers `dwg7.unopengis.org` (approved, expires 2027-02-03, from the Pages API). `https_enforced` is false.

## After release 2 (stage 4, PR #2 merged; checked 2026-11-21)

- Pages build for `main` (commit c4a5491): `built`. `https://dwg7.unopengis.org/cvalda/` returned 200, 1,831,826 bytes, byte-identical to `main:docs/index.html`.
- Opened in the Browser pane (visible, `requestAnimationFrame` running) at `https://dwg7.unopengis.org/cvalda/#map=17.2/42.804/140.684`: three mode radio buttons; no console errors.
- Mode 1: "Overture buildings in view: 576. Added: 481. … covers 95% or more: 9." Same numbers as the local run.
- Mode 2 (overlay): official and Overture features rendered, slider hidden.
- Mode 3: "GSI building pieces in view: 391. Added: 314. … covers 95% or more: 7." Same numbers as the local run.
- Rendered-feature counts differ from the local run (e.g. 58 vs 110 official) because the pane was a different size; the status-line counts, which cover the tiles of the view, match.
- Not looked at by eye in this check; no screenshot was taken of the live page.
