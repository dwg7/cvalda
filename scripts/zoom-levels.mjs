// Is koicha BldA at z13-z15 the same content as at z16? Compare feature count and total area of a tile
// with the sum over its z16 descendants (areas add up even when polygons are cut at tile edges).
import { decodeOfficial } from '../src/fusion/decode.ts';
import { polyArea } from '../src/fusion/geom.ts';
const get = async (z, x, y) => { const r = await fetch(`https://stars.optgeo.org/bvmap-koicha-hokkaido/${z}/${x}/${y}`); if (r.status === 404) return null; return r.arrayBuffer(); };
const stat = async (z, x, y) => { const b = await get(z, x, y); if (!b) return { n: 0, a: 0 }; const p = decodeOfficial(b, x, y); return { n: p.length, a: p.reduce((s, q) => s + polyArea(q), 0) * 4 ** (16 - z) }; }; // area in z16-tile² units
const [lat, lon] = process.argv.slice(2).map(Number);
const r = (lat * Math.PI) / 180;
const t16 = [Math.floor(((lon + 180) / 360) * 65536), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 65536)];
for (const z of [13, 14, 15]) {
  const s = 2 ** (16 - z), x = t16[0] >> (16 - z), y = t16[1] >> (16 - z);
  const top = await stat(z, x, y);
  let n = 0, a = 0; const kids = [];
  for (let i = 0; i < s; i++) for (let j = 0; j < s; j++) kids.push(stat(16, x * s + i, y * s + j));
  for (const k of await Promise.all(kids)) { n += k.n; a += k.a; }
  console.log(`z${z} ${x}/${y}: tile n=${top.n} area=${top.a.toFixed(3)} | z16 descendants (${s * s}) n=${n} area=${a.toFixed(3)} | area ratio ${(top.a / a).toFixed(3)}`);
}
