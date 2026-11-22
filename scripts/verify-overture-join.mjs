// Stage 6 check: Overture buildings across a z14 tile edge appear once and whole.
// Usage: node scripts/out/verify-overture-join.mjs <z16x of the last column of a z14 tile> <z16y first row>
import { exportTile } from '../src/fusion/compute.ts';
import { decodeOfficial, decodeOverture } from '../src/fusion/decode.ts';
const [x0, y0] = process.argv.slice(2).map(Number);
const memo = (f) => { const m = new Map(); return (...a) => { const k = a.join('/'); if (!m.has(k)) m.set(k, f(...a)); return m.get(k); }; };
const get = async (u) => { const r = await fetch(u); return r.status === 404 ? null : r.arrayBuffer(); };
const src = {
  overture: memo(async (tx, ty) => { const b = await get(`https://stars.optgeo.org/overture_buildings/14/${tx}/${ty}`); return b ? decodeOverture(b, tx, ty) : []; }),
  official: memo(async (x, y) => { const b = await get(`https://stars.optgeo.org/bvmap-koicha-hokkaido/16/${x}/${y}`); return b ? decodeOfficial(b, x, y) : []; }),
};
const ids = new Map(); let total = 0, ms = 0;
for (const x of [x0, x0 + 1]) for (const y of [y0, y0 + 1]) {
  const t0 = Date.now(); const t = await exportTile(x, y, src); ms += Date.now() - t0;
  for (const f of t.overture) { total++; ids.set(f.properties.id, (ids.get(f.properties.id) || 0) + 1); }
}
const dup = [...ids.values()].filter((n) => n > 1).length;
// raw ids present in both z14 tiles (what the old method could emit twice)
const A = await src.overture(x0 >> 2, y0 >> 2), B = await src.overture((x0 + 1) >> 2, y0 >> 2);
const inB = new Set(B.map((b) => b.id)); const shared = A.filter((a) => inB.has(a.id)).length;
// what the old rule (ancestor copy only, centre of that copy) would have emitted twice in this 2×2 block
const centre = (b) => { let a = 1e18, c = 1e18, d = -1e18, e = -1e18; for (const p of b.polys) for (const [px, py] of p[0]) { a = Math.min(a, px); d = Math.max(d, px); c = Math.min(c, py); e = Math.max(e, py); } return [((a + d) / 2) * 4, ((c + e) / 2) * 4]; };
const inBlock = ([cx, cy]) => cx >= x0 && cx < x0 + 2 && cy >= y0 && cy < y0 + 2;
const mapB = new Map(B.map((b) => [b.id, b]));
const oldDup = A.filter((a) => mapB.has(a.id) && inBlock(centre(a)) && inBlock(centre(mapB.get(a.id)))).length;
console.log(`old rule would have emitted ${oldDup} building(s) twice in this block`);
console.log(`z16 columns ${x0},${x0 + 1} rows ${y0},${y0 + 1}: emitted Overture buildings=${total}, distinct ids=${ids.size}, ids emitted more than once=${dup}; ids in both z14 tiles (raw)=${shared}; time ${ms} ms`);
