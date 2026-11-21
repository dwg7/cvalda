# cvalda

A map viewer for Hokkaido. It shows buildings from the GSI vector tiles, and adds buildings from Overture Maps where the GSI data has none.

Status: early. The page has three modes: GSI buildings plus the Overture buildings GSI lacks, both sources overlaid, or Overture buildings plus the GSI buildings Overture lacks. A slider sets how much overlap counts as "covered". You can save what you see as GeoJSON or FlatGeobuf. The files carry the credits and, for Overture buildings, the data set and licence that Overture records.

## How it works

Everything is computed in your browser, from the tiles you are looking at. The browser does the merging, and no merged dataset is published.

## Data sources and credits

- Geospatial Information Authority of Japan (GSI) optimal bvmap vector tiles, and the GSI seamless aerial photo (optional layer). The base layer is a repacked copy served at `stars.optgeo.org`. *The exact credit wording is to be confirmed.*
- Overture Maps Foundation buildings. They include data from OpenStreetMap contributors (ODbL).

Please follow each source's terms. This page gives information only, and each reader decides how to use the data.

## Develop

```
npm install
npm run dev
npm run build   # writes docs/index.html
```

`docs/` is build output. Please do not edit it by hand.
