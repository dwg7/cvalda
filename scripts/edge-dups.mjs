// Stage 6 measurement: duplicates of official polygons across neighbouring z16 tiles, and the buffer size.
// Usage: node scripts/out/edge-dups.mjs <lat> <lon> [n=3]
import { decodeOfficial } from '../src/fusion/decode.ts';
import { polyArea, polyBBox } from '../src/fusion/geom.ts';
const [lat, lon, n = 3] = process.argv.slice(2).map(Number);
const r = (lat * Math.PI) / 180;
const cx = Math.floor(((lon + 180) / 360) * 65536), cy = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 65536);
const get = async (x, y) => { const res = await fetch(`https://stars.optgeo.org/bvmap-koicha-hokkaido/16/${x}/${y}`); if (res.status === 404) return []; return decodeOfficial(await res.arrayBuffer(), x, y); };
const sig = (p) => p[0].map(([x, y]) => `${Math.round(x * 8192)},${Math.round(y * 8192)}`).sort().join(';');
const seen = new Map(); let total = 0, maxOver = 0, cutAtEdge = 0, sameShape = 0, areaAll = 0;
const hist = {};
for (let dx = 0; dx < n; dx++) for (let dy = 0; dy < n; dy++) {
  const x = cx + dx, y = cy + dy;
  for (const p of await get(x, y)) {
    total++; areaAll += polyArea(p);
    const bb = polyBBox(p);
    maxOver = Math.max(maxOver, x - bb[0], bb[2] - (x + 1), y - bb[1], bb[3] - (y + 1));
    const k = sig(p); if (!seen.has(k)) seen.set(k, []); seen.get(k).push(`${x}/${y}`);
  }
}
let dupGroups = 0, extra = 0, extraArea = 0;
for (const [k, tiles] of seen) if (tiles.length > 1) { dupGroups++; extra += tiles.length - 1; hist[tiles.length] = (hist[tiles.length] || 0) + 1; }
console.log(`# ${lat},${lon} z16 ${cx}/${cy} ${n}x${n}: pieces=${total}, distinct shapes=${seen.size}, shapes found in more than one tile=${dupGroups}, extra copies=${extra} (${(100 * extra / total).toFixed(1)}% of pieces), copies-per-shape histogram=${JSON.stringify(hist)}, max overshoot beyond own tile=${maxOver.toFixed(5)} tile (=${Math.round(maxOver * 8192)} units of 8192)`);
