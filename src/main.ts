import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre GL JS v6 builds its worker URL from import.meta.url, which breaks when
// bundled. We inline the worker source and hand MapLibre a blob URL instead.
// (See notes/decisions.md D2.)
import workerSource from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';
import './style.css';

maplibregl.setWorkerUrl(URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' })));

// URLs were given by hfu and checked by curl on 2026-11-21 (notes/reachability.md).
const STYLE_URL = 'https://stars.optgeo.org/style/bvmap-koicha-starlight';
const OVERTURE_URL = 'https://stars.optgeo.org/overture_buildings';
// koicha BldA starts at tile zoom 13 (notes/p0-measurements.md). Draw both layers from the same zoom.
const MIN_ZOOM = 13;
// Okabe-Ito colours (colour-blind safe): blue for official, orange for Overture.
const OFFICIAL = { fill: '#0072b2', line: '#004b73' };
const OVERTURE = { fill: '#e69f00', line: '#8a5f00' };

// Approximate centres. Chosen from tile counts in notes/p0-measurements.md (Niseko section).
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
  // Insert our layers where the published building layers were, then remove those.
  const at = style.layers.findIndex(isBuilding);
  const rest = style.layers.filter((l) => !isBuilding(l));
  const mine: Layer[] = [
    {
      id: 'cvalda-overture-fill', type: 'fill', source: 'overture', 'source-layer': 'building',
      minzoom: MIN_ZOOM, paint: { 'fill-color': OVERTURE.fill },
    },
    {
      id: 'cvalda-overture-line', type: 'line', source: 'overture', 'source-layer': 'building',
      minzoom: MIN_ZOOM, paint: { 'line-color': OVERTURE.line, 'line-width': 0.6 },
    },
    {
      id: 'cvalda-official-fill', type: 'fill', source: sourceId, 'source-layer': 'BldA',
      minzoom: MIN_ZOOM, paint: { 'fill-color': OFFICIAL.fill, 'fill-opacity': 1, 'fill-antialias': false },
    },
    {
      id: 'cvalda-official-line', type: 'line', source: sourceId, 'source-layer': 'BldA',
      minzoom: MIN_ZOOM, paint: { 'line-color': OFFICIAL.line, 'line-width': 0.6 },
    },
  ];
  const before = style.layers.slice(0, at).filter((l) => !isBuilding(l)).length;
  style.layers = [...rest.slice(0, before), ...mine, ...rest.slice(before)];
  style.sources.overture = { type: 'vector', url: OVERTURE_URL } as maplibregl.SourceSpecification;
  return style;
}

const params = new URLSearchParams(location.hash.slice(1));
const start = PLACES['Niseko station'];
const map = new maplibregl.Map({
  container: 'map',
  style: await buildStyle(),
  center: [Number(params.get('lon')) || start[0], Number(params.get('lat')) || start[1]],
  zoom: Number(params.get('z')) || start[2],
  hash: false,
});
map.addControl(new maplibregl.NavigationControl());
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
(window as unknown as { map: unknown }).map = map;

const bind = (id: string, layers: string[]) => {
  document.getElementById(id)!.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).checked ? 'visible' : 'none';
    for (const l of layers) map.setLayoutProperty(l, 'visibility', v);
  });
};
bind('t-official', ['cvalda-official-fill', 'cvalda-official-line']);
bind('t-overture', ['cvalda-overture-fill', 'cvalda-overture-line']);

const hint = document.getElementById('zoomhint')!;
const updateHint = () => { hint.style.display = map.getZoom() < MIN_ZOOM ? 'block' : 'none'; };
map.on('zoom', updateHint);
updateHint();

const places = document.getElementById('places')!;
for (const [name, [lon, lat, z]] of Object.entries(PLACES)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.addEventListener('click', () => map.jumpTo({ center: [lon, lat], zoom: z }));
  places.appendChild(b);
}
