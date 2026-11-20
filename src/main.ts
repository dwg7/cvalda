import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre GL JS v6 builds its worker URL from import.meta.url, which breaks when
// bundled. We inline the worker source and hand MapLibre a blob URL instead.
// (See notes/decisions.md D2.)
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import './style.css';

const blob = new Blob([workerSource], { type: 'text/javascript' });
maplibregl.setWorkerUrl(URL.createObjectURL(blob));

// Stage 1 smoke test only: one source, to check that the worker decodes tiles.
// URLs were checked by curl on 2026-11-21; see notes/p0-measurements.md.
const map = new maplibregl.Map({
  container: 'map',
  center: [141.35, 43.06],
  zoom: 14,
  style: {
    version: 8,
    sources: {
      koicha: {
        type: 'vector',
        url: 'https://stars.optgeo.org/bvmap-koicha-hokkaido',
        encoding: 'mlt',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#f4f1ea' } },
      {
        id: 'bld',
        type: 'fill',
        source: 'koicha',
        'source-layer': 'BldA',
        paint: { 'fill-color': '#8a6d3b' },
      },
    ],
  },
});
map.addControl(new maplibregl.NavigationControl());
(window as unknown as { map: unknown }).map = map;

