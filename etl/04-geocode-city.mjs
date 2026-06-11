// Phase 4 — the controlled "YELLOW" demo: one-city, neighborhood-resolution
// drill-down (Tel Aviv-Yafo, סמל ישוב 5000). This is the ONLY stage that touches
// the address file + geocoding (the licensing-sensitive path), deliberately scoped
// to a single city for a labeled premium demo. Nationally we never geocode.
//
// Pipeline: TLV ballots (by-ballot results) ⨝ ballot addresses (voting-polls) →
// geocode UNIQUE addresses via public Nominatim (≤1 req/s, cached to etl/cache so
// it runs once) → point-in-polygon into CBS statistical-area polygons → aggregate
// party votes per statistical area → telaviv-sa.geojson.
//
// Geocoding is best-effort: unmatched addresses are reported, not hidden. Partial
// coverage still renders a plausible neighborhood map for a clearly-labeled demo.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as turf from "@turf/turf";
import { fetchAll } from "./lib/ckan.mjs";
import { K25_LETTERS, FAMILIES, META_COLS } from "./party-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "data");
const CACHE = join(__dirname, "cache");
mkdirSync(CACHE, { recursive: true });
const CACHE_FILE = join(CACHE, "geocode-tlv.json");

const SEMEL = 5000;
const BALLOTS = "cc223336-07bc-485d-b160-62df92967c0a"; // K25 by ballot box
const POLLS = "68c4d7e8-2218-48ee-996f-2db2f72b2395";   // voting-polls (addresses)
const SA_FS = "https://services2.arcgis.com/xMRYm7cNgdR5RN6F/arcgis/rest/services/Statistical__Areas_2022/FeatureServer/0/query";
const FAMILY_KEYS = Object.keys(FAMILIES);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };

async function fetchTlvSAs() {
  const url = `${SA_FS}?where=SEMEL_YISHUV%3D${SEMEL}&outFields=STAT_2022&outSR=4326&geometryPrecision=6&f=geojson&resultRecordCount=2000`;
  const res = await fetch(url, { headers: { "User-Agent": "election-maps-mvp/0.1" } });
  if (!res.ok) throw new Error(`SA fetch HTTP ${res.status}`);
  const fc = await res.json();
  console.log(`  TLV statistical areas: ${fc.features.length}`);
  return fc;
}

async function geocode(addresses) {
  const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE)) : {};
  const todo = addresses.filter((a) => !(a in cache));
  console.log(`  geocoding: ${addresses.length} unique addresses, ${todo.length} not cached`);
  let done = 0;
  for (const addr of todo) {
    const q = encodeURIComponent(`${addr}, תל אביב יפו`);
    // Photon (komoot, OSM-based) — tolerant of moderate batches, unlike the public
    // Nominatim server which blocks bulk use. Bias + bbox keep results inside TLV;
    // any stray hit self-filters at the point-in-polygon step.
    const url = `https://photon.komoot.io/api/?q=${q}&limit=1&lat=32.07&lon=34.78&bbox=34.72,32.0,34.87,32.14`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "election-maps-mvp/0.1 (ynet elections demo)" } });
      if (res.ok) {
        const j = await res.json();
        const c = j.features?.[0]?.geometry?.coordinates;
        cache[addr] = Array.isArray(c) ? [c[0], c[1]] : null;
      } else {
        cache[addr] = null;
      }
    } catch {
      cache[addr] = null;
    }
    done++;
    if (done % 25 === 0) {
      writeFileSync(CACHE_FILE, JSON.stringify(cache));
      console.log(`    ${done}/${todo.length} geocoded (${Object.values(cache).filter(Boolean).length} hits)…`);
    }
    await sleep(900);
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
  return cache;
}

