// Stage 6 check: re-joined official buildings of a block of z16 tiles.
// Usage: node scripts/out/verify-join.mjs <lat> <lon> [n=3]
import { joinedOfficial } from '../src/fusion/compute.ts';
import { decodeOfficial } from '../src/fusion/decode.ts';
import { polyArea, polyBBox, sharedArea } from '../src/fusion/geom.ts';
const [lat, lon, n = 3] = process.argv.slice(2).map(Number);
const r = (lat * Math.PI) / 180;
const cx = Math.floor(((lon + 180) / 360) * 65536), cy = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 65536);
const memo = new Map();
const src = { official: (x, y) => { const k = `${x}/${y}`; if (!memo.has(k)) memo.set(k, fetch(`https://stars.optgeo.org/bvmap-koicha-hokkaido/16/${x}/${y}`).then(async (res) => (res.status === 404 ? [] : decodeOfficial(await res.arrayBuffer(), x, y)))); return memo.get(k); }, overture: async () => [] };
let raw = 0, rawArea = 0, joined = 0, joinedArea = 0, centreOutside = 0, ms = 0; const emitted = [];
for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) {
  const x = cx + dx, y = cy + dy; const own = await src.official(x, y); raw += own.length; rawArea += own.reduce((s, p) => s + polyArea(p), 0);
  const t0 = Date.now(); const j = await joinedOfficial(x, y, src); ms += Date.now() - t0;
  joined += j.length; for (const p of j) { joinedArea += polyArea(p); const bb = polyBBox(p); const c = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]; if (!(c[0] >= x && c[0] < x + 1 && c[1] >= y && c[1] < y + 1)) centreOutside++; emitted.push({ p, bb, tile: `${x}/${y}` }); }
}
let overlaps = 0, sameShape = 0;
for (let i = 0; i < emitted.length; i++) for (let j = i + 1; j < emitted.length; j++) {
  const a = emitted[i], b = emitted[j]; if (a.tile === b.tile) continue;
  if (a.bb[0] > b.bb[2] || b.bb[0] > a.bb[2] || a.bb[1] > b.bb[3] || b.bb[1] > a.bb[3]) continue;
  const sa = sharedArea(a.p, b.p); if (sa > 1e-9) { overlaps++; console.log('overlap', a.tile, b.tile, 'shared', sa.toExponential(2), 'areas', polyArea(a.p).toExponential(2), polyArea(b.p).toExponential(2), 'bboxA', a.bb.map((v) => v.toFixed(5)).join(','), 'bboxB', b.bb.map((v) => v.toFixed(5)).join(',')); }
}
console.log(`# ${lat},${lon} z16 ${cx}/${cy} ${n}x${n}: raw pieces=${raw}, joined buildings=${joined} (${raw - joined} fewer), raw area=${rawArea.toFixed(4)}, joined area=${joinedArea.toFixed(4)} (ratio ${(joinedArea / rawArea).toFixed(4)}), overlapping pairs across tiles after join=${overlaps}, centres outside own tile=${centreOutside}, join time ${ms} ms`);
