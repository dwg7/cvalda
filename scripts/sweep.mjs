// Stage 3 measurement: run the real fusion core over a block of z16 tiles and report
// how many Overture buildings are kept at each threshold. Usage: node scripts/out/sweep.mjs <lat> <lon> [n=2]
import { computeTile } from '../src/fusion/compute.ts';
import { decodeOfficial, decodeOverture } from '../src/fusion/decode.ts';

const [lat, lon, n = 2] = process.argv.slice(2).map(Number);
const tileOf = (lat, lon, z) => {
  const k = 2 ** z, r = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * k), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * k)];
};
const get = async (u) => { const r = await fetch(u); if (r.status === 404) return null; if (!r.ok) throw new Error(r.status + u); return r.arrayBuffer(); };
const memo = (f) => { const m = new Map(); return (...a) => { const k = a.join('/'); if (!m.has(k)) m.set(k, f(...a)); return m.get(k); }; };
const src = {
  overture: memo(async (tx, ty) => { const b = await get(`https://stars.optgeo.org/overture_buildings/14/${tx}/${ty}`); return b ? decodeOverture(b, tx, ty) : []; }),
  official: memo(async (x, y) => { const b = await get(`https://stars.optgeo.org/bvmap-koicha-hokkaido/16/${x}/${y}`); return b ? decodeOfficial(b, x, y) : []; }),
};
const [cx, cy] = tileOf(lat, lon, 16);
const feats = []; let cand = 0, dropped = 0, failed = 0, ms = 0, off = 0;
for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) {
  const r = await computeTile(cx + dx, cy + dy, src);
  feats.push(...r.features); cand += r.candidates; dropped += r.dropped; failed += r.failed; ms += r.ms; off += r.officialCount;
}
console.log(`# ${lat},${lon} z16 ${cx}/${cy} ${n}x${n} tiles: overture candidates=${cand}, official(3x3 incl.)~${off}, dropped(cov>=0.95)=${dropped}, failed=${failed}, compute ms total=${ms}`);
const ths = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95];
const row = {}; for (const t of ths) row[t] = feats.filter((f) => f.properties.cov < t).length + 0;
console.log('kept (added) when cov < threshold:', JSON.stringify(row));
const bins = new Array(10).fill(0); for (const f of feats) bins[Math.min(9, Math.floor(f.properties.cov * 10))]++;
console.log('histogram of cov (0.0-0.1 … 0.9-1.0), excl. >=0.95 dropped:', JSON.stringify(bins));
