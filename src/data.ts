import type { Parties, Settlements, ResultsMeta, GeoMeta, SankeyData } from "./types";

const base = import.meta.env.BASE_URL; // "/" in dev & prod
const url = (name: string) => `${base}data/${name}`;

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(url(name));
  if (!res.ok) throw new Error(`Failed to load ${name}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export type PointLookup = Record<string, [number, number]>;

export interface AppData {
  parties: Parties;
  settlements: Settlements;
  points: PointLookup;
  resultsMeta: ResultsMeta;
  geoMeta: GeoMeta;
  sankey: SankeyData;
}

/** Load everything the app needs up front (all files are small + static). */
export async function loadAppData(): Promise<AppData> {
  const [parties, settlements, points, resultsMeta, geoMeta, sankey] = await Promise.all([
    getJson<Parties>("parties.json"),
    getJson<Settlements>("k25-settlements.json"),
    getJson<PointLookup>("settlement-points.json"),
    getJson<ResultsMeta>("results-meta.json"),
    getJson<GeoMeta>("geo-meta.json"),
    getJson<SankeyData>("sankey-25-24.json"),
  ]);
  return { parties, settlements, points, resultsMeta, geoMeta, sankey };
}

export const GEOJSON_SETTLEMENTS = url("k25-settlements.geojson");
export const GEOJSON_POINTS = url("k25-settlements-points.geojson");
export const dataUrl = url;
