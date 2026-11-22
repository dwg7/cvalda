import { coveredShare, index, polyBBox, sharedArea, unionPolys, type BBox, type Indexed, type Poly } from './geom';
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
   * The other direction (for the "Overture first" mode): official buildings of this tile that
   * Overture covers by less than KEEP_BELOW, as GeoJSON with `cov` = share covered by Overture.
   */
  officialOnly: GeoJSON.Feature[];
  /** Official buildings owned by this tile (parts across tile edges are fused; each building counts once). */
  officialPieces: number;
  /** Official buildings dropped because Overture covers ≥ KEEP_BELOW of them. */
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


const scaleBuilding = (b: OvertureBuilding): OvertureBuilding => ({
  ...b,
  polys: b.polys.map((p) => p.map((r) => r.map(([a, c]) => [a * SCALE, c * SCALE] as [number, number]))),
});

const centreIn = (b: OvertureBuilding, x: number, y: number) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of b.polys) {
    const bb = polyBBox(p);
    x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]); x1 = Math.max(x1, bb[2]); y1 = Math.max(y1, bb[3]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return cx >= x && cx < x + 1 && cy >= y && cy < y + 1;
};

/**
 * Overture buildings around z16 tile (x, y), in "world z16" units.
 * A building near a z14 tile edge sits in both z14 tiles, and each copy is cut at the far end of its
 * tile's buffer (measured: 40–60% of the copies differ, notes/stage6.md). For a z16 tile on the edge of
 * its z14 tile, the neighbouring z14 tiles are read as well and copies with the same id are fused.
 * `mine` = the buildings whose box centre lies in this tile, so each building has one owner.
 */
const overtureAround = async (x: number, y: number, src: Sources) => {
  const ax = x >> 2, ay = y >> 2;
  const dxs = [0, ...(x % 4 === 0 ? [-1] : []), ...(x % 4 === 3 ? [1] : [])];
  const dys = [0, ...(y % 4 === 0 ? [-1] : []), ...(y % 4 === 3 ? [1] : [])];
  const offsets = dxs.flatMap((dx) => dys.map((dy) => [dx, dy] as const)).filter(([dx, dy]) => dx !== 0 || dy !== 0);
  const [base, ...others] = await Promise.all([src.overture(ax, ay), ...offsets.map(([dx, dy]) => src.overture(ax + dx, ay + dy))]);
  const copies = new Map<string, OvertureBuilding[]>();
  for (const list of others) for (const b of list) if (b.id) copies.set(b.id, [...(copies.get(b.id) ?? []), b]);
  let fused = 0;
  const all = base.map((b) => {
    const more = b.id ? copies.get(b.id) : undefined;
    if (!more) return scaleBuilding(b);
    fused++;
    let polys: Poly[];
    try { polys = unionPolys([...b.polys, ...more.flatMap((m) => m.polys)]); } catch { polys = b.polys; }
    return scaleBuilding({ ...b, polys });
  });
  return { all, mine: all.filter((b) => centreIn(b, x, y)), fused };
};

