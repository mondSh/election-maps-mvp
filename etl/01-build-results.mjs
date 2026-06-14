// Phase 1 (data): pull K25 + K24 by-settlement results, aggregate each row's
// per-letter columns into canonical party families, and compute winner / turnout
// / party breakdown per settlement. Output compact JSON keyed by סמל ישוב.
//
// This stage is 100% "green": only CEC election results, no addresses, no geocoding.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchAll } from "./lib/ckan.mjs";
import { cleanName } from "./lib/clean-name.mjs";
import { LETTERS_BY_KNESSET, FAMILIES, META_COLS } from "./party-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

const RESOURCES = {
  25: "b392b8ee-ba45-4ea0-bfed-f03a1a36e99c",
  24: "9921a347-8466-4ef4-81f9-22523c5c4632",
};

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function buildYear(knesset, rows) {
  const letterMap = LETTERS_BY_KNESSET[knesset];
  const settlements = {};
  const nationalByFamily = {};

  for (const row of rows) {
    const semel = String(num(row["סמל ישוב"]));
    if (semel === "0") continue;
    const eligible = num(row["בזב"]);
    const voters = num(row["מצביעים"]);
    const valid = num(row["כשרים"]);
    const invalid = num(row["פסולים"]);

    const byFamily = {};
    for (const [col, value] of Object.entries(row)) {
      if (META_COLS.has(col)) continue;
      const votes = num(value);
      if (votes === 0) continue;
      const family = letterMap[col] ?? "other";
      byFamily[family] = (byFamily[family] || 0) + votes;
      nationalByFamily[family] = (nationalByFamily[family] || 0) + votes;
    }

    // Winner = real party family with the most votes ("other" is a bucket, never a winner).
    let winner = null;
    let winnerVotes = 0;
    for (const [family, votes] of Object.entries(byFamily)) {
      if (family === "other") continue;
      if (votes > winnerVotes) {
        winner = family;
        winnerVotes = votes;
      }
    }

    settlements[semel] = {
      name: cleanName(row["שם ישוב"]),
      eligible,
      voters,
      valid,
      invalid,
      turnout: eligible > 0 ? +(voters / eligible).toFixed(4) : 0,
      winner,
      winnerVotes,
      winnerShare: valid > 0 ? +(winnerVotes / valid).toFixed(4) : 0,
      parties: byFamily,
    };
  }
  return { settlements, nationalByFamily };
}

async function main() {
  const out = { knessets: {} };
  for (const k of [25, 24]) {
    process.stdout.write(`Fetching K${k} by settlement… `);
    const rows = await fetchAll(RESOURCES[k]);
    console.log(`${rows.length} settlements`);
    const { settlements, nationalByFamily } = buildYear(k, rows);

    const path = join(OUT, `k${k}-settlements.json`);
    writeFileSync(path, JSON.stringify(settlements));

    const totalValid = Object.values(nationalByFamily).reduce((a, b) => a + b, 0);
    const national = Object.entries(nationalByFamily)
      .map(([family, votes]) => ({ family, label: FAMILIES[family]?.label ?? family, votes, share: +(votes / totalValid).toFixed(4) }))
      .sort((a, b) => b.votes - a.votes);

    out.knessets[k] = {
      settlements: Object.keys(settlements).length,
      totalValid,
      national,
    };
    console.log(`  → wrote ${path} (${Object.keys(settlements).length} settlements; ${totalValid.toLocaleString()} valid votes)`);
    console.log(`  national winner: ${national[0].label} ${(national[0].share * 100).toFixed(1)}%`);
  }
  writeFileSync(join(OUT, "results-meta.json"), JSON.stringify(out, null, 2));
  console.log("\nWrote results-meta.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
