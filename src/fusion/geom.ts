import polygonClipping from 'polygon-clipping';

export type Pt = [number, number];
export type Ring = Pt[];
/** One polygon: outer ring first, holes after. */
export type Poly = Ring[];

export const ringArea = (r: Ring): number => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return s / 2;
};

/** Group rings into polygons. A ring with the same sign as the first ring starts a new polygon; others are holes. */
export const classifyRings = (rings: Ring[]): Poly[] => {
  const out: Poly[] = [];
  let cur: Poly | null = null;
  let sign = 0;
  for (const r of rings) {
    const a = ringArea(r);
    if (a === 0) continue;
    if (sign === 0) sign = Math.sign(a);
    if (Math.sign(a) === sign) out.push((cur = [r]));
    else cur?.push(r);
  }
  return out;
};

export const polyArea = (p: Poly): number => {
  let a = Math.abs(ringArea(p[0]));
  for (let i = 1; i < p.length; i++) a -= Math.abs(ringArea(p[i]));
  return a;
};

export type BBox = [number, number, number, number];
export const polyBBox = (p: Poly): BBox => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of p[0]) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};
export const overlaps = (a: BBox, b: BBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

export interface Indexed { poly: Poly; bbox: BBox }
export const index = (polys: Poly[]): Indexed[] => polys.map((poly) => ({ poly, bbox: polyBBox(poly) }));

/**
 * Share of the area of `target` (a building made of one or more polygons) that lies inside
 * the union of the `others`. Returns null when the geometry could not be processed.
 */
export const coveredShare = (target: Poly[], others: Indexed[]): number | null => {
  let total = 0;
  let inside = 0;
  for (const part of target) {
    const area = polyArea(part);
    if (!(area > 0)) continue;
    total += area;
    const bb = polyBBox(part);
    const near = others.filter((o) => overlaps(bb, o.bbox)).map((o) => o.poly);
    if (near.length === 0) continue;
    try {
      const u = near.length === 1 ? [near[0]] : polygonClipping.union(near[0] as never, ...(near.slice(1) as never[]));
      const inter = polygonClipping.intersection(part as never, ...(u as never[]));
      for (const mp of inter) inside += polyArea(mp as Poly);
    } catch {
      return null;
    }
  }
  return total > 0 ? Math.min(1, inside / total) : null;
};
