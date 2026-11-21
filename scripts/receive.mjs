// Test helper: save the body of one POST to the given path, then exit. Usage: node scripts/receive.mjs <port> <outfile>
import http from 'node:http';
import fs from 'node:fs';
const [port, out] = [Number(process.argv[2]), process.argv[3]];
http.createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { fs.writeFileSync(out, Buffer.concat(chunks)); res.end('ok'); console.log('saved', out, Buffer.concat(chunks).length); process.exit(0); });
}).listen(port, '127.0.0.1');
