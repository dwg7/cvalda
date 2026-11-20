// Fetch one tile from each source and print building stats. Usage: node scripts/probe-tile.mjs z x y
import { decodeTile } from '@maplibre/mlt';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';
import zlib from 'node:zlib';

const [z, x, y] = process.argv.slice(2).map(Number);
const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) return { status: r.status };
  let b = Buffer.from(await r.arrayBuffer());
  const ce = r.headers.get('content-encoding');
  if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
  return { status: r.status, type: r.headers.get('content-type'), ce, bytes: b.length, buf: b };
};
const mvt = (buf) => {
  const t = new VectorTile(new Pbf(buf)); const out = {};
  for (const [n, l] of Object.entries(t.layers)) out[n] = { extent: l.extent, n: l.length };
  return { layers: out, t };
};
const ring = (g) => g;
const report = async (name, url, kind, layer) => {
  const r = await get(url);
  console.log(`\n## ${name} ${z}/${x}/${y}`, { status: r.status, type: r.type, ce: r.ce, bytes: r.bytes });
  if (!r.buf) return;
  if (kind === 'mlt') {
    const t = decodeTile(new Uint8Array(r.buf));
    const layers = t.layers ?? t;
    for (const l of layers) if (!layer || l.name === layer) console.log(' layer', l.name, 'extent', l.extent, 'features', l.features?.length, 'props', Object.keys(l.features?.[0]?.properties ?? {}), 'geom', l.features?.[0]?.geometry?.type);
  } else {
    const { layers } = mvt(r.buf);
    console.log(' layers', JSON.stringify(layers));
  }
};
await report('koicha-hokkaido', `https://stars.optgeo.org/bvmap-koicha-hokkaido/${z}/${x}/${y}`, 'mlt', 'BldA');
await report('stars-bvmap', `https://stars.optgeo.org/bvmap/${z}/${x}/${y}`, 'mvt');
await report('overture', `https://stars.optgeo.org/overture_buildings/${z}/${x}/${y}`, 'mvt');
