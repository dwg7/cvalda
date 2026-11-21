import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre GL JS v6 builds its worker URL from import.meta.url, which breaks when
// bundled. We inline the worker source and hand MapLibre a blob URL instead.
// (See notes/decisions.md D2.)
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import FusionWorker from './fusion.worker.ts?worker&inline';
import type { Request, Response } from './fusion.worker';
import { KEEP_BELOW, MAX_FEATURES_PER_TILE, Z_COMPUTE, type TileResult } from './fusion/compute';
import './style.css';

maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));

// URLs were given by hfu and checked by curl (notes/reachability.md).
const STYLE_URL = 'https://stars.optgeo.org/style/bvmap-koicha-starlight';
const OVERTURE_URL = 'https://stars.optgeo.org/overture_buildings';
const PHOTO_URL = 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';
const MIN_ZOOM = 13; // koicha BldA starts at tile zoom 13 (TileJSON)
// Below 15 the official BldA is thinned (z13/z14 hold about 15–20% of the area of z16; z15 equals z16,
// see notes/p0-measurements.md). Overture additions are drawn and computed only from 15, so that a
// shallow view never shows Overture buildings next to an incomplete official layer.
const COMPUTE_MIN_ZOOM = 15;
const MAX_VIEW_TILES = 48; // z16 tiles per view; above this we ask the reader to zoom in
const MAX_RESULT_TILES = 240; // computed tiles kept in memory
const FILL_OPACITY = 0.6;
// Okabe-Ito colours (colour-blind safe): blue for official, orange for Overture.
const OFFICIAL = { fill: '#0072b2', line: '#004b73' };
const OVERTURE = { fill: '#e69f00', line: '#8a5f00' };

// Approximate centres chosen from tile counts in notes/p0-measurements.md (Niseko section).
const PLACES: Record<string, [number, number, number]> = {
  Hirafu: [140.6988, 42.8627, 16],
  'Niseko station': [140.6797, 42.8035, 16],
  Kutchan: [140.7597, 42.9017, 16],
};

type Layer = maplibregl.LayerSpecification;
const isBuilding = (l: Layer) => 'source-layer' in l && l['source-layer'] === 'BldA';

async function buildStyle(): Promise<maplibregl.StyleSpecification> {
  const style = (await (await fetch(STYLE_URL)).json()) as maplibregl.StyleSpecification;
  const sourceId = Object.keys(style.sources)[0];
  const at = style.layers.findIndex(isBuilding);
  const rest = style.layers.filter((l) => !isBuilding(l));
  const mine: Layer[] = [
    { id: 'cvalda-photo', type: 'raster', source: 'photo', layout: { visibility: 'none' } },
    { id: 'cvalda-added-fill', type: 'fill', source: 'added', minzoom: COMPUTE_MIN_ZOOM, filter: ['<', ['get', 'cov'], 0.5],
      paint: { 'fill-color': OVERTURE.fill, 'fill-opacity': FILL_OPACITY } },
    { id: 'cvalda-added-line', type: 'line', source: 'added', minzoom: COMPUTE_MIN_ZOOM, filter: ['<', ['get', 'cov'], 0.5],
      paint: { 'line-color': OVERTURE.line, 'line-width': 0.8 } },
    { id: 'cvalda-official-fill', type: 'fill', source: sourceId, 'source-layer': 'BldA', minzoom: MIN_ZOOM,
      paint: { 'fill-color': OFFICIAL.fill, 'fill-opacity': FILL_OPACITY } },
    { id: 'cvalda-official-line', type: 'line', source: sourceId, 'source-layer': 'BldA', minzoom: MIN_ZOOM,
      paint: { 'line-color': OFFICIAL.line, 'line-width': 0.8 } },
    { id: 'cvalda-raw-line', type: 'line', source: 'overture', 'source-layer': 'building', minzoom: COMPUTE_MIN_ZOOM,
      layout: { visibility: 'none' }, paint: { 'line-color': OVERTURE.line, 'line-width': 1, 'line-dasharray': [2, 2] } },
  ];
  style.layers = [...rest.slice(0, at), ...mine, ...rest.slice(at)];
  style.sources.overture = { type: 'vector', url: OVERTURE_URL } as maplibregl.SourceSpecification;
  // Same text as the Overture TileJSON attribution (checked 2026-11-21). The GeoJSON source has to carry it
  // itself, because the vector source is hidden by default and a hidden source shows no attribution.
  style.sources.added = {
    type: 'geojson', data: { type: 'FeatureCollection', features: [] },
    attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> <a href="https://docs.overturemaps.org/attribution" target="_blank">© Overture Maps Foundation</a>',
  };
  style.sources.photo = {
    type: 'raster', tiles: [PHOTO_URL], tileSize: 256, maxzoom: 18,
    attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>シームレス空中写真',
  };
  return style;
}

// Without a `#map=zoom/lat/lng` in the URL, the map starts at Niseko station (hfu's test area).
const start = PLACES['Niseko station'];
const map = new maplibregl.Map({
  container: 'map',
  style: await buildStyle(),
  center: [start[0], start[1]],
  zoom: start[2],
  hash: 'map',
});
map.addControl(new maplibregl.NavigationControl());
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
(window as unknown as { map: unknown }).map = map;

// ---------- layer toggles and threshold ----------
const setVis = (layers: string[], on: boolean) => { for (const l of layers) map.setLayoutProperty(l, 'visibility', on ? 'visible' : 'none'); };
const wire = (id: string, layers: string[]) =>
  document.getElementById(id)!.addEventListener('change', (e) => setVis(layers, (e.target as HTMLInputElement).checked));
