// P0 measurement: official GSI pmtiles (range requests) vs koicha, BldA count at z16.
import { PMTiles } from 'pmtiles';
import { decodeTile } from '@maplibre/mlt';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';
import zlib from 'node:zlib';
const p = new PMTiles('https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles');
const h = await p.getHeader();
console.log({ minZoom: h.minZoom, maxZoom: h.maxZoom, tileType: h.tileType, tileCompression: h.tileCompression });
const md = await p.getMetadata(); console.log('metadata keys', Object.keys(md).slice(0, 12), 'attribution:', md.attribution);
const tiles = [[16, 58500, 24065], [16, 58501, 24066], [16, 58836, 24100], [16, 58591, 23998], [16, 59031, 23825]];
for (const [z, x, y] of tiles) {
  const r = await p.getZxy(z, x, y); let b = Buffer.from(r.data); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b);
  const gsi = new VectorTile(new Pbf(b)).layers.BldA?.length ?? 0;
  const k = await (await fetch(`https://stars.optgeo.org/bvmap-koicha-hokkaido/${z}/${x}/${y}`)).arrayBuffer();
  const kn = decodeTile(new Uint8Array(k)).find((l) => l.name === 'BldA').numFeatures;
  console.log(`${z}/${x}/${y} GSI BldA=${gsi} koicha BldA=${kn} equal=${gsi === kn}`);
}
