# Stage 6: re-joining buildings cut at tile edges

Date: 2026-11-22. Code: `joinedOfficial`, `overtureAround` in `src/fusion/compute.ts`; `unionPolys`, `sharedArea` in `src/fusion/geom.ts`. Measurement and check scripts: `scripts/edge-cuts.mjs`, `edge-dups.mjs`, `verify-join.mjs`, `overture-copies.mjs`, `verify-overture-join.mjs`.

## What was found (measured, 2026-11-22)

**This is a correction to stages 3–5 as released.** Both sources had the same defect, and the earlier notes described it only as "cut at tile edges".

### Official (koicha, z16, extent 8192)

- The tiles have a **buffer**: pieces reach up to 160 of 8192 units (0.0195 tile) beyond their own tile, in all three places tried.
- A building near a tile edge is therefore in both tiles: **whole in both** (identical copies, 1.0–2.6% of pieces), or as **two overlapping parts**, each cut at the far end of its tile's buffer. 8–17% of pieces touch an edge (3×3 blocks at Kutchan, Niseko station, Sapporo centre).
- No piece was wider than half a tile.
- Effect on what was released: the "official pieces" in mode 3 and the official features in the exports counted such buildings twice. After fusing, the 3×3 blocks hold **12.7%, 17.9% and 14.6% fewer** buildings than raw pieces (1,513 → 1,321; 407 → 334; 2,595 → 2,217).
- In the page, Niseko station at zoom 17.2 (4 tiles): official buildings 391 → **325**; mode 3 "Added" 314 → **265**.

### Overture (z14, extent 4096)

- Buildings near a z14 tile edge are in both z14 tiles (same `id`). **40–60% of these copies differ** in shape: one or both are cut at the buffer end (relative area differences up to 99.9%). Examples: 226 ids in both tiles, 125 identical, 101 different (east edge of z14 14625/6016).
- The ownership rule "bounding-box centre of the copy" used a single copy. In a 2×2 block of z16 tiles along a z14 edge, the old rule would have emitted **116 and 63 buildings twice** (blocks 58503–58504 × 24065–24066 and × 24064–24065; computed by emulating the old rule on the raw tiles, `scripts/verify-overture-join.mjs`). Each copy was partial.
- Effect on what was released: along z14 tile edges, Overture buildings could show twice (as partial copies) in the page and in exports. Elsewhere, no effect. The numbers at Niseko station change little (576 → 575 in view).

## What the code does now

**Official, `joinedOfficial(x, y)`**
1. Own pieces that lie entirely at least 0.02 tile inside the tile are kept as they are.
2. Pieces within 0.02 of a tile edge ("near the edge") are collected from the tile and its 8 neighbours.
3. Near-edge pieces of **different tiles** that **overlap** (shared area above 1e-9 tile²) are grouped; touching alone does not group them, so two buildings with a shared wall stay two. Pieces of the same tile are never grouped.
4. Each group is fused with exact union. The tile that holds the centre of the fused building's box emits it, so every building comes out once.

**Overture, `overtureAround(x, y)`**
1. A z16 tile on the edge of its z14 tile (`x % 4` or `y % 4` is 0 or 3) also reads the neighbouring z14 tiles (up to 3).
2. Copies with the same `id` are fused (union), then scaled to z16 units; ownership by the centre of the fused box.
3. Worker cache for decoded z14 tiles raised from 6 to 12 (a tile on a corner needs 4).

Used in: computeTile (mode 3 supplement and the "buildings in view" count), exportTile (official and Overture features), and the Overture side of mode 1. The coverage test itself (union of official polygons) did not need the change.

## Checks

| Check | Result |
|---|---|
| 3×3 blocks, official: fused buildings whose box centre is outside their tile | 0 |
| Same blocks: pairs of emitted buildings from different tiles that still overlap | 0, 0, and **1** (Sapporo centre) |
| That one pair | a large building (fused across two tiles) and a small neighbouring building overlap by 0.04% of the small one's area: an overlap in the source data, not a join defect |
| Overture, two 2×2 blocks along a z14 edge: ids emitted more than once | 0 (1,260 and 1,017 buildings) |
| Page (local, Niseko station z17.2), overlay export | 325 official + 575 Overture, no repeated Overture id, `note` says parts are fused |
| Join time | 3×3 blocks: about 0.8–1.5 s for 9 tiles including fetch (Node) |

Re-run of the threshold sweep, other direction (official buildings that Overture covers by less than the threshold, 2×2 blocks):

| Block | official buildings | dropped ≥0.95 | <0.1 | <0.5 | <0.9 |
|---|---|---|---|---|---|
| Niseko station | 95 (was 121 "pieces") | 1 | 64 | 82 | 94 |
| Hirafu | 232 | 12 | 172 | 177 | 211 |
| Kutchan | 1,110 (was 1,268) | 631 | 107 | 122 | 240 |

The Overture-side tables of `stage3.md` do not change (those 2×2 blocks do not touch a z14 edge).

Corrected reading of `stage4.md`: at Niseko station, 64 of 95 official buildings (67%) have almost no Overture counterpart, not 82 of 121 (68%). The share is about the same; the counts were inflated.

## Not done / not measured

- **Display layer:** the official layer in the page is still drawn from the vector tiles by MapLibre, which does not show doubled buildings (it clips tiles when drawing). Not changed.
- Buildings wider than the 3×3 block (official) or spanning more than the read z14 tiles (Overture) may still come out in parts or twice. None found; the largest raw piece was under half a tile.
- Adjacent buildings that really overlap in the source data stay two (see the one pair above).
- No look at imagery to check that fused buildings look right.
- FlatGeobuf and GeoJSON files were checked in the page only for counts and repeated ids (overlay mode). Modes 1 and 3 exports were not re-read after the change.
- No Chromebook run; the larger Overture cache (12 tiles) was not measured for memory.
