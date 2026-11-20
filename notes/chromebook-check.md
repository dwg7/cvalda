# 4 GB Chromebook check (for hfu)

Status: not done. The agent cannot do this. Steps below are a proposal.

1. Open the deployed page (or `npm run preview` output) in Chrome on the Chromebook.
2. Open Chrome Task Manager (`Search + Esc`). Note the memory of the tab and of the GPU process.
3. Go to Sapporo centre at zoom 16. Wait 30 s. Note memory.
4. Pan around for 2 minutes. Note peak memory and whether the page freezes (a freeze longer than 1 s counts).
5. From stage 3 on: switch on the Overture supplement and repeat 3 and 4.
6. Write results in this file: date, device model, Chrome version, numbers.

Why: Overture z14 tiles are 1–1.5 MB each and hold 3,500–5,000 buildings (see `p0-measurements.md`). Several of them at once may be heavy.