wire('t-official', ['cvalda-official-fill', 'cvalda-official-line']);
wire('t-added', ['cvalda-added-fill', 'cvalda-added-line']);
wire('t-raw', ['cvalda-raw-line']);
wire('t-photo', ['cvalda-photo']);

let threshold = 0.5;
const thrInput = document.getElementById('thr') as HTMLInputElement;
const applyThreshold = () => {
  threshold = Number(thrInput.value) / 100;
  document.getElementById('thr-val')!.textContent = `${thrInput.value}%`;
  for (const l of ['cvalda-added-fill', 'cvalda-added-line']) map.setFilter(l, ['<', ['get', 'cov'], threshold]);
  showStatus();
};
thrInput.addEventListener('input', applyThreshold);

// ---------- computation in a Worker, cached per z16 tile ----------
const worker = new FusionWorker();
const results = new Map<string, TileResult>(); // insertion order = age
const pending = new Map<number, string>();
const failed = new Set<string>();
let seq = 0;
let viewKeys: string[] = [];
let lastNote = '';

const key = (x: number, y: number) => `${x}/${y}`;
worker.onmessage = (e: MessageEvent<Response>) => {
  const { id, result, error } = e.data;
  const k = pending.get(id)!;
  pending.delete(id);
  if (result) {
    results.set(k, result);
    while (results.size > MAX_RESULT_TILES) results.delete(results.keys().next().value as string);
  } else {
    failed.add(k);
    console.warn('tile failed', k, error);
  }
  scheduleRefresh();
};

let refreshTimer = 0;
const scheduleRefresh = () => {
  if (refreshTimer) return;
  refreshTimer = window.setTimeout(() => {
    refreshTimer = 0;
    const features = [...results.values()].flatMap((r) => r.features);
    (map.getSource('added') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features });
    showStatus();
  }, 150);
};

const lon2x = (lon: number) => Math.floor(((lon + 180) / 360) * 2 ** Z_COMPUTE);
const lat2y = (lat: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z_COMPUTE);
};

const statusEl = document.getElementById('status')!;
function showStatus() {
  if (map.getZoom() < MIN_ZOOM) { statusEl.textContent = `Zoom in to level ${MIN_ZOOM} or more to see buildings.`; return; }
  if (map.getZoom() < COMPUTE_MIN_ZOOM) { statusEl.textContent = `Official buildings are thinned at this zoom. Zoom in to level ${COMPUTE_MIN_ZOOM} or more to add Overture buildings.`; return; }
  if (lastNote) { statusEl.textContent = lastNote; return; }
  let done = 0, cand = 0, dropped = 0, kept = 0, skipped = 0;
  for (const k of viewKeys) {
    const r = results.get(k);
    if (!r) continue;
    done++;
    cand += r.candidates; dropped += r.dropped;
    if (r.skipped) skipped++;
    for (const f of r.features) if ((f.properties as { cov: number }).cov < threshold) kept++;
  }
  const busy = viewKeys.length - done - [...viewKeys].filter((k) => failed.has(k)).length;
  statusEl.textContent =
    `${busy > 0 ? `Computing… ${done}/${viewKeys.length} tiles. ` : ''}` +
    `Overture buildings in view: ${cand}. Added: ${kept}. Not added because official covers ${Math.round(KEEP_BELOW * 100)}% or more: ${dropped}.` +
    (skipped ? ` ${skipped} tile(s) skipped: more than ${MAX_FEATURES_PER_TILE} buildings.` : '') +
    (failed.size ? ` ${failed.size} tile(s) failed to load.` : '');
}

function updateTiles() {
  lastNote = '';
  viewKeys = [];
  if (map.getZoom() < COMPUTE_MIN_ZOOM) { showStatus(); return; }
  const b = map.getBounds();
  const x0 = lon2x(b.getWest()), x1 = lon2x(b.getEast()), y0 = lat2y(b.getNorth()), y1 = lat2y(b.getSouth());
  const n = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (n > MAX_VIEW_TILES) { lastNote = `The view holds ${n} tiles. Zoom in a little to add Overture buildings (limit ${MAX_VIEW_TILES}).`; showStatus(); return; }
  const c = map.getCenter();
  const cx = lon2x(c.lng) + 0.5, cy = lat2y(c.lat) + 0.5;
  const todo: [number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const k = key(x, y);
    viewKeys.push(k);
    if (!results.has(k) && !failed.has(k) && ![...pending.values()].includes(k)) todo.push([x, y]);
  }
  todo.sort((a, b2) => Math.hypot(a[0] + 0.5 - cx, a[1] + 0.5 - cy) - Math.hypot(b2[0] + 0.5 - cx, b2[1] + 0.5 - cy));
  for (const [x, y] of todo) {
    const id = ++seq;
    pending.set(id, key(x, y));
    worker.postMessage({ id, x, y } satisfies Request);
  }
  showStatus();
}
map.on('moveend', updateTiles);
map.on('zoomend', updateTiles);
updateTiles();

const places = document.getElementById('places')!;
for (const [name, [lon, lat, z]] of Object.entries(PLACES)) {
  const btn = document.createElement('button');
  btn.textContent = name;
  btn.addEventListener('click', () => map.jumpTo({ center: [lon, lat], zoom: z }));
  places.appendChild(btn);
}
