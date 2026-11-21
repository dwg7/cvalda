import { coveredShare, index, polyBBox, type Indexed, type Poly } from './geom';
import type { OvertureBuilding } from './decode';

export const Z_COMPUTE = 16; // working zoom: finest zoom of the official data
export const Z_OVERTURE = 14; // maxzoom of overture_buildings
const SCALE = 2 ** (Z_COMPUTE - Z_OVERTURE);

/** Overture buildings that the result keeps, with the share covered by official. Buildings covered at least this much are dropped. */
export const KEEP_BELOW = 0.95;
/** Upper limit of Overture buildings per z16 tile. Tiles above it are skipped. */
export const MAX_FEATURES_PER_TILE = 2000;

export interface TileResult {
  x: number;
  y: number;
  /** GeoJSON features (lon/lat) of Overture buildings with coverage < KEEP_BELOW. */
  features: GeoJSON.Feature[];
  /** Overture buildings whose centre lies in this tile. */
  candidates: number;
  /** Buildings dropped because coverage ≥ KEEP_BELOW. */
  dropped: number;
  /**
   * The other direction (for the "Overture first" mode): official building pieces of this tile that
   * Overture covers by less than KEEP_BELOW, as GeoJSON with `cov` = share covered by Overture.
   */
  officialOnly: GeoJSON.Feature[];
  /** Official building pieces in this tile (a building cut by the tile edge counts once per tile). */
  officialPieces: number;
  /** Official pieces dropped because Overture covers ≥ KEEP_BELOW of them. */
  officialDropped: number;
  /** Buildings whose geometry could not be processed (kept with cov = 0). */
  failed: number;
  officialCount: number;
  skipped?: 'too-many';
  ms: number;
}

const lon = (wx: number) => (wx / 2 ** Z_COMPUTE) * 360 - 180;
const lat = (wy: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * wy) / 2 ** Z_COMPUTE))) * 180) / Math.PI;
const toLonLat = (p: Poly): number[][][] => p.map((r) => r.map(([x, y]) => [lon(x), lat(y)]));

export interface Sources {
  overture(tx: number, ty: number): Promise<OvertureBuilding[]>;
  official(x: number, y: number): Promise<Poly[]>;
}

export const computeTile = async (x: number, y: number, src: Sources): Promise<TileResult> => {
  const t0 = Date.now();
  // Overture world z14 → world z16
  const ov = (await src.overture(x >> 2, y >> 2)).map((b) => ({ ...b, polys: b.polys.map((p) => p.map((r) => r.map(([a, b2]) => [a * SCALE, b2 * SCALE] as [number, number]))) }));
  // A building belongs to the z16 tile that holds the centre of its bounding box.
  const mine = ov.filter((b) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of b.polys) {
      const bb = polyBBox(p);
      x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]); x1 = Math.max(x1, bb[2]); y1 = Math.max(y1, bb[3]);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return cx >= x && cx < x + 1 && cy >= y && cy < y + 1;
  });
  const base: Omit<TileResult, 'ms'> = {
    x, y, features: [], candidates: mine.length, dropped: 0, failed: 0, officialCount: 0,
    officialOnly: [], officialPieces: 0, officialDropped: 0,
  };
  if (mine.length > MAX_FEATURES_PER_TILE) return { ...base, skipped: 'too-many', ms: Date.now() - t0 };

  // Official buildings of this tile and its 8 neighbours (buildings can cross tile edges).
  const tiles: Promise<Poly[]>[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push(src.official(x + dx, y + dy));
  const official: Indexed[] = index((await Promise.all(tiles)).flat());
  base.officialCount = official.length;

  for (const b of mine) {
    const cov = coveredShare(b.polys, official);
    if (cov !== null && cov >= KEEP_BELOW) { base.dropped++; continue; }
    if (cov === null) base.failed++;
    base.features.push({
      type: 'Feature',
      properties: { id: b.id, cov: cov === null ? 0 : Math.round(cov * 1000) / 1000, ...(b.height !== undefined ? { height: b.height } : {}) },
      geometry: b.polys.length === 1
        ? { type: 'Polygon', coordinates: toLonLat(b.polys[0]) }
        : { type: 'MultiPolygon', coordinates: b.polys.map(toLonLat) },
    });
  }

  // Other direction: which official pieces of this tile does Overture not cover?
  // Overture side = every building of the z14 ancestor (its buffer holds buildings across the tile edge).
  const ovIndex: Indexed[] = index(ov.flatMap((b) => b.polys));
  const ownOfficial = await src.official(x, y);
  base.officialPieces = ownOfficial.length;
  for (const p of ownOfficial) {
    const cov = coveredShare([p], ovIndex);
    if (cov !== null && cov >= KEEP_BELOW) { base.officialDropped++; continue; }
    base.officialOnly.push({
      type: 'Feature',
      properties: { cov: cov === null ? 0 : Math.round(cov * 1000) / 1000 },
      geometry: { type: 'Polygon', coordinates: toLonLat(p) },
    });
  }
  return { ...base, ms: Date.now() - t0 };
};
