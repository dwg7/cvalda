# Stage 2: light mode (no computation)

Date: 2026-11-21. Code: `src/main.ts`, `index.html`, `src/style.css`.

## What it does

- Loads hfu's published style `https://stars.optgeo.org/style/bvmap-koicha-starlight` at run time. Removes its 10 `BldA` layers. Adds, in the same place in the stack: Overture `building` (below), then official `BldA` (opaque, above).
- Both building layers start at map zoom 13 (koicha `BldA` starts at tile zoom 13). Below that, a hint is shown.
- Colours (Okabe-Ito, colour-blind safe): official blue `#0072B2`, Overture orange `#E69F00`. The overlap colour is not used yet: in this mode the official layer hides the overlap. Stage 4 will use a third colour.
- Legend with two toggles. Three place buttons: Hirafu, Niseko station, Kutchan (approximate centres).
- Attribution: the style source carries the GSI/bvmap-koicha text; the Overture TileJSON adds "© OpenStreetMap © Overture Maps Foundation". Both show in the MapLibre attribution control. The GSI text is hfu's published wording; whether it is the right wording is still open (`licensing.md`).
- Single `docs/index.html`, 1.69 MB. Top-level `await` is used in `main.ts` and builds fine.

## What was checked

Local server + visible Browser pane, maplibre-gl 6.19.0. Niseko station at z16: 34 official and 78 Overture features rendered, no console errors. Not checked: Pages, other browsers, touch devices, a narrow window (the legend panel is 260 px wide), the 4 GB Chromebook.

Screenshots: `notes/img/stage2-niseko-station-z16.jpg`, `stage2-niseko-station-z18.jpg`, `stage2-hirafu-z16.5.jpg`.

## Slivers (the thing to look at)

- **Orange slivers appear next to nearly every official building** where Overture has a twin that is shifted a little. At z18 (`stage2-niseko-station-z18.jpg`) each pair looks like one blue building with an orange edge or crescent on one side. A viewer can read a sliver as a second, thin building.
- Cause as seen: the footprints differ in position and shape. This matches the 0.7–0.95 coverage in `p0-measurements.md`. Layer order cannot fix it; the pixels outside the official polygon belong to Overture.
- Also seen: large Overture-only buildings (e.g. at Hirafu) show as complete orange shapes. Those are the target of the project.
- Not seen (and not looked for): hairline gaps at tile edges. Check at a z16 tile corner in the next pass.
- Consequence for stage 3: a per-building rule is needed ("drop an Overture building when ≥ threshold of its area is covered by official"). With the light mode alone, slivers stay. A threshold of 0.5 would remove the twins whose coverage is above 0.5; this needs measuring per building.

## Open

- hfu to look at Niseko in the page and say whether the slivers are acceptable for this stage, and whether the orange-only buildings are real.
- Dark mode of the page panel exists; the map itself stays light.
