import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre GL JS v6 builds its worker URL from import.meta.url, which breaks when
// bundled. We inline the worker source and hand MapLibre a blob URL instead.
// (See notes/decisions.md D2.)
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import FusionWorker from './fusion.worker.ts?worker&inline';
import type { Request, Response } from './fusion.worker';
import { KEEP_BELOW, MAX_FEATURES_PER_TILE, Z_COMPUTE, type ExportTile, type TileResult } from './fusion/compute';
import { build, download, EXPORT_MAX_FEATURES, select, type Format } from './export';
import './style.css';

maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));

// URLs were given by hfu and checked by curl (notes/reachability.md).
const STYLE_URL = 'https://stars.optgeo.org/style/bvmap-koicha-starlight';
const OVERTURE_URL = 'https://stars.optgeo.org/overture_buildings';
const PHOTO_URL = 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';
// Below 15 the official BldA is thinned (z13/z14 hold about 15–20% of the area of z16; z15 equals z16,
// see notes/p0-measurements.md). No building layer is drawn below 15 (D13), so a shallow view never
// shows a thinned official layer, or Overture buildings next to it.
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

let gsiCredit = '国土地理院最適化ベクトルタイルを加工して作成'; // replaced by the style's own text below

async function buildStyle(): Promise<maplibregl.StyleSpecification> {
  const style = (await (await fetch(STYLE_URL)).json()) as maplibregl.StyleSpecification;
  const sourceId = Object.keys(style.sources)[0];
  const own = (style.sources[sourceId] as { attribution?: string }).attribution;
  if (own) gsiCredit = own;
  const at = style.layers.findIndex(isBuilding);
  const rest = style.layers.filter((l) => !isBuilding(l));
  const fill = (id: string, source: string, color: string, extra: object = {}): Layer =>
    ({ id, type: 'fill', source, minzoom: COMPUTE_MIN_ZOOM, layout: { visibility: 'none' },
       paint: { 'fill-color': color, 'fill-opacity': FILL_OPACITY }, ...extra }) as Layer;
  const line = (id: string, source: string, color: string, extra: object = {}): Layer =>
    ({ id, type: 'line', source, minzoom: COMPUTE_MIN_ZOOM, layout: { visibility: 'none' },
       paint: { 'line-color': color, 'line-width': 0.8 }, ...extra }) as Layer;
  const cov = () => ({ filter: ['<', ['get', 'cov'], 0.5] });
  const mine: Layer[] = [
    { id: 'cvalda-photo', type: 'raster', source: 'photo', layout: { visibility: 'none' } },
    // Overture buildings that official does not cover (computed)
    fill('cvalda-added-fill', 'added', OVERTURE.fill, cov()),
    line('cvalda-added-line', 'added', OVERTURE.line, cov()),
    // all Overture buildings, as published
    fill('cvalda-overture-fill', 'overture', OVERTURE.fill, { 'source-layer': 'building' }),
    line('cvalda-overture-line', 'overture', OVERTURE.line, { 'source-layer': 'building' }),
    // official buildings that Overture does not cover (computed)
    fill('cvalda-extra-fill', 'official-extra', OFFICIAL.fill, cov()),
    line('cvalda-extra-line', 'official-extra', OFFICIAL.line, cov()),
    // all official buildings, as published
    fill('cvalda-official-fill', sourceId, OFFICIAL.fill, { 'source-layer': 'BldA' }),
    line('cvalda-official-line', sourceId, OFFICIAL.line, { 'source-layer': 'BldA' }),
  ];
  style.layers = [...rest.slice(0, at), ...mine, ...rest.slice(at)];
  style.sources.overture = { type: 'vector', url: OVERTURE_URL } as maplibregl.SourceSpecification;
  // Same text as the Overture TileJSON attribution (checked 2026-11-21). The GeoJSON source has to carry it
  // itself, because the vector source is hidden in the default mode and a hidden source shows no attribution.
  const empty = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
  style.sources.added = {
    type: 'geojson', data: empty,
    attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a> <a href="https://docs.overturemaps.org/attribution" target="_blank">© Overture Maps Foundation</a>',
  };
  style.sources['official-extra'] = { type: 'geojson', data: empty };
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

// ---------- modes, photo toggle, threshold ----------
type Mode = 'official-first' | 'overlay' | 'overture-first';
const LAYERS = {
  added: ['cvalda-added-fill', 'cvalda-added-line'],
  overture: ['cvalda-overture-fill', 'cvalda-overture-line'],
  extra: ['cvalda-extra-fill', 'cvalda-extra-line'],
  official: ['cvalda-official-fill', 'cvalda-official-line'],
};
const MODES: Record<Mode, { label: string; show: (keyof typeof LAYERS)[]; opacity: number; threshold: boolean; compute: boolean;
  legend: [string, string][]; sliderText: string }> = {
  'official-first': {
    label: 'Official, plus Overture where official has none', show: ['official', 'added'], opacity: 0.6, threshold: true, compute: true,
    legend: [['official', 'GSI building (official)'], ['overture', 'Overture building added']],
    sliderText: 'Add an Overture building when official covers less than',
  },
  overlay: {
    label: 'Overlay: both as published', show: ['official', 'overture'], opacity: 0.45, threshold: false, compute: false,
    legend: [['official', 'GSI building'], ['overture', 'Overture building'], ['both', 'Both overlap (darker)']],
    sliderText: '',
  },
  'overture-first': {
    label: 'Overture, plus official where Overture has none', show: ['overture', 'extra'], opacity: 0.6, threshold: true, compute: true,
    legend: [['overture', 'Overture building'], ['official', 'GSI building added']],
    sliderText: 'Add a GSI building when Overture covers less than',
  },
};
let mode: Mode = 'official-first';

const legendEl = document.getElementById('legend')!;
const sliderBox = document.getElementById('slider-box')!;
const sliderText = document.getElementById('slider-text')!;
function setMode(m: Mode) {
  mode = m;
  const cfg = MODES[m];
  const on = new Set(cfg.show.flatMap((k) => LAYERS[k]));
  for (const l of Object.values(LAYERS).flat()) {
    map.setLayoutProperty(l, 'visibility', on.has(l) ? 'visible' : 'none');
    if (l.endsWith('-fill')) map.setPaintProperty(l, 'fill-opacity', cfg.opacity);
  }
  legendEl.innerHTML = cfg.legend.map(([c, t]) => `<div class="row"><span class="swatch ${c}"></span>${t}</div>`).join('');
  sliderBox.style.display = cfg.threshold ? 'block' : 'none';
  sliderText.textContent = cfg.sliderText;
  updateTiles();
}
const modesEl = document.getElementById('modes')!;
for (const [id, cfg] of Object.entries(MODES)) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="radio" name="mode" value="${id}"${id === mode ? ' checked' : ''} /> ${cfg.label}`;
  label.querySelector('input')!.addEventListener('change', () => setMode(id as Mode));
  modesEl.appendChild(label);
}
document.getElementById('t-photo')!.addEventListener('change', (e) =>
  map.setLayoutProperty('cvalda-photo', 'visibility', (e.target as HTMLInputElement).checked ? 'visible' : 'none'));

let threshold = 0.5;
const thrInput = document.getElementById('thr') as HTMLInputElement;
const applyThreshold = () => {
  threshold = Number(thrInput.value) / 100;
  document.getElementById('thr-val')!.textContent = `${thrInput.value}%`;
  for (const l of [...LAYERS.added, ...LAYERS.extra]) map.setFilter(l, ['<', ['get', 'cov'], threshold]);
  showStatus();
};
thrInput.addEventListener('input', applyThreshold);

// ---------- computation in a Worker, cached per z16 tile ----------
const worker = new FusionWorker();
const results = new Map<string, TileResult>(); // insertion order = age
const pending = new Map<number, string>();
const failed = new Map<string, number>(); // tile → number of failed attempts
const MAX_ATTEMPTS = 3;
let seq = 0;
let viewKeys: string[] = [];
let lastNote = '';

const key = (x: number, y: number) => `${x}/${y}`;
const exportWaiters = new Map<number, { ok: (t: ExportTile) => void; fail: (m: string) => void }>();
worker.onmessage = (e: MessageEvent<Response>) => {
  const { id, result, error, exported } = e.data;
  const w = exportWaiters.get(id);
  if (w) {
    exportWaiters.delete(id);
    if (exported) w.ok(exported); else w.fail(error ?? 'failed');
    return;
  }
  const k = pending.get(id)!;
  pending.delete(id);
  if (result) {
    results.set(k, result);
    while (results.size > MAX_RESULT_TILES) results.delete(results.keys().next().value as string);
  } else {
    const n = (failed.get(k) ?? 0) + 1;
    failed.set(k, n);
    console.warn('tile failed', k, `attempt ${n}`, error);
    if (n < MAX_ATTEMPTS) window.setTimeout(updateTiles, 1500 * n); // try again; the cause is often a passing network error
  }
  scheduleRefresh();
};

let refreshTimer = 0;
const scheduleRefresh = () => {
  if (refreshTimer) return;
  refreshTimer = window.setTimeout(() => {
    refreshTimer = 0;
    const all = [...results.values()];
    (map.getSource('added') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: all.flatMap((r) => r.features) });
    (map.getSource('official-extra') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features: all.flatMap((r) => r.officialOnly) });
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
  if (map.getZoom() < COMPUTE_MIN_ZOOM) { statusEl.textContent = `Zoom in to level ${COMPUTE_MIN_ZOOM} or more to see buildings.`; return; }
  if (lastNote) { statusEl.textContent = lastNote; return; }
  if (!MODES[mode].compute) { statusEl.textContent = 'Both sources are drawn as published. Where they overlap, the colour is darker.'; return; }
  let done = 0, skipped = 0;
  const n = { cand: 0, dropped: 0, kept: 0, pieces: 0, pDropped: 0, pKept: 0 };
  for (const k of viewKeys) {
    const r = results.get(k);
    if (!r) continue;
    done++;
    n.cand += r.candidates; n.dropped += r.dropped; n.pieces += r.officialPieces; n.pDropped += r.officialDropped;
    if (r.skipped) skipped++;
    for (const f of r.features) if ((f.properties as { cov: number }).cov < threshold) n.kept++;
    for (const f of r.officialOnly) if ((f.properties as { cov: number }).cov < threshold) n.pKept++;
  }
  const lost = viewKeys.filter((k) => !results.has(k) && (failed.get(k) ?? 0) >= MAX_ATTEMPTS).length;
  const busy = viewKeys.length - done - lost;
  const pct = Math.round(KEEP_BELOW * 100);
  statusEl.textContent =
    `${busy > 0 ? `Computing… ${done}/${viewKeys.length} tiles. ` : ''}` +
    (mode === 'official-first'
      ? `Overture buildings in view: ${n.cand}. Added: ${n.kept}. Not added because official covers ${pct}% or more: ${n.dropped}.`
      : `GSI building pieces in view: ${n.pieces}. Added: ${n.pKept}. Not added because Overture covers ${pct}% or more: ${n.pDropped}.`) +
    (skipped ? ` ${skipped} tile(s) skipped: more than ${MAX_FEATURES_PER_TILE} buildings.` : '') +
    (lost ? ` ${lost} tile(s) failed to load. Pan the map to try again.` : '');
}

function updateTiles() {
  lastNote = '';
  viewKeys = [];
  if (map.getZoom() < COMPUTE_MIN_ZOOM) { showStatus(); return; }
  const b = map.getBounds();
  const x0 = lon2x(b.getWest()), x1 = lon2x(b.getEast()), y0 = lat2y(b.getNorth()), y1 = lat2y(b.getSouth());
  const n = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (n > MAX_VIEW_TILES) { lastNote = `The view holds ${n} tiles. Zoom in a little to compare the two sources (limit ${MAX_VIEW_TILES}).`; showStatus(); return; }
  const c = map.getCenter();
  const cx = lon2x(c.lng) + 0.5, cy = lat2y(c.lat) + 0.5;
  const todo: [number, number][] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const k = key(x, y);
    viewKeys.push(k);
    // The overlay mode needs no computation, but the tile list is still the unit of export.
    if (MODES[mode].compute && !results.has(k) && (failed.get(k) ?? 0) < MAX_ATTEMPTS && ![...pending.values()].includes(k)) todo.push([x, y]);
  }
  todo.sort((a, b2) => Math.hypot(a[0] + 0.5 - cx, a[1] + 0.5 - cy) - Math.hypot(b2[0] + 0.5 - cx, b2[1] + 0.5 - cy));
  for (const [x, y] of todo) {
    const id = ++seq;
    pending.set(id, key(x, y));
    worker.postMessage({ id, x, y } satisfies Request);
  }
  showStatus();
}
// A new view by the reader gives lost tiles a fresh set of attempts.
const onView = () => { for (const [k, n] of failed) if (n >= MAX_ATTEMPTS) failed.delete(k); updateTiles(); };
map.on('moveend', onView);
map.on('zoomend', onView);
// Layer properties can be set only after the style has loaded.
if (map.isStyleLoaded()) setMode(mode); else map.once('style.load', () => setMode(mode));

const places = document.getElementById('places')!;
for (const [name, [lon, lat, z]] of Object.entries(PLACES)) {
  const btn = document.createElement('button');
  btn.textContent = name;
  btn.addEventListener('click', () => map.jumpTo({ center: [lon, lat], zoom: z }));
  places.appendChild(btn);
}

// ---------- panel: hide / show ----------
const panel = document.getElementById('panel')!;
const toggle = document.getElementById('panel-toggle')!;
const store = {
  get: () => { try { return localStorage.getItem('cvalda-panel'); } catch { return null; } },
  set: (v: string) => { try { localStorage.setItem('cvalda-panel', v); } catch { /* storage can be blocked */ } },
};
const setCollapsed = (c: boolean) => {
  panel.classList.toggle('collapsed', c);
  toggle.textContent = c ? 'Show' : 'Hide';
  toggle.setAttribute('aria-expanded', String(!c));
};
// Start hidden on a narrow screen unless the reader chose otherwise before.
setCollapsed(store.get() ? store.get() === 'collapsed' : window.innerWidth < 600);
toggle.addEventListener('click', () => {
  const c = !panel.classList.contains('collapsed');
  setCollapsed(c);
  store.set(c ? 'collapsed' : 'open');
});

// ---------- export ----------
const exportStatus = document.getElementById('export-status')!;
const exportButtons = [document.getElementById('x-geojson') as HTMLButtonElement, document.getElementById('x-fgb') as HTMLButtonElement];
const exportable = () => map.getZoom() >= COMPUTE_MIN_ZOOM && viewKeys.length > 0 && !lastNote;
const refreshExport = () => {
  const ok = exportable();
  for (const b of exportButtons) b.disabled = !ok;
  if (!ok && !exportBusy) exportStatus.textContent = map.getZoom() < COMPUTE_MIN_ZOOM
    ? `Zoom in to level ${COMPUTE_MIN_ZOOM} or more to export.`
    : lastNote || 'Waiting for the tiles of this view.';
};
let exportBusy = false;
map.on('moveend', refreshExport);
map.on('zoomend', refreshExport);
setInterval(refreshExport, 1000);

const lonOf = (x: number) => (x / 2 ** Z_COMPUTE) * 360 - 180;
const latOf = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** Z_COMPUTE))) * 180) / Math.PI;

async function runExport(format: Format) {
  if (!exportable() || exportBusy) return;
  exportBusy = true;
  for (const b of exportButtons) b.disabled = true;
  try {
    const keys = [...viewKeys];
    exportStatus.textContent = `Preparing ${keys.length} tiles…`;
    const tiles = await Promise.all(keys.map((k) => new Promise<ExportTile>((ok, fail) => {
      const [x, y] = k.split('/').map(Number);
      const id = ++seq;
      exportWaiters.set(id, { ok, fail: (m) => fail(new Error(`${k}: ${m}`)) });
      worker.postMessage({ id, x, y, export: true } satisfies Request);
    })));
    const skipped = tiles.filter((t) => t.skipped).length;
    const features = select(mode, threshold, tiles);
    if (features.length > EXPORT_MAX_FEATURES) {
      exportStatus.textContent = `This view holds ${features.length} features. The limit is ${EXPORT_MAX_FEATURES}. Zoom in and try again.`;
      return;
    }
    const xs = keys.map((k) => Number(k.split('/')[0])), ys = keys.map((k) => Number(k.split('/')[1]));
    const c = map.getCenter();
    const { blob, ext } = build(features, {
      mode, threshold: MODES[mode].threshold ? threshold : null, zoom: Math.round(map.getZoom() * 100) / 100,
      center: [Math.round(c.lng * 1e5) / 1e5, Math.round(c.lat * 1e5) / 1e5], tiles: keys.length,
      bbox: [lonOf(Math.min(...xs)), latOf(Math.max(...ys) + 1), lonOf(Math.max(...xs) + 1), latOf(Math.min(...ys))],
    }, gsiCredit, format);
    const nOff = features.filter((f) => (f.properties as { source: string }).source === 'official').length;
    download(blob, `cvalda-${mode}-${c.lat.toFixed(4)}-${c.lng.toFixed(4)}.${ext}`);
    exportStatus.textContent = `Saved ${features.length} features (${nOff} GSI, ${features.length - nOff} Overture; ${(blob.size / 1024).toFixed(0)} KB).` +
      (skipped ? ` ${skipped} tile(s) were skipped: more than ${MAX_FEATURES_PER_TILE} buildings.` : '');
  } catch (err) {
    exportStatus.textContent = `Export failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    exportBusy = false;
    refreshExport();
  }
}
exportButtons[0].addEventListener('click', () => runExport('geojson'));
exportButtons[1].addEventListener('click', () => runExport('flatgeobuf'));
