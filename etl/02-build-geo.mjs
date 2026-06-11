// Phase 1 (geo): national settlement choropleth, joined to K25 results.
// 100% green (CBS official polygons + CEC results — no addresses, no geocoding).
//
// Source of truth (provenance — see etl/README.md):
//   ISRAEL_CBS_GIS · SOEC_SetlBord_2021_Dissolve, layer 2 — official CBS
//   settlement boundaries (one polygon per locality → full national coverage).
//   Join key SEMEL_YISH == the election files' "סמל ישוב".
// We fetch GENERALIZED geometry server-side (maxAllowableOffset) so the payload is
// ~1MB instead of tens of MB, then simplify a touch more, and attach each
// settlement's winner + per-party vote-shares for data-driven fills.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mapshaper from "mapshaper";
import { FAMILIES } from "./party-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "data");
const RAW = join(__dirname, "raw");
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

const BORDERS = "https://services2.arcgis.com/xMRYm7cNgdR5RN6F/arcgis/rest/services/SOEC_SetlBord_2021_Dissolve/FeatureServer/2/query";
// CBS settlement POINTS — full coverage incl. Judea & Samaria (which the national
// borders layer omits). Used as a bubble fallback for any locality lacking a polygon.
const POINTS = "https://services2.arcgis.com/xMRYm7cNgdR5RN6F/arcgis/rest/services/Setl_Point/FeatureServer/0/query";
const FAMILY_KEYS = Object.keys(FAMILIES);
const UA = { "User-Agent": "election-maps-mvp/0.1" };

async function fetchBorders() {
  const url = `${BORDERS}?where=1%3D1&outFields=SEMEL_YISH&outSR=4326&maxAllowableOffset=0.0002&geometryPrecision=5&f=geojson&resultRecordCount=4000`;
  process.stdout.write("  fetching CBS settlement boundaries (generalized)… ");
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`borders fetch HTTP ${res.status}`);
  const fc = await res.json();
  console.log(`${fc.features.length} settlement polygons`);
  return fc;
}

// semel → [lon, lat] for every settlement (used to place fallback bubbles).
async function fetchSettlementPoints() {
  const byCode = new Map();
  for (let offset = 0; offset < 2000; offset += 1000) {
    const url = `${POINTS}?where=1%3D1&outFields=SETL_CODE&outSR=4326&geometryPrecision=5&f=geojson&resultOffset=${offset}&resultRecordCount=1000`;
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`points fetch HTTP ${res.status}`);
    const fc = await res.json();
    for (const f of fc.features) {
      if (f.geometry?.coordinates) byCode.set(String(f.properties.SETL_CODE), f.geometry.coordinates);
    }
    if (fc.features.length < 1000) break;
  }
  return byCode;
}

async function main() {
  const bordersRaw = await fetchBorders();
  writeFileSync(join(RAW, "setlbord-2021-generalized.geojson"), JSON.stringify(bordersRaw));

  // Simplify + clean (already one polygon per settlement — no dissolve needed).
  console.log("Simplifying (mapshaper)…");
  const simplified = await mapshaper.applyCommands(
    "-i bord.geojson -simplify 22% keep-shapes -clean -o out.geojson format=geojson",
    { "bord.geojson": JSON.stringify(bordersRaw) },
  );
  const fc = JSON.parse(simplified["out.geojson"].toString());

  const results = JSON.parse(readFileSync(join(OUT, "k25-settlements.json")));
  const meta = JSON.parse(readFileSync(join(OUT, "results-meta.json")));
  const totalValid = meta.knessets["25"].totalValid;

  let mappedValid = 0;
  const mappedSemels = new Set();

  for (const f of fc.features) {
    const semel = Number(f.properties.SEMEL_YISH);
    const r = results[String(semel)];
    const props = { semel, name: r?.name ?? "", winner: r?.winner ?? null };
    if (r) {
      mappedValid += r.valid;
      mappedSemels.add(String(semel));
      props.winnerShare = r.winnerShare;
      props.turnout = r.turnout;
      props.valid = r.valid;
      for (const fam of FAMILY_KEYS) {
        const v = r.parties[fam];
        if (v) props[`sh_${fam}`] = +(v / r.valid).toFixed(4);
      }
    }
    f.properties = props;
  }
  writeFileSync(join(OUT, "k25-settlements.geojson"), JSON.stringify(fc));

  // Fallback bubbles: settlements with results but no polygon (mainly Judea &
  // Samaria localities), placed at their CBS settlement point. External-envelope
  // pseudo-localities have no point and are correctly excluded (unmappable).
  console.log("  fetching settlement points for bubble fallback…");
  const pointByCode = await fetchSettlementPoints();
  let bubbleValid = 0;
  const pointFeatures = [];
  for (const [semel, r] of Object.entries(results)) {
    if (mappedSemels.has(semel)) continue;
    const coord = pointByCode.get(semel);
    if (!coord) continue; // no location (e.g. מעטפות חיצוניות)
    bubbleValid += r.valid;
    pointFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coord },
      properties: { semel: +semel, name: r.name, winner: r.winner, winnerShare: r.winnerShare, turnout: r.turnout, valid: r.valid },
    });
  }
  writeFileSync(join(OUT, "k25-settlements-points.geojson"), JSON.stringify({ type: "FeatureCollection", features: pointFeatures }));

  const totalSettlements = Object.keys(results).length;
  const unmapped = Object.entries(results).filter(([s]) => !mappedSemels.has(s) && !pointByCode.has(s));
  const unmappedValid = unmapped.reduce((a, [, r]) => a + r.valid, 0);
  const geoMeta = {
    source: "ISRAEL_CBS_GIS / SOEC_SetlBord_2021_Dissolve (official CBS settlement boundaries) + Setl_Point (settlement points)",
    retrieved: "2026-06-12",
    settlementPolygons: fc.features.length,
    settlementsInResults: totalSettlements,
    settlementsMappedPolygon: mappedSemels.size,
    settlementsMappedBubble: pointFeatures.length,
    coverageByValidVotes_polygon: +(mappedValid / totalValid).toFixed(4),
    coverageByValidVotes_rendered: +((mappedValid + bubbleValid) / totalValid).toFixed(4),
    unmappableSettlements: unmapped.length,
    unmappableValidVotes: unmappedValid,
    unmappableNote: "Mostly מעטפות חיצוניות (external/double-envelope votes: soldiers, prisoners, hospitals, embassies) — no geographic location by definition.",
    topUnmappable: unmapped.sort((a, b) => b[1].valid - a[1].valid).slice(0, 8).map(([s, r]) => ({ semel: +s, name: r.name, valid: r.valid })),
  };
  writeFileSync(join(OUT, "geo-meta.json"), JSON.stringify(geoMeta, null, 2));

  console.log(`\nCoverage: ${(geoMeta.coverageByValidVotes_polygon * 100).toFixed(1)}% on polygons + ${(bubbleValid / totalValid * 100).toFixed(1)}% on bubbles = ${(geoMeta.coverageByValidVotes_rendered * 100).toFixed(1)}% rendered`);
  console.log(`  ${mappedSemels.size} polygons + ${pointFeatures.length} bubbles; ${unmapped.length} truly unmappable (${unmappedValid.toLocaleString()} votes, mostly external envelopes)`);
  console.log(`  wrote k25-settlements.geojson (${(JSON.stringify(fc).length / 1e6).toFixed(2)} MB), ...-points.geojson, geo-meta.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
