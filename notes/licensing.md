# Licensing: points to settle (not legal conclusions)

I am not giving a legal conclusion here. These are the questions, with what the sources say.

## Facts seen in the data

- Overture `building` features carry `sources` with `license` and `provider` per record. In the tiles we looked at, the sample records were from OSM with `ODbL-1.0`. Other providers (Microsoft, Google, Esri) were not examined; their licences may differ. Unmeasured.
- The stars TileJSON for Overture gives this attribution: "© OpenStreetMap" and "© Overture Maps Foundation" (links to openstreetmap.org/copyright and docs.overturemaps.org/attribution).
- The koicha style in `bvmap-koicha` uses the attribution "国土地理院最適化ベクトルタイルを加工して作成" (per cafebabe's summary of that repository; I have not read the original file). The exact wording for GSI is **to confirm**.

## Questions for hfu

1. Exact attribution text for GSI data on screen and in exports (including the "processed" statement, 測量法 handling).
2. For an export that mixes GSI-derived and Overture/OSM-derived features: which licence notice goes in the file, and does a mixed file count as a "derived database" under ODbL? (This is why we compute in the browser and do not ship a pre-joined dataset.)
3. Whether each exported feature should keep Overture's `sources` string.

## Rule used in code until answered

Show both attributions on the map. Put a plain "source" field on every exported feature. Do not claim a licence for the exported file.

## Added in stage 3

- GSI aerial photo (seamlessphoto) is now an optional layer. Credit shown: 国土地理院シームレス空中写真, linked to maps.gsi.go.jp. The GSI terms of use for this tile set were not read. Question for hfu: is that credit text enough?
- The page now computes a derived view (Overture buildings not covered by GSI buildings). Nothing is saved. Stage 5 (export) is where the notice for a mixed file matters.
