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
