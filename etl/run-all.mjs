// Orchestrate the GREEN data pipeline (results + polygons + Sankey). The Tel Aviv
// drill-down (04-geocode-city.mjs) is run separately — it's slow and geocoding-bound.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const steps = ["01-build-results.mjs", "export-static.mjs", "02-build-geo.mjs", "03-build-sankey.mjs"];

for (const step of steps) {
  console.log(`\n▶ ${step}`);
  execFileSync(process.execPath, [join(here, step)], { stdio: "inherit" });
}
console.log("\n✅ Green pipeline complete. For the Tel Aviv demo: node etl/04-geocode-city.mjs");
