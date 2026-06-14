export type FamilyKey = string;

export interface Party {
  label: string;
  color: string;
}
export type Parties = Record<FamilyKey, Party>;

export interface Settlement {
  name: string;
  eligible: number;
  voters: number;
  valid: number;
  invalid: number;
  turnout: number;
  winner: FamilyKey | null;
  winnerVotes: number;
  winnerShare: number;
  parties: Record<FamilyKey, number>;
}
export type Settlements = Record<string, Settlement>;

export interface NationalEntry {
  family: string;
  label: string;
  votes: number;
  share: number;
}
export interface ResultsMeta {
  knessets: Record<string, { settlements: number; totalValid: number; national: NationalEntry[] }>;
}

export interface GeoMeta {
  source: string;
  retrieved: string;
  settlementPolygons: number;
  settlementsInResults: number;
  settlementsMappedPolygon: number;
  settlementsMappedBubble: number;
  coverageByValidVotes_polygon: number;
  coverageByValidVotes_rendered: number;
  unmappableSettlements: number;
  unmappableValidVotes: number;
  unmappableNote: string;
}

export interface SankeyNode {
  id: string;
  label: string;
  color: string;
}
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}
export interface SankeyData {
  method: string;
  fromKnesset: number;
  toKnesset: number;
  minLinkShown: number;
  totalFlow: number;
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/** Coloring mode: winning party, one party's vote-share, or its 2021→2022 swing. */
export type ColorMode =
  | { kind: "winner" }
  | { kind: "party"; family: FamilyKey }
  | { kind: "swing"; family: FamilyKey };

export interface SocioSeries {
  family: FamilyKey;
  label: string;
  color: string;
  points: { cluster: number; share: number }[];
}
export interface SocioCluster {
  cluster: number;
  localities: number;
  valid: number;
  turnout: number;
  /** Up to 5 recognizable example towns (largest by valid votes) so a reader can self-locate. */
  examples: string[];
  shares: Record<FamilyKey, number>;
}
export interface SocioData {
  source: string;
  matchedLocalities: number;
  clusters: SocioCluster[];
  series: SocioSeries[];
}

/** UI + map theme. */
export type Theme = "light" | "dark";
/** Map render mode: filled polygons vs. vote-sized proportional symbols. */
export type MapViewMode = "choropleth" | "bubbles";

export type Bloc = "net" | "opp" | "arab";
export interface SeatParty {
  family: FamilyKey;
  label: string;
  color: string;
  seats: number;
  bloc: Bloc;
}
export interface SeatsData {
  knesset: number;
  majority: number;
  total: number;
  parties: SeatParty[];
}
