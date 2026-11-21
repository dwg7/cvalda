import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { decodeTile } from '@maplibre/mlt';
import { classifyRings, type Poly, type Ring } from './geom';

/** An Overture building. `polys` are in "world z14" units: tile x + fraction. */
export interface OvertureBuilding {
  id: string;
  height?: number;
  /** Compact provenance, e.g. "OpenStreetMap (ODbL-1.0)", taken from the Overture `sources` property. */
  datasets: string;
  polys: Poly[];
}

const provenance = (sources: unknown): string => {
  if (typeof sources !== 'string') return '';
  try {
    const seen = new Set<string>();
    for (const s of JSON.parse(sources) as { dataset?: string; license?: string }[]) {
      seen.add(`${s.dataset ?? '?'}${s.license ? ` (${s.license})` : ''}`);
    }
    return [...seen].join('; ');
  } catch {
    return '';
  }
};

export const decodeOverture = (buf: ArrayBuffer, tx: number, ty: number): OvertureBuilding[] => {
  const layer = new VectorTile(new PbfReader(new Uint8Array(buf))).layers.building;
  if (!layer) return [];
  const out: OvertureBuilding[] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (f.type !== 3) continue;
    const rings: Ring[] = f.loadGeometry().map((r) => r.map((p): [number, number] => [tx + p.x / layer.extent, ty + p.y / layer.extent]));
    const polys = classifyRings(rings);
    if (polys.length === 0) continue;
    const h = f.properties.height;
    out.push({ id: String(f.properties.id ?? ''), height: typeof h === 'number' ? h : undefined, datasets: provenance(f.properties.sources), polys });
  }
  return out;
};

/** Official BldA polygons from a koicha MLT tile, in "world z16" units. */
export const decodeOfficial = (buf: ArrayBuffer, x: number, y: number): Poly[] => {
  const tables = decodeTile(new Uint8Array(buf));
  const out: Poly[] = [];
  for (const t of tables) {
    if (t.name !== 'BldA') continue;
    const ext = t.extent;
    for (const f of t.getFeatures()) {
      const rings: Ring[] = f.geometry.coordinates.map((r) => r.map((p): [number, number] => [x + p.x / ext, y + p.y / ext]));
      out.push(...classifyRings(rings));
    }
  }
  return out;
};
