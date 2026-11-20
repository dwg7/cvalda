# Stage 3: browser computation core

Date: 2026-11-21. Code: `src/fusion/{geom,decode,compute}.ts`, `src/fusion.worker.ts`, `src/main.ts`; measurement script `scripts/sweep.mjs`.

## Method (what the code does)

1. Working zoom is **z16**, the finest official zoom. Overture stops at z14, so each z16 tile reads its **z14 ancestor** and scales the coordinates (one z14 tile serves 16 z16 tiles).
2. A z16 tile owns the Overture buildings whose **bounding-box centre** lies in it. This avoids counting a building twice when it appears in two neighbouring z14 tiles (see `p0-measurements.md`, tile edges). Overture `id` is not used for de-duplication in code. A building that crosses a z14 edge is read from the z14 tile that holds its centre; if that copy is clipped at the buffer edge, its centre can shift slightly. Whether copies are clipped is **unmeasured**.
3. Official `BldA` polygons are read for the tile **and its 8 neighbours** (z16, MLT), so buildings across tile edges count.
4. For each Overture building: `coverage = area(building ∩ union(official polygons)) / area(building)`, with exact polygon clipping (`polygon-clipping` 0.15.7). Candidate official polygons come from a bounding-box test.
5. Buildings with coverage ≥ 0.95 are dropped in the worker (`KEEP_BELOW`). All others go to the page as GeoJSON with a `cov` property.
6. **The threshold lives in the page**, as a MapLibre filter on `cov`. Moving the slider recomputes nothing and takes effect at once.
7. If a geometry cannot be processed, the building is kept with `cov = 0` and counted as `failed` (0 in all runs so far).

## Limits and caches

| Item | Value | Where |
|---|---|---|
| Compute from map zoom | 15 | `COMPUTE_MIN_ZOOM` |
| z16 tiles per view | 48 (above this: ask the reader to zoom in) | `MAX_VIEW_TILES` |
| Overture buildings per z16 tile | 2,000 (above: tile skipped, shown in the status line) | `MAX_FEATURES_PER_TILE` |
| Decoded z14 Overture tiles in the worker | 6 | `OVERTURE_CACHE` |
| Decoded z16 official tiles in the worker | 160 | `OFFICIAL_CACHE` |
| Computed z16 tiles kept in the page | 240 | `MAX_RESULT_TILES` |

Observed per-tile Overture counts: 0–400 at z16 in all places tried. The 2,000 cap was **not reached**. Values above are first guesses; they have not been tuned on the Chromebook.

Tiles are fetched only for the visible area, nearest to the centre first. Failed tiles are not cached and are not retried until reload. Stale requests are not cancelled.

## Measured: effect of the threshold (`scripts/sweep.mjs`, the same core code run in Node)

2×2 blocks of z16 tiles. "Added" = Overture buildings with `cov` < threshold. Buildings with `cov` ≥ 0.95 were dropped before counting (shown separately).

| Block | Overture candidates | dropped (≥0.95) | 0.1 | 0.3 | 0.5 | 0.7 | 0.9 |
|---|---|---|---|---|---|---|---|
| Niseko station | 213 | 1 | 141 | 160 | 184 | 201 | 210 |
| Hirafu | 281 | 13 | 208 | 213 | 224 | 234 | 258 |
| Kutchan | 1,298 | 626 | 284 | 295 | 306 | 335 | 445 |

Histogram of `cov` in 0.1 bins (0.0–0.1 … 0.9–1.0; the last bin excludes ≥ 0.95):

- Niseko station: 141, 10, 9, 11, 13, 9, 8, 5, 4, 2
- Hirafu: 208, 2, 3, 6, 5, 2, 8, 10, 14, 10
- Kutchan: 284, 3, 8, 8, 3, 17, 12, 28, 82, 227

Reading (from these three blocks only):

- The distribution is **two-humped**: many buildings are almost uncovered (cov < 0.1), many are covered 0.8 and above, and few are in between.
- Between 0.1 and 0.6 the count changes slowly. Example, Kutchan: 284 at 0.1, 306 at 0.5. A threshold of 0.5 sits on this flat part. The choice between 0.3 and 0.6 changes the result by about 5–10% of the added buildings.
- Above 0.7 the count rises quickly (Kutchan: 335 at 0.7, 445 at 0.9). Those are mostly **twins** (same building, shifted footprint), so a high threshold brings back the slivers seen in stage 2.
- Not measured: which of the buildings with `cov` below 0.1 are real buildings missing from the official data. Overture contains buildings from several providers; some may be sheds, ghost or demolished buildings. hfu to judge visually; the aerial photo toggle helps.

Images (Niseko station, zoom 17.2, same view): `notes/img/stage3-niseko-thr20.jpg` (20%), `stage3-niseko-thr90.jpg` (90%), `stage3-niseko-thr50-photo.jpg` (50% with aerial photo). In the page: Added 417 at 20%, 481 at 50%, 555 at 90% of 576 Overture buildings in view (9 dropped as ≥95%).

## Consistency check

The in-browser count for the Niseko station view at zoom 16 (213 candidates, 184 added at 50%, 1 dropped) equals the Node run of the same core (213 / 184 / 1). Same code, so this checks wiring only. It does **not** test accuracy.

## Timing and memory

- Node, 4 tiles, including fetch of tiles and decoding: about 1.1 s total (4 tiles, cold). In the browser, the first view (4 tiles) finished in about 2.5 s after load.
- Page JS heap after the z15 view (main thread only): about 39–51 MB. The worker's memory was **not measured**. Real numbers on the 4 GB Chromebook are still needed (`chromebook-check.md`).

## Accuracy (not done)

- **No ground truth yet.** The startup prompt suggests DuckDB over GeoParquet. Whether Overture GeoParquet and a suitable official source are available for an exact join was **not checked**. The code computes exact polygon intersection, so the main error sources are the input data and the tile ownership rule (item 2), not the geometry arithmetic.
- Visual check by hfu in the Niseko page is the available check now.

## Known gaps

- No cancellation of old requests; fast panning at z15 can queue many tiles.
- Added features of tiles outside the view stay in the page until evicted (240 tiles).
- `building_part` is ignored. `is_underground` is ignored.
- The raw "All Overture outlines" toggle uses the vector tile directly (no computation).
- Tile edge: the sliver check at z16 tile corners was not done.