export const computeTile = async (x: number, y: number, src: Sources): Promise<TileResult> => {
  const t0 = Date.now();
  const { all: ov, mine } = await overtureAround(x, y, src);
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
  const ownOfficial = await joinedOfficial(x, y, src);
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


export interface ExportTile {
  x: number;
  y: number;
  /** Every Overture building owned by this tile. `covered_share` = share covered by official. */
  overture: GeoJSON.Feature[];
  /** Every official building owned by this tile (fused across tile edges). `covered_share` = share covered by Overture. */
  official: GeoJSON.Feature[];
  skipped?: 'too-many';
}

/** Same method as computeTile, but nothing is dropped. Used only when the reader exports. */
export const exportTile = async (x: number, y: number, src: Sources): Promise<ExportTile> => {
  const { all: ov, mine } = await overtureAround(x, y, src);
  const out: ExportTile = { x, y, overture: [], official: [] };
  if (mine.length > MAX_FEATURES_PER_TILE) return { ...out, skipped: 'too-many' };
  const tiles: Promise<Poly[]>[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push(src.official(x + dx, y + dy));
  const officialIdx: Indexed[] = index((await Promise.all(tiles)).flat());
  const round = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);
  for (const b of mine) {
    out.overture.push({
      type: 'Feature',
      properties: { source: 'overture', id: b.id, ...(b.height !== undefined ? { height: b.height } : {}), datasets: b.datasets, covered_share: round(coveredShare(b.polys, officialIdx)) },
      geometry: b.polys.length === 1 ? { type: 'Polygon', coordinates: toLonLat(b.polys[0]) } : { type: 'MultiPolygon', coordinates: b.polys.map(toLonLat) },
    });
  }
  const ovIdx: Indexed[] = index(ov.flatMap((b) => b.polys));
  for (const p of await joinedOfficial(x, y, src)) {
    out.official.push({
      type: 'Feature',
      properties: { source: 'official', covered_share: round(coveredShare([p], ovIdx)) },
      geometry: { type: 'Polygon', coordinates: toLonLat(p) },
    });
  }
  return out;
};


/**
 * The koicha tiles carry a buffer: a building near a z16 tile edge sits in both tiles, either whole
 * (identical copies) or as two overlapping parts, each cut at the far end of its tile's buffer.
 * Measured: the buffer is 160 of 8192 units = 0.0195 tile (notes/stage6.md).
 */
const BUFFER = 0.02;
/** Overlap, in tile² units, above which parts from two tiles count as one building (touching is not enough). */
const SAME_BUILDING_AREA = 1e-9;

const nearEdge = (bb: BBox, x: number, y: number) =>
  bb[0] < x + BUFFER || bb[2] > x + 1 - BUFFER || bb[1] < y + BUFFER || bb[3] > y + 1 - BUFFER;

/**
 * Official buildings of tile (x, y), each building exactly once and whole: parts from neighbouring
 * tiles that overlap are fused, and a building belongs to the tile that holds the centre of its box.
 * Two buildings that merely touch (shared wall) stay two. A building wider than the 3×3 block around
 * the tile can still come out in parts (none found so far).
 */
export const joinedOfficial = async (x: number, y: number, src: Sources): Promise<Poly[]> => {
  const out: Poly[] = [];
  const cand: { poly: Poly; bb: BBox; tile: number }[] = [];
  let t = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++, t++) {
    for (const poly of await src.official(x + dx, y + dy)) {
      const bb = polyBBox(poly);
      if (nearEdge(bb, x + dx, y + dy)) {
        if (bb[2] > x - 0.05 && bb[0] < x + 1.05 && bb[3] > y - 0.05 && bb[1] < y + 1.05) cand.push({ poly, bb, tile: t });
      } else if (dx === 0 && dy === 0) out.push(poly); // an interior building of this tile: nothing to join
    }
  }
  // group parts of different tiles that overlap
  const parent = cand.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < cand.length; i++) for (let j = i + 1; j < cand.length; j++) {
    if (cand[i].tile === cand[j].tile) continue;
    const a = cand[i].bb, b = cand[j].bb;
    if (a[0] > b[2] || b[0] > a[2] || a[1] > b[3] || b[1] > a[3]) continue;
    if (sharedArea(cand[i].poly, cand[j].poly) > SAME_BUILDING_AREA) parent[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  cand.forEach((_, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); });
  for (const members of groups.values()) {
    let polys: Poly[];
    try { polys = unionPolys(members.map((i) => cand[i].poly)); } catch { polys = members.map((i) => cand[i].poly); }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polys) { const bb = polyBBox(p); x0 = Math.min(x0, bb[0]); y0 = Math.min(y0, bb[1]); x1 = Math.max(x1, bb[2]); y1 = Math.max(y1, bb[3]); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (cx >= x && cx < x + 1 && cy >= y && cy < y + 1) out.push(...polys);
  }
  return out;
};
