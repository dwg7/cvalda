// Stage 6 measurement: how are official BldA polygons cut at z16 tile edges?
// Usage: node scripts/out/edge-cuts.mjs <lat> <lon> [n=3]
import { decodeOfficial } from '../src/fusion/decode.ts';
import { polyArea, polyBBox } from '../src/fusion/geom.ts';
const [lat, lon, n = 3] = process.argv.slice(2).map(Number);
const r = (lat * Math.PI) / 180;
const cx = Math.floor(((lon + 180) / 360) * 65536), cy = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 65536);
const get = async (x, y) => { const res = await fetch(`https://stars.optgeo.org/bvmap-koicha-hokkaido/16/${x}/${y}`); if (res.status === 404) return []; return decodeOfficial(await res.arrayBuffer(), x, y); };
let total = 0, edge = 0, outside = 0, wide = 0, area = 0, edgeArea = 0;
const edgeOf = (p) => p.some((ring) => ring.some(([x, y]) => Number.isInteger(x) || Number.isInteger(y)));
for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) {
  const x = cx + dx, y = cy + dy; const polys = await get(x, y);
  for (const p of polys) {
    total++; const a = polyArea(p); area += a;
    if (edgeOf(p)) { edge++; edgeArea += a; }
    const bb = polyBBox(p); if (bb[0] < x - 1e-9 || bb[2] > x + 1 + 1e-9 || bb[1] < y - 1e-9 || bb[3] > y + 1 + 1e-9) outside++;
    if (bb[2] - bb[0] > 0.5 || bb[3] - bb[1] > 0.5) wide++;
  }
}
console.log(`# ${lat},${lon} z16 ${cx}/${cy} ${n}x${n} tiles: pieces=${total}, touching a tile edge (integer coordinate)=${edge} (${(100 * edge / total).toFixed(1)}%), area share=${(100 * edgeArea / area).toFixed(1)}%, pieces extending beyond own tile (buffer)=${outside}, pieces wider than half a tile=${wide}`);
