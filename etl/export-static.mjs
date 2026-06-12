// Emit shared party metadata for the client (single source of truth = party-map.mjs).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FAMILIES, SEATS_25 } from "./party-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });

writeFileSync(join(OUT, "parties.json"), JSON.stringify(FAMILIES, null, 0));
console.log(`wrote parties.json (${Object.keys(FAMILIES).length} families)`);

// Seats per party (K25), enriched with label/color, sorted largest-first.
const seats = Object.entries(SEATS_25)
  .map(([family, s]) => ({ family, label: FAMILIES[family]?.label ?? family, color: FAMILIES[family]?.color ?? "#c9ccd1", ...s }))
  .sort((a, b) => b.seats - a.seats);
const total = seats.reduce((a, s) => a + s.seats, 0);
if (total !== 120) throw new Error(`K25 seats sum to ${total}, expected 120`);
writeFileSync(join(OUT, "seats-25.json"), JSON.stringify({ knesset: 25, majority: 61, total, parties: seats }));
console.log(`wrote seats-25.json (${seats.length} parties, ${total} seats)`);
