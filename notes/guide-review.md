# Light review of github.com/dwg7/guide (read 2026-11-21)

Read: `AGENTS.md`, `README.md`, `CONTRIBUTIONS.md`, `docs/dwg7-in-5-minutes.md`, `docs/onboarding-paths.md`, `docs/good-first-experiments.md` (experiments 1–5), `docs/field-guide.md` (first 18 answers). `miso/` and the rest were not read. The pages carry a check date of 2026-11-11. Nothing was posted; this is a note for hfu. It stands in for contacting the guide agent (hfu's suggestion, because `guide` runs in the cloud).

## What cvalda takes from it

- The method: question → experiment → result with conditions → review and correction → reuse. cvalda's `notes/` already follows it. Keep **conditions beside every number** (done in `p0-measurements.md`).
- **Visible correction**, **open items stay open**: keep errors in the notes with the fix beside them, and keep an "unmeasured" list.
- **Care for shared resources** (field-guide #11): cvalda reads tiles from `stars.optgeo.org` only for the visible area. Keep it that way. Measurement scripts fetch a handful of tiles.
- Language rules in the guide's `AGENTS.md`: plain international English, **positive form** (say what something is and does), "dwg7" in lowercase. cvalda's README was reworded to follow this.
- Record: the guide treats `UNopenGIS/7` issues as the primary record. If hfu wants cvalda's findings in the record, a comment there is the route. The agent drafts it and does not post.

## Observations on the guide itself (for hfu to judge)

1. **Public URL differs between sources.** The guide says `https://dwg7.opengis.org/guide`. cafebabe's patterns and PROJECTS.md use `dwg7.unopengis.org/<repo>/`. hfu confirmed on 2026-11-21 that `dwg7.unopengis.org/<repo>/` is correct. cvalda's expected URL is `https://dwg7.unopengis.org/cvalda/`.
2. The guide asks for a `docs/_layouts` and Jekyll, with `.md` pages. cvalda's `docs/` is a Vite output with `.nojekyll`. That differs on purpose (single-file app), and the two kinds of repository need different notes on onboarding. The guide does not say how an app repository like cvalda should join (location, PROJECTS.md, Pages). **Questions for the guide agent, still unasked:** where do app repositories register, and is the Pages source `main:/docs` for them too?
3. `CONTRIBUTIONS.md` asks each experiment to be run by its author before it is added, with date and environment. cvalda has no experiment page yet. A candidate "good first experiment" from this project: repeat `scripts/compare-tiles.mjs` for another town and post the table. Not written; offered only as a suggestion.
4. The guide's claims carry check dates of 2026-11-11, ten days before this read. A fresh check of the issue counts was not done.
