---
title: "Build Plan — Election Maps MVP (for Claude Code)"
title_he: "תוכנית בנייה ל-MVP של מפות הבחירות — עבור Claude Code"
type: build-plan
project: "מפות בחירות לכנסת עבור ynet"
date: 2026-06-11
author: Oren Mondshein
tags: [elections, mvp, cloudflare, vite, claude-code]
status: ready-to-build
---

# Build Plan — Election Maps MVP (for Claude Code)

> **עברית (למשתמש):** זהו plan עבור Claude Code לבניית ה-MVP. המטרה: דמו **מרשים** למנהל המוצר, שבנוי ברובו על נתונים "ירוקים" (מותרים מסחרית), עם **הצצה מבוקרת אחת** ל"נקודות הצהובות" (geocoding של עיר אחת ברזולוציית שכונה). ה-stack ננעל: **Cloudflare + Vite + Wrangler האחרון**. תן את כל הקובץ הזה ל-Claude Code.

---

## 0. Mission & "good impression" targets

Build a polished, **RTL Hebrew**, interactive **Knesset-25 election map** + a **"vote migration" (קולות נודדים) Sankey**, deployed on **Cloudflare**. It must look production-grade for a product-manager demo.

Strategy: **stay mostly "green"** (commercially-cleared data), and include **one controlled "yellow" demo** — a geocoded, neighborhood-resolution (statistical-area) drill-down for a single city — to showcase the premium capability without nationwide legal exposure.

**Definition of done (MVP):** a deployed Cloudflare URL with (a) national K25 choropleth, (b) one-city neighborhood drill-down, (c) K25↔K24 Sankey, all in Hebrew RTL, mobile-responsive, with a source-credits footer.

## 1. Tech stack (locked — do not substitute)

- **Vite + React + TypeScript**
- **Cloudflare**: deploy as a **Worker with Static Assets** via the **`@cloudflare/vite-plugin`**, managed by **Wrangler v4** (`wrangler.jsonc`).
- **Map**: **MapLibre GL JS** (open-source) + `@mapbox/mapbox-gl-rtl-text` for Hebrew RTL labels.
- **Sankey**: `d3-sankey` + `d3-shape` (or ECharts if faster).
- **Data**: precomputed **offline** by Node/TS ETL scripts → static `*.json` / `*.geojson` served as assets. Election data is static, so **commit the generated data**.

> ⚠️ **Before scaffolding/deploying, load the `wrangler` skill and verify current commands** — this plan is written ahead of build time and Cloudflare's CLI evolves. Treat the snippets below as the intended shape, not gospel.

## 2. Repo layout

```
election-maps/
  etl/                     # Node+TS data pipeline (run manually)
    fetch-results.ts       # pull from data.gov.il CKAN
    party-map.ts           # letter-symbol -> {name, color}
    build-settlements.ts   # national choropleth GeoJSON
    build-sankey.ts        # K25<->K24 flows
    geocode-city.ts        # one-city drill-down (the "yellow" demo)
    cache/                 # committed geocode cache (run once)
  app/
    src/ ...               # React + MapLibre + Sankey
    public/data/           # generated JSON/GeoJSON (committed)
  wrangler.jsonc
  vite.config.ts
```

## 3. Scaffold (Phase 0)

```bash
# Preferred: C3 React template (sets up Vite + Cloudflare plugin + wrangler)
npm create cloudflare@latest -- election-maps --framework=react
# then:
npm i maplibre-gl @mapbox/mapbox-gl-rtl-text d3-sankey d3-shape
npm i -D wrangler@latest @cloudflare/vite-plugin typescript @types/d3-sankey
```

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({ plugins: [react(), cloudflare()] });
```

`wrangler.jsonc` (assets-only SPA — no backend needed for MVP):
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "election-maps",
  "compatibility_date": "2026-06-11",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

Verify: `npm run dev` (Vite) works, and `wrangler deploy --dry-run` passes. Deploy later with `wrangler deploy` (or `npm run deploy`).

## 4. Data sources (already verified — use these IDs directly)

CKAN base: `https://data.gov.il/api/3/action/`
- `datastore_search?resource_id=<id>&limit=N`
- `datastore_search_sql?sql=SELECT ... FROM "<resource_id>"` (resource_id is the table name, in double quotes)

| Dataset | resource_id |
|---|---|
| K25 by ballot box (קלפי) — 12,545 rows | `cc223336-07bc-485d-b160-62df92967c0a` |
| K25 by settlement (יישוב) — 1,216 rows | `b392b8ee-ba45-4ea0-bfed-f03a1a36e99c` |
| K24 by ballot box | `419be3b0-fd30-455a-afc0-034ec36be990` |
| K24 by settlement | `9921a347-8466-4ef4-81f9-22523c5c4632` |
| candidates-lists K24 (letter→name) | `0f07d5bf-5b8d-4c28-bf37-e69459ddb4ed` |
| voting-polls (ballot-box addresses) | `68c4d7e8-2218-48ee-996f-2db2f72b2395` |

**Vote-file columns:** `סמל ישוב` (settlement code — the stable join key), `שם ישוב`, `קלפי` (ballot number, e.g. `3.1`), `בזב` (eligible voters), `מצביעים` (voters), `כשרים` (valid), `פסולים` (invalid), then **one column per party = its letter-symbol** (`מחל`, `פה`, `אמת`, `ג`, `שס`, `ום`, …) holding vote counts.

**Geography (CBS, green/commercial-OK):** CBS **statistical areas 2022** layer (GDB). Convert to GeoJSON and simplify with `ogr2ogr` / `mapshaper`. **Dissolve by settlement code → settlement polygons** for the national map (no extra source needed). Keep WGS84 (EPSG:4326) for MapLibre.

