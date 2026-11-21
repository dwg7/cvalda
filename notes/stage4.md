# Stage 4: three modes and origin colours

Date: 2026-11-21. Code: `src/main.ts` (modes), `src/fusion/compute.ts` (other direction), `index.html`, `src/style.css`.

## The modes

| Mode (radio button) | Drawn | Colours |
|---|---|---|
| 1. Official, plus Overture where official has none (default) | all official; Overture buildings with coverage below the threshold | official blue, Overture orange |
| 2. Overlay: both as published | all official and all Overture, no computation | blue and orange at 45% opacity; **overlap is darker teal-grey** |
| 3. Overture, plus official where Overture has none | all Overture; official building pieces that Overture covers by less than the threshold | orange and blue |

- Colours are the Okabe-Ito pair already used (blue `#0072B2`, orange `#E69F00`). The overlap colour is not a third hue: it is what the two translucent fills make where they cross (about `#86A89D`). **Not tested** with colour-vision simulation; hfu or a colour-blind reader should check it. If it fails, the fallback is the outline style (dashed for one source).
- The legend changes with the mode. The slider changes its wording with the mode and is hidden in mode 2.
- In mode 2 nothing is computed and no tile is requested from the Worker. The vector tiles are drawn as MapLibre normally draws them.
- Layer order (bottom → top): photo, added, Overture, official-extra, official. In mode 2 official is above Overture.
- Everything stays hidden below map zoom 15 (D13).

## Other direction (mode 3)

For each official building piece of a z16 tile, the Worker computes the share covered by the union of **all Overture buildings of the z14 ancestor**. Pieces covered 95% or more are dropped. Same function as mode 1 (`coveredShare`), the roles swapped.

- Official polygons are **cut at tile edges**, so a building crossing an edge is two pieces, each judged alone. The status line says "pieces". The effect on the result is **unmeasured**.
- The Worker now also returns these GeoJSON features, so memory per computed tile rose. `MAX_RESULT_TILES` stays 240; not re-measured on the Chromebook.

## Measured (`scripts/sweep.mjs`, 2×2 blocks of z16 tiles)

| Block | official pieces | dropped (≥0.95) | kept at <0.1 | <0.3 | <0.5 | <0.7 | <0.9 |
|---|---|---|---|---|---|---|---|
| Niseko station | 121 | 2 | 82 | 92 | 103 | 112 | 119 |
| Kutchan | 1,268 | 729 | 115 | 120 | 131 | 148 | 267 |

- Niseko station: 82 of 121 official pieces have almost no Overture counterpart (coverage < 0.1). That is not small. Candidates: buildings removed on the ground, Overture misses, or position gaps larger than a footprint. **Not checked against imagery.**
- Kutchan: the same two-humped shape as in the other direction (115 at 0.1, 131 at 0.5; 267 at 0.9).

## Checked in the page (local server, visible pane, Niseko station, zoom 17.2)

| Mode | Result |
|---|---|
| 1 | 110 official and 157 added features rendered; status "Overture buildings in view: 576. Added: 481 …" (same numbers as stage 3) |
| 2 | 110 official and 191 Overture features rendered; slider hidden; status says both are drawn as published |
| 3 | 132 official-extra and 191 Overture features rendered; status "GSI building pieces in view: 391. Added: 314 …" |

Screenshots: `notes/img/stage4-mode1-official-first.jpg`, `stage4-mode2-overlay.jpg`, `stage4-mode3-overture-first.jpg`.

Bug found and fixed while testing: calling `setLayoutProperty` before the style had loaded threw "Style is not done loading". The first mode is now set on `style.load`.

## Not done

- The mode is not stored in the URL. Only the map position is (`hash: 'map'`).
- No test on a narrow window; the panel is taller now (three radio buttons).
- No colour-vision check (see above).
- No Chromebook run (`chromebook-check.md`).
