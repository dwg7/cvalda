// P0 measurement: compare building footprints for the same z16 tile across
// koicha (MLT), stars bvmap (MVT), and Overture (MVT, z14 ancestor).
// Usage: node scripts/out/compare-tiles.mjs <lat> <lon>   (bundled with rolldown)
import { decodeTile } from '@maplibre/mlt';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';
import zlib from 'node:zlib';

const [lat, lon] = process.argv.slice(2).map(Number);
const Z = 16, G = 512; // raster grid per z16 tile
const tileOf = (lat, lon, z) => {
  const n = 2 ** z, x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [x, y];
};
const fetchBuf = async (url) => {
  const r = await fetch(url);
  if (!r.ok) return null;
  let b = Buffer.from(await r.arrayBuffer());
  if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
  return b;
};
// Each returns: array of polygons; polygon = array of rings; ring = array of [u,v] in units of z16 tile (0..1)
const fromMlt = async (url, layer) => {
  const b = await fetchBuf(url); if (!b) return null;
  const t = decodeTile(new Uint8Array(b)); const out = [];
  for (const l of t) if (l.name === layer) for (const f of l.getFeatures()) {
    out.push(f.geometry.coordinates.map((r) => r.map((p) => [p.x / l.extent, p.y / l.extent])));
  }
  return out;
};
const fromMvt = async (url, layer, tf) => {
  const b = await fetchBuf(url); if (!b) return null;
  const l = new VectorTile(new Pbf(b)).layers[layer]; if (!l) return [];
  const out = [];
  for (let i = 0; i < l.length; i++) {
    const f = l.feature(i); if (f.type !== 3) continue;
    out.push(f.loadGeometry().map((r) => r.map((p) => tf(p.x / l.extent, p.y / l.extent))));
  }
  return out;
};
const ringArea = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] * r[i][1] - r[i][0] * r[j][1]); return s / 2; };
const area = (polys) => polys.reduce((a, rings) => a + Math.abs(rings.reduce((s, r) => s + ringArea(r), 0)), 0);
// even-odd raster of one polygon (all its rings) into grid
const rasterize = (polys) => {
  const g = new Uint8Array(G * G);
  for (const rings of polys) {
    const m = new Uint8Array(G * G);
    for (let row = 0; row < G; row++) {
      const y = (row + 0.5) / G, xs = [];
      for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const [x1, y1] = r[j], [x2, y2] = r[i];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] * G - 0.5)), b = Math.min(G - 1, Math.floor(xs[k + 1] * G - 0.5));
        for (let c = a; c <= b; c++) m[row * G + c] = 1;
      }
    }
    for (let i = 0; i < m.length; i++) g[i] |= m[i];
  }
  return g;
};
const covered = (A, B) => { let a = 0, ab = 0; for (let i = 0; i < A.length; i++) if (A[i]) { a++; if (B[i]) ab++; } return a ? ab / a : null; };
const px = (g) => g.reduce((s, v) => s + v, 0);

const [cx, cy] = tileOf(lat, lon, Z);
console.log(`# center ${lat},${lon} -> z16 ${cx}/${cy}; tiles cx..cx+1, cy..cy+1`);
const rows = [];
for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
  const x = cx + dx, y = cy + dy;
  const koi = await fromMlt(`https://stars.optgeo.org/bvmap-koicha-hokkaido/${Z}/${x}/${y}`, 'BldA');
  const off = await fromMvt(`https://stars.optgeo.org/bvmap/${Z}/${x}/${y}`, 'BldA', (u, v) => [u, v]);
  const ox = x >> 2, oy = y >> 2; // z14 ancestor
  const ove = await fromMvt(`https://stars.optgeo.org/overture_buildings/14/${ox}/${oy}`, 'building', (u, v) => [(u + ox) * 4 - x, (v + oy) * 4 - y]);
  // clip Overture to this tile by raster domain automatically (0..1 only)
  if (!koi || !off || !ove) { rows.push({ tile: `${x}/${y}`, note: 'missing', koi: !!koi, off: !!off, ove: !!ove }); continue; }
  const gK = rasterize(koi), gO = rasterize(off), gV = rasterize(ove);
  // count Overture buildings whose centroid-ish (first vertex) lies in this tile
  const oveInTile = ove.filter((p) => { const [u, v] = p[0][0]; return u >= 0 && u < 1 && v >= 0 && v < 1; }).length;
  rows.push({
    tile: `${x}/${y}`,
    koicha_n: koi.length, bvmapZ16_n: off.length, overture_n_in_tile: oveInTile,
    koicha_area: +area(koi).toFixed(5), bvmapZ16_area: +area(off).toFixed(5),
    'koicha⊂bvmap': +covered(gK, gO)?.toFixed(3), 'bvmap⊂koicha': +covered(gO, gK)?.toFixed(3),
    'overture⊂bvmap': +covered(gV, gO)?.toFixed(3), 'overture⊂koicha': +covered(gV, gK)?.toFixed(3),
    'bvmap⊂overture': +covered(gO, gV)?.toFixed(3),
    ove_px: px(gV), koi_px: px(gK),
  });
}
console.table(rows);
