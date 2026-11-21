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

## GSI aerial photo terms (read 2026-11-21, at hfu's request)

Sources read: the GSI tile list `https://maps.gsi.go.jp/development/ichiran.html` and the GSI terms page `https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html` (the page shows a revision date of 令和7年11月20日; the wording below is a summary, not a quote).

- `seamlessphoto` (全国最新写真（シームレス）, z14–18, `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg`) sits in the tile list's category **2: 基本測量成果以外で出典の記載のみで利用可能なもの** ("usable with a credit only").
- For tiles loaded live in a website or app, the page says the credit alone is enough and no application is needed. The credit is "国土地理院" or "地理院タイル" etc., **with a link to the tile list page**. Our layer shows "国土地理院シームレス空中写真" linked to that page, which matches.
- The notes for this tile mention an extra credit "GRUS画像（© Axelspace）" for a small area at about 20°N, 136°E. That area is outside Hokkaido, so it is not relevant to our views.
- The terms page says the site's content falls under **公共データ利用規約（第1.0版）(PDL1.0)**. It also asks users who edit or process content to state that they did so. hfu described the terms as 政府標準利用規約 / CC-BY equivalent. The terms page names PDL1.0, not 政府標準利用規約. That PDL1.0 is compatible with CC BY 4.0 is **not verified here** (not stated on the pages read).
- Our use shows the photo unedited, under translucent building fills. The koicha tiles are processed data and already carry the "加工して作成" statement in the style's attribution.
- Conclusion for the code: no change needed for the credit. (This is a reading of the pages, not legal advice.)
