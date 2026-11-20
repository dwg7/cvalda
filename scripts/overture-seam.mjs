// P0 measurement: how Overture z14 tiles behave at tile edges (clipping, duplicates across tiles, buffer).
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';
import zlib from 'node:zlib';
const [z, x, y] = process.argv.slice(2).map(Number);
const load = async (tx, ty) => {
  const r = await fetch(`https://stars.optgeo.org/overture_buildings/${z}/${tx}/${ty}`);
  let b = Buffer.from(await r.arrayBuffer()); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
  const l = new VectorTile(new Pbf(b)).layers.building; const ext = l.extent; const feats = [];
  for (let i = 0; i < l.length; i++) {
    const f = l.feature(i); const g = f.loadGeometry(); let mn = [1e9, 1e9], mx = [-1e9, -1e9];
    for (const r of g) for (const p of r) { mn = [Math.min(mn[0], p.x), Math.min(mn[1], p.y)]; mx = [Math.max(mx[0], p.x), Math.max(mx[1], p.y)]; }
    feats.push({ id: f.properties.id, nVerts: g.reduce((s, r) => s + r.length, 0), mn, mx, sources: f.properties.sources });
  }
  return { ext, feats, bytes: b.length };
};
const A = await load(x, y), B = await load(x + 1, y);
const out = (f) => f.mn[0] < 0 || f.mn[1] < 0 || f.mx[0] > A.ext || f.mx[1] > A.ext;
console.log({ ext: A.ext, A_n: A.feats.length, B_n: B.feats.length, A_bytes: A.bytes, B_bytes: B.bytes });
console.log('features reaching outside 0..extent (buffer present):', A.feats.filter(out).length, 'of', A.feats.length);
const ids = new Set(A.feats.map((f) => f.id)); const dup = B.feats.filter((f) => ids.has(f.id));
console.log('ids present in both A and east neighbour B:', dup.length);
console.log('sample feature', JSON.stringify(A.feats[0]));
const nullId = A.feats.filter((f) => !f.id).length; console.log('features without id:', nullId);
const big = A.feats.slice().sort((a, b) => b.nVerts - a.nVerts)[0]; console.log('max verts', big.nVerts);