**voting-polls columns:** `סמל ישוב`, `סמל קלפי`, `שם רחוב`, `מספר בית`, `שם ישוב`. ⚠️ Verify the `קלפי` (results) ↔ `סמל קלפי` (polls) key format matches before joining.

## 5. Party mapping (Phase 1 dependency)

`etl/party-map.ts` — letter-symbol → `{name, color}`.
- **K24:** build from the `candidates-lists` K24 resource (fields `אותיות` → `שם הרשימה`).
- **K25:** ⚠️ **candidates-lists has NO K25.** Hardcode a curated map (below) and **verify/complete it against the official CEC source** `votes25.bechirot.gov.il` (do not guess the smaller lists).

High-confidence K25 majors to seed:
```ts
מחל→הליכוד · פה→יש עתיד · שס→ש"ס · ג→יהדות התורה · אמת→העבודה ·
ט→הציונות הדתית · כן→המחנה הממלכתי · ל→ישראל ביתנו · מרצ→מרצ · ום→רע"ם
```
Assign each a distinct brand-ish color; everything else → "אחר/Other" (grey). Flag the rest as **TODO: verify** rather than inventing.

## 6. Build steps (ordered)

### Phase 1 — National settlement choropleth (GREEN, no geocoding) — the instant "wow"
1. `fetch-results.ts`: pull **K25 by settlement** via `datastore_search_sql`; normalize; map letters→names; per settlement compute **winner**, top-3 parties, turnout%. Output `public/data/k25-settlements.json` keyed by `סמל ישוב`.
2. `build-settlements.ts`: load CBS SA-2022 GeoJSON → **dissolve by settlement code** → simplify → **join results on `סמל ישוב`** → write `public/data/k25-settlements.geojson` (props: winner, colorKey, top parties, turnout). Settlements without a polygon → `public/data/k25-settlements-points.json` (rendered as circles).

### Phase 2 — Frontend map
3. MapLibre map centered on Israel; enable RTL (`maplibregl.setRTLTextPlugin(...)`); free base style (MapTiler free key **or** OpenFreeMap — no Google).
4. Fill layer colored by winning-party color; hover/click → Hebrew popup with full breakdown; **legend**; a **party selector** that recolors by the selected party's vote-share (choropleth gradient).
5. RTL Hebrew app shell: header, short "איך זה עובד" methodology note, **source-credits footer** ("מקורות: הלשכה המרכזית לסטטיסטיקה; ועדת הבחירות המרכזית לכנסת; © OpenStreetMap contributors").

### Phase 3 — Wandering-votes Sankey (GREEN)
6. `build-sankey.ts`: pull **K24 + K25 by settlement**; map both to canonical parties; aggregate nationally; estimate K24→K25 flows; add **"נשארו בבית / מצביעים חדשים"** nodes from the turnout delta (use `בזב` vs `מצביעים`). Output `public/data/sankey-25-24.json`.
   - **MVP method (transparent heuristic, label it אומדן/estimate):** per settlement, split each K25 party's votes across K24 parties proportionally to K24 shares with a **loyalty bias** (a party retains most of its own voters); sum flows nationally. This is **not** true individual transfer.
   - **Upgrade path (future, not MVP):** ecological inference (King / R×C). Don't build it now.
7. Sankey tab (`d3-sankey`): Hebrew labels, party colors, and a **prominent disclaimer**: *"אומדן בלבד — אי אפשר לדעת כיצד הצביע אדם יחיד; נתון לכשל אקולוגי."*

### Phase 4 — Controlled "yellow" demo: one-city neighborhood drill-down
8. `geocode-city.ts` for **one city** (e.g., תל אביב-יפו, `סמל ישוב` 5000): pull its ballot-box rows + addresses; **geocode ~500 addresses with self-hosted/﻿public Nominatim** (1 req/s, set a real `User-Agent`, **cache to `etl/cache/`** so it runs once); point-in-polygon assign each ballot box to a CBS statistical area; aggregate votes per SA → `public/data/telaviv-sa.geojson`.
9. Frontend: zooming into that city swaps to the **SA-level choropleth** (neighborhood resolution). Label it **"הדגמת רזולוציית שכונה (אזורים סטטיסטיים)"** + a small banner: *"שכבת פרימיום — נתוני כתובות בהמתנה לאישור רישוי."* (transparently "touches the yellow point").

### Phase 5 — Polish & deploy
10. Mobile-responsive; loading skeletons; Hebrew number formatting (`Intl.NumberFormat('he-IL')`); keyboard/aria accessibility.
11. `wrangler deploy` → hand the `*.workers.dev` URL to the PM for the demo.

## 7. Guardrails (do not violate)

- ❌ **Do NOT scrape or copy** ynet / kolot-nodedim — reference/inspiration only.
- 🟡 **Geocode only the one demo city** for MVP. **Do not bulk-geocode nationally** until legal sign-off on the address file.
- 🛰️ **No Google geocoding** in the MVP (TOS storage limits). Use Nominatim (cache results).
- 🟢 National maps must use **only** election results + CBS polygons (no address file) — so they're shippable regardless of the legal decision.
- 🔗 Respect Nominatim policy (≤1 req/s, real User-Agent, cache). Keep all data static/precomputed; **no secrets needed** for MVP.
- 📝 Attribution footer is **mandatory**.

## 8. Stretch (only if time remains)
- Year selector to load K23/K22 settlement maps (same engine, data-only).
- Shareable deep-links (`?party=מחל&year=25`).
- Swap base tiles for a self-hosted style to remove the last third-party dependency.
