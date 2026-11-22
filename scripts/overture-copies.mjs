// Stage 6 measurement: are the two copies of an Overture building (in neighbouring z14 tiles) the same shape or clipped?
// Usage: node scripts/out/overture-copies.mjs <z14x> <z14y>   (compares the tile with its east and south neighbours)
import { decodeOverture } from '../src/fusion/decode.ts';
import { polyArea } from '../src/fusion/geom.ts';
const [tx, ty] = process.argv.slice(2).map(Number);
const load = async (x, y) => { const r = await fetch(`https://stars.optgeo.org/overture_buildings/14/${x}/${y}`); return decodeOverture(await r.arrayBuffer(), x, y); };
const area = (b) => b.polys.reduce((s, p) => s + polyArea(p), 0);
const verts = (b) => b.polys.reduce((s, p) => s + p.reduce((q, r) => q + r.length, 0), 0);
const A = await load(tx, ty);
for (const [name, B] of [['east', await load(tx + 1, ty)], ['south', await load(tx, ty + 1)]]) {
  const m = new Map(B.map((b) => [b.id, b])); let both = 0, same = 0, clipped = 0, maxRel = 0;
  for (const a of A) { const b = m.get(a.id); if (!b) continue; both++; const ra = Math.abs(area(a) - area(b)) / Math.max(area(a), area(b)); maxRel = Math.max(maxRel, ra); if (ra < 1e-6 && verts(a) === verts(b)) same++; else clipped++; }
  console.log(`${name}: ids in both=${both}, same area and vertex count=${same}, differ=${clipped}, max relative area difference=${maxRel.toFixed(4)}`);
}
