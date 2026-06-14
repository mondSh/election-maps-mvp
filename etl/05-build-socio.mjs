// Phase 5 (data): cross-analyse K25 results with the CBS socio-economic index.
// 100% green (CBS socio-economic cluster by locality + CEC results). Aggregates
// every locality's votes into its socio-economic cluster (1 = weakest … 10 =
// strongest) → each party's vote-share per cluster. Shows "how Israel voted by
// socio-economic standing" — an ecological (aggregate) analysis, NOT individual.
//
// Source: ISRAEL_CBS_GIS · "אשכול חברתי-כלכלי 2021 לפי יישוב" FeatureServer.
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FAMILIES } from "./party-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const SVC = encodeURIComponent("אשכולחברתיכלכלי2021לפייישוב_ExportFeatures");
const LAYER = `https://services2.arcgis.com/xMRYm7cNgdR5RN6F/arcgis/rest/services/${SVC}/FeatureServer/26/query`;
const PLOT_FAMILIES = ["likud", "yesh_atid", "rz", "shas", "utj", "gantz", "raam", "hadash", "labor", "yb"];

async function fetchSocio() {
  const byCode = new Map(); // semel → cluster (1..10)
  for (let offset = 0; offset < 3000; offset += 1000) {
    const url = `${LAYER}?where=CLUSTER_2021%3E0&outFields=SETL_CODE,CLUSTER_2021&returnGeometry=false&f=json&resultOffset=${offset}&resultRecordCount=1000`;
    const res = await fetch(url, { headers: { "User-Agent": "election-maps-mvp/0.1" } });
    if (!res.ok) throw new Error(`socio fetch HTTP ${res.status}`);
    const j = await res.json();
    for (const f of j.features ?? []) {
      const a = f.attributes;
      if (a.SETL_CODE != null && a.CLUSTER_2021 != null) byCode.set(String(Math.round(a.SETL_CODE)), Math.round(a.CLUSTER_2021));
    }
    if (!j.features || j.features.length < 1000) break;
  }
  return byCode;
}

async function main() {
  console.log("Fetching CBS socio-economic clusters by locality…");
  const clusterByCode = await fetchSocio();
  console.log(`  ${clusterByCode.size} localities with a socio-economic cluster`);

  const results = JSON.parse(readFileSync(join(OUT, "k25-settlements.json")));

  // Aggregate votes into clusters 1..10.
  const agg = Array.from({ length: 11 }, () => ({ valid: 0, voters: 0, eligible: 0, localities: 0, parties: {}, towns: [] }));
  let matched = 0;
  for (const [semel, r] of Object.entries(results)) {
    const c = clusterByCode.get(semel);
    if (!c || c < 1 || c > 10) continue;
    matched++;
    const a = agg[c];
    a.valid += r.valid; a.voters += r.voters; a.eligible += r.eligible; a.localities++;
    a.towns.push({ name: r.name, valid: r.valid });
    for (const [fam, v] of Object.entries(r.parties)) a.parties[fam] = (a.parties[fam] || 0) + v;
  }

  const clusters = [];
  for (let c = 1; c <= 10; c++) {
    const a = agg[c];
    if (a.valid === 0) continue;
    const shares = {};
    for (const fam of Object.keys(FAMILIES)) {
      if (a.parties[fam]) shares[fam] = +(a.parties[fam] / a.valid).toFixed(4);
    }
    // Up to 5 recognizable example towns — the largest by valid votes, so a reader
    // can locate their own town's cluster ("my city is here → this is my cluster").
    // (collapse the few double-space CEC source names, e.g. "תל אביב  יפו").
    const examples = a.towns.sort((x, y) => y.valid - x.valid).slice(0, 5).map((t) => t.name.trim().replace(/\s+/g, " "));
    clusters.push({
      cluster: c,
      localities: a.localities,
      valid: a.valid,
      turnout: a.eligible > 0 ? +(a.voters / a.eligible).toFixed(4) : 0,
      examples,
      shares,
    });
  }

  const series = PLOT_FAMILIES.map((fam) => ({
    family: fam,
    label: FAMILIES[fam].label,
    color: FAMILIES[fam].color,
    points: clusters.map((c) => ({ cluster: c.cluster, share: c.shares[fam] ?? 0 })),
  }));

  writeFileSync(join(OUT, "socio-25.json"), JSON.stringify({
    source: "ISRAEL_CBS_GIS · אשכול חברתי-כלכלי 2021 לפי יישוב (CBS socio-economic index)",
    retrieved: "2026-06-12",
    matchedLocalities: matched,
    clusters,
    series,
  }));

  console.log(`  matched ${matched} localities; clusters ${clusters[0]?.cluster}..${clusters.at(-1)?.cluster}`);
  console.log("  Likud / Yesh Atid share by cluster (1=weakest → 10=strongest):");
  const lk = series.find((s) => s.family === "likud").points.map((p) => `${(p.share * 100).toFixed(0)}`).join(" ");
  const ya = series.find((s) => s.family === "yesh_atid").points.map((p) => `${(p.share * 100).toFixed(0)}`).join(" ");
  console.log(`    הליכוד:  ${lk}`);
  console.log(`    יש עתיד: ${ya}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
