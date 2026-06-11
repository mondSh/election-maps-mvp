# מפות בחירות לכנסת — MVP

Interactive **Knesset-25 election map** (by settlement) + a **vote-migration (קולות נודדים)**
Sankey, in RTL Hebrew, built from **open, commercially-licensed** government data and
deployed to **Cloudflare**. Demo for a ynet product review.

## What it does

- **National choropleth (K25):** every settlement colored by its winning party; switch to
  any party to see its vote-share gradient; click a settlement for the full breakdown,
  turnout, and eligible voters. West-Bank localities (which the national-borders layer
  omits) render as vote-sized bubbles. **100% "green" data** — CEC results + CBS polygons,
  no addresses, no geocoding.
- **Vote-migration Sankey (K24 → K25):** a transparent, geographically-grounded *estimate*
  of how the vote shifted (Joint-List split, Yamina → Religious Zionism, etc.), with a
  prominent ecological-fallacy disclaimer.
- **Neighborhood drill-down (Tel Aviv):** a controlled "premium" demo at statistical-area
  resolution — the only feature that touches geocoding (cached Nominatim), clearly labeled
  as pending an address-file licensing decision.

## Stack

Vite + React + TypeScript · MapLibre GL (self-contained style — no tile/font/RTL-plugin
third-party calls) · d3-sankey · deployed to **Cloudflare** as a static-assets SPA via
`@cloudflare/vite-plugin` + Wrangler v4.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/
npx wrangler deploy --dry-run
```

## Data pipeline

All election data is static, so the generated files under `public/data/` are **committed**.
To regenerate, see [`etl/README.md`](etl/README.md) (sources, licensing, provenance):

```bash
npm run etl                      # green pipeline: results + polygons + Sankey
node etl/04-geocode-city.mjs     # Tel Aviv drill-down (slow; geocode cached)
```

## Deploy

```bash
npm run deploy        # vite build && wrangler deploy  (needs `wrangler login`)
```

## Docs

- `docs/knesset-election-maps-plan.md` — research & licensing plan
- `docs/election-maps-pm-letter.md` — memo to the product manager (open questions + costs)
- `docs/election-maps-mvp-build-plan.md` — the build plan this MVP implements

**Attribution:** הלשכה המרכזית לסטטיסטיקה · ועדת הבחירות המרכזית לכנסת · © OpenStreetMap contributors.
