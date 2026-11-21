// Computes, per z16 tile, which share of each Overture building is covered by official buildings.
import { computeTile, exportTile, Z_COMPUTE, Z_OVERTURE, type ExportTile, type Sources, type TileResult } from './fusion/compute';
import { decodeOfficial, decodeOverture, type OvertureBuilding } from './fusion/decode';
import type { Poly } from './fusion/geom';

const OVERTURE_URL = 'https://stars.optgeo.org/overture_buildings';
const OFFICIAL_URL = 'https://stars.optgeo.org/bvmap-koicha-hokkaido';
// Small caches keep memory low (target: 4 GB Chromebook).
const OVERTURE_CACHE = 6; // decoded z14 tiles, about 3,500–5,000 buildings each
const OFFICIAL_CACHE = 160; // decoded z16 tiles

const lru = <T>(limit: number) => {
  const m = new Map<string, Promise<T>>();
  return (key: string, make: () => Promise<T>): Promise<T> => {
    const hit = m.get(key);
    if (hit) { m.delete(key); m.set(key, hit); return hit; }
    const p = make();
    m.set(key, p);
    p.catch(() => m.delete(key)); // never cache failures
    while (m.size > limit) m.delete(m.keys().next().value as string);
    return p;
  };
};

const overtureCache = lru<OvertureBuilding[]>(OVERTURE_CACHE);
const officialCache = lru<Poly[]>(OFFICIAL_CACHE);

const getBuf = async (url: string): Promise<ArrayBuffer | null> => {
  const r = await fetch(url);
  if (r.status === 404 || r.status === 204) return null; // empty tile
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.arrayBuffer();
};

const sources: Sources = {
  overture: (tx, ty) => overtureCache(`${tx}/${ty}`, async () => {
    const b = await getBuf(`${OVERTURE_URL}/${Z_OVERTURE}/${tx}/${ty}`);
    return b ? decodeOverture(b, tx, ty) : [];
  }),
  official: (x, y) => officialCache(`${x}/${y}`, async () => {
    const b = await getBuf(`${OFFICIAL_URL}/${Z_COMPUTE}/${x}/${y}`);
    return b && b.byteLength > 0 ? decodeOfficial(b, x, y) : [];
  }),
};

export type Request = { id: number; x: number; y: number; export?: boolean };
export type Response = { id: number; result?: TileResult; exported?: ExportTile; error?: string };

self.onmessage = async (e: MessageEvent<Request>) => {
  const { id, x, y } = e.data;
  try {
    if (e.data.export) {
      (self as unknown as Worker).postMessage({ id, exported: await exportTile(x, y, sources) } satisfies Response);
      return;
    }
    const result = await computeTile(x, y, sources);
    (self as unknown as Worker).postMessage({ id, result } satisfies Response);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) } satisfies Response);
  }
};
