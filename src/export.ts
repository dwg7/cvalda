import { serialize } from 'flatgeobuf/geojson';
import type { ExportTile } from './fusion/compute';

export type ExportMode = 'official-first' | 'overlay' | 'overture-first';
export type Format = 'geojson' | 'flatgeobuf';

/** Largest number of features one export may hold. */
export const EXPORT_MAX_FEATURES = 100_000;

const OVERTURE_CREDIT = '© OpenStreetMap contributors, © Overture Maps Foundation (https://docs.overturemaps.org/attribution)';
// Shown with every exported feature of that source (FlatGeobuf has no place for a file-level notice).
const FEATURE_CREDIT = { official: '国土地理院最適化ベクトルタイルを加工して作成', overture: OVERTURE_CREDIT };

export interface ExportParams {
  mode: ExportMode;
  /** Share (0–1) below which the supplementing source is added. Null in overlay mode. */
  threshold: number | null;
  zoom: number;
  center: [number, number];
  tiles: number;
  /** Lon/lat box of the z16 tiles that were exported: [west, south, east, north]. */
  bbox: [number, number, number, number];
}

const shared = (f: GeoJSON.Feature) => (f.properties as { covered_share: number | null }).covered_share;

/** Pick the features that the chosen mode shows. */
export const select = (mode: ExportMode, threshold: number, tiles: ExportTile[]): GeoJSON.Feature[] => {
  const out: GeoJSON.Feature[] = [];
  const below = (f: GeoJSON.Feature) => { const v = shared(f); return v === null || v < threshold; };
  for (const t of tiles) {
    if (mode === 'official-first') out.push(...t.official, ...t.overture.filter(below));
    else if (mode === 'overlay') out.push(...t.official, ...t.overture);
    else out.push(...t.overture, ...t.official.filter(below));
  }
  return out;
};

export const build = (features: GeoJSON.Feature[], params: ExportParams, gsiCredit: string, format: Format): { blob: Blob; ext: string } => {
  if (format === 'flatgeobuf') {
    const withCredit = features.map((f) => ({
      ...f,
      properties: { ...f.properties, credit: FEATURE_CREDIT[(f.properties as { source: 'official' | 'overture' }).source] },
    }));
    const bytes = serialize({ type: 'FeatureCollection', features: withCredit });
    return { blob: new Blob([bytes as BlobPart], { type: 'application/octet-stream' }), ext: 'fgb' };
  }
  const fc = {
    type: 'FeatureCollection',
    attribution: [gsiCredit, OVERTURE_CREDIT],
    note:
      'Made in the browser by cvalda (https://dwg7.unopengis.org/cvalda/) from the map tiles that cover the view. ' +
      'Features with source "official" are GSI buildings; parts that the map tiles cut at tile edges are fused, so a building appears once. ' +
      'Features with source "overture" are fused in the same way across Overture tile edges. ' +
      'Features with source "overture" keep their Overture id; "datasets" names the data and licence recorded by Overture for each. ' +
      '"covered_share" is the share of the building covered by the other source.',
    parameters: params,
    generated: new Date().toISOString(),
    features,
  };
  return { blob: new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), ext: 'geojson' };
};

export const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
