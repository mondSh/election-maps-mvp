// Emit shared party metadata for the client (single source of truth = party-map.mjs).
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FAMILIES } from "./party-map.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "data");
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "parties.json"), JSON.stringify(FAMILIES, null, 0));
console.log(`wrote parties.json (${Object.keys(FAMILIES).length} families)`);
