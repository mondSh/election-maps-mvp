import type { FeatureCollection as GeoJSONFC } from "geojson";
import type { Parties, Settlements, ResultsMeta, GeoMeta, SankeyData, SeatsData, SocioData } from "./types";

const base = import.meta.env.BASE_URL; // "/" in dev & prod
const url = (name: string) => `${base}data/${name}`;

/** Thrown when the access gate rejects a data request (HTTP 401). */
export class AuthRequiredError extends Error {
  constructor() {
    super("auth required");
    this.name = "AuthRequiredError";
  }
}

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(url(name));
  if (res.status === 401) throw new AuthRequiredError();
  if (!res.ok) throw new Error(`Failed to load ${name}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export type PointLookup = Record<string, [number, number]>;

export interface CityDrillMeta {
  city: string;
  semel: number;
  statisticalAreas: number;
  areasWithVotes: number;
  geocodeRate: number;
  note: string;
}

export type FeatureCollection = GeoJSONFC;

export interface AppData {
  parties: Parties;
  settlements: Settlements;
  points: PointLookup;
  resultsMeta: ResultsMeta;
  geoMeta: GeoMeta;
  sankey: SankeyData;
  // GeoJSON is fetched here (main thread, with the auth cookie) and handed to
  // MapLibre as parsed objects — its worker can't carry the cookie past the gate.
  settlementsGeo: FeatureCollection;
  pointsGeo: FeatureCollection;
  allPointsGeo: FeatureCollection;
  seats: SeatsData;
  socio: SocioData;
  /** Optional Tel Aviv neighborhood drill-down (present only if the demo data was built). */
  cityDrill: CityDrillMeta | null;
}

/** Load everything the app needs up front (all files are small + static). */
export async function loadAppData(): Promise<AppData> {
  const [parties, settlements, points, resultsMeta, geoMeta, sankey, settlementsGeo, pointsGeo] = await Promise.all([
    getJson<Parties>("parties.json"),
    getJson<Settlements>("k25-settlements.json"),
    getJson<PointLookup>("settlement-points.json"),
    getJson<ResultsMeta>("results-meta.json"),
    getJson<GeoMeta>("geo-meta.json"),
    getJson<SankeyData>("sankey-25-24.json"),
    getJson<FeatureCollection>("k25-settlements.geojson"),
    getJson<FeatureCollection>("k25-settlements-points.geojson"),
  ]);
  const allPointsGeo = await getJson<FeatureCollection>("k25-all-points.geojson");
  const [seats, socio] = await Promise.all([
    getJson<SeatsData>("seats-25.json"),
    getJson<SocioData>("socio-25.json"),
  ]);
  const cityDrill = await getJson<CityDrillMeta>("telaviv-sa-meta.json").catch(() => null);
  return { parties, settlements, points, resultsMeta, geoMeta, sankey, settlementsGeo, pointsGeo, allPointsGeo, seats, socio, cityDrill };
}

/** Fetch the city drill-down GeoJSON on demand (also through the auth cookie). */
export function loadCityDrill(): Promise<FeatureCollection> {
  return getJson<FeatureCollection>("telaviv-sa.geojson");
}