async function main() {
  console.log("Building Tel Aviv neighborhood drill-down…");
  const saFC = await fetchTlvSAs();

  // TLV ballots (party votes per קלפי) and addresses (per סמל קלפי = קלפי×10).
  console.log("  fetching TLV ballots + addresses…");
  const ballots = (await fetchAll(BALLOTS)).filter((r) => num(r["סמל ישוב"]) === SEMEL);
  const polls = (await fetchAll(POLLS)).filter((r) => num(r["סמל ישוב"]) === SEMEL);
  console.log(`  ${ballots.length} ballots, ${polls.length} poll addresses`);

  const addrByKalpiCode = new Map(); // סמל קלפי → "street num"
  for (const p of polls) {
    const street = String(p["שם רחוב"] ?? "").trim();
    const house = String(p["מספר בית"] ?? "").trim();
    if (street) addrByKalpiCode.set(String(num(p["סמל קלפי"])), `${street} ${house}`.trim());
  }

  // Unique addresses to geocode.
  const ballotAddr = new Map(); // ballot row → address
  for (const b of ballots) {
    // Sub-ballots (e.g. 19.1, 19.2) share one physical polling station coded N×10.
    const code = String(Math.floor(num(b["קלפי"])) * 10);
    const addr = addrByKalpiCode.get(code);
    if (addr) ballotAddr.set(b, addr);
  }
  const uniqueAddrs = [...new Set([...ballotAddr.values()])];
  const geo = await geocode(uniqueAddrs);

  // Aggregate ballots → statistical area via point-in-polygon.
  const saAgg = new Map(); // STAT_2022 → {parties, valid, voters, eligible}
  let placed = 0, unplaced = 0;
  for (const [b, addr] of ballotAddr) {
    const coord = geo[addr];
    if (!coord) { unplaced++; continue; }
    const pt = turf.point(coord);
    const sa = saFC.features.find((f) => turf.booleanPointInPolygon(pt, f));
    if (!sa) { unplaced++; continue; }
    placed++;
    const id = String(sa.properties.STAT_2022);
    if (!saAgg.has(id)) saAgg.set(id, { parties: {}, valid: 0, voters: 0, eligible: 0 });
    const agg = saAgg.get(id);
    agg.valid += num(b["כשרים"]);
    agg.voters += num(b["מצביעים"]);
    agg.eligible += num(b["בזב"]);
    for (const [col, value] of Object.entries(b)) {
      if (META_COLS.has(col)) continue;
      const v = num(value);
      if (!v) continue;
      const fam = K25_LETTERS[col] ?? "other";
      agg.parties[fam] = (agg.parties[fam] || 0) + v;
    }
  }

  // Attach aggregates to SA polygons.
  let mappedValid = 0;
  for (const f of saFC.features) {
    const id = String(f.properties.STAT_2022);
    const agg = saAgg.get(id);
    const props = { sa: f.properties.STAT_2022, name: `אזור סטטיסטי ${f.properties.STAT_2022}` };
    if (agg && agg.valid > 0) {
      mappedValid += agg.valid;
      let winner = null, winVotes = 0;
      for (const [fam, v] of Object.entries(agg.parties)) {
        if (fam === "other") continue;
        if (v > winVotes) { winner = fam; winVotes = v; }
      }
      props.winner = winner;
      props.winnerShare = +(winVotes / agg.valid).toFixed(4);
      props.valid = agg.valid;
      props.turnout = agg.eligible > 0 ? +(agg.voters / agg.eligible).toFixed(4) : 0;
      props.parties = agg.parties;
      for (const fam of FAMILY_KEYS) {
        if (agg.parties[fam]) props[`sh_${fam}`] = +(agg.parties[fam] / agg.valid).toFixed(4);
      }
    }
    f.properties = props;
  }

  writeFileSync(join(OUT, "telaviv-sa.geojson"), JSON.stringify(saFC));
  const geocoded = Object.values(geo).filter(Boolean).length;
  const meta = {
    city: "תל אביב-יפו", semel: SEMEL,
    statisticalAreas: saFC.features.length,
    areasWithVotes: [...saAgg.keys()].length,
    uniqueAddresses: uniqueAddrs.length,
    geocoded, geocodeRate: +(geocoded / uniqueAddrs.length).toFixed(3),
    ballotsPlaced: placed, ballotsUnplaced: unplaced,
    note: "הדגמת רזולוציית שכונה (אזורים סטטיסטיים) — geocoding דרך Nominatim/OSM, אומדן מבוסס כתובות קלפי. שכבת פרימיום בהמתנה לאישור רישוי מסחרי לקובץ הכתובות.",
  };
  writeFileSync(join(OUT, "telaviv-sa-meta.json"), JSON.stringify(meta, null, 2));
  console.log(`\n  geocoded ${geocoded}/${uniqueAddrs.length} (${(meta.geocodeRate * 100).toFixed(0)}%); ballots placed ${placed}, unplaced ${unplaced}`);
  console.log(`  ${meta.areasWithVotes}/${saFC.features.length} statistical areas have votes`);
  console.log(`  wrote telaviv-sa.geojson + telaviv-sa-meta.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
