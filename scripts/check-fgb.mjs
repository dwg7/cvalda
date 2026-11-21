// Test helper: read a FlatGeobuf file written by the app and summarise it. Usage: node scripts/out/check-fgb.mjs <file.fgb>
import fs from 'node:fs';
import { deserialize } from 'flatgeobuf/geojson';
const bytes = new Uint8Array(fs.readFileSync(process.argv[2]));
const cnt = {}; let n = 0, sample, types = new Set(), creditOk = 0;
for await (const f of deserialize(bytes)) {
  n++; cnt[f.properties.source] = (cnt[f.properties.source] || 0) + 1; types.add(f.geometry.type);
  if (f.properties.credit) creditOk++;
  sample ??= f.properties;
}
console.log(JSON.stringify({ n, cnt, types: [...types], withCredit: creditOk, sample }, null, 1));
