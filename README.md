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
- **Coalition builder ("בנה ממשלה"):** a 120-seat hemicycle — click parties to assemble a
  coalition, live 61-seat majority bar, historical presets. Official K25 seats.
- **Demographics:** vote-share per party across the **CBS socio-economic clusters** (1–10),
  with an ecological-fallacy caveat. Green (CBS).
- **Swing map + year toggle:** per-settlement 2021→2022 shift (diverging), and a 2022⇄2021
  winner toggle.
- **Bubbles view:** a proportional-symbol map (vote-sized circles) that removes the
  choropleth's area-bias.

See `docs/election-2026-components-ideas.md` for the researched roadmap these were drawn from.

- **Dark mode:** UI **and** map theme, toggle in the header, follows `prefers-color-scheme`,
  persisted to `localStorage`, applied before first paint (no flash).
- **Access gate:** a small Cloudflare Worker (`src/worker.ts`) gates the data behind an
  access code; correct code → 30-day HttpOnly cookie. Login modal + logout button. The app
  shell stays public so the login screen can load. **If `APP_CODE` is unset the gate is
  disabled** and the app is fully public.

## Stack

Vite + React + TypeScript · MapLibre GL (self-contained style — no tile/font/RTL-plugin
third-party calls) · d3-sankey · deployed to **Cloudflare** as a **Worker + static assets**
via `@cloudflare/vite-plugin` + Wrangler v4.

## Access code (gate)

- Local: set the secret in `.dev.vars` (gitignored) — `APP_CODE=...` (see `.dev.vars.example`).
  The gate is enforced by the real Worker, so test it with `wrangler dev` (Vite's dev server
  serves `public/` directly and bypasses the gate).
- Production: `npx wrangler secret put APP_CODE`.
- Note: GeoJSON is fetched on the main thread (with the cookie) and handed to MapLibre as a
  parsed object — MapLibre's web worker can't carry the cookie past the gate.

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
npx wrangler secret put APP_CODE   # set the access code (once)
npm run deploy                     # vite build && wrangler deploy  (needs `wrangler login`)
```

## Docs

- `docs/knesset-election-maps-plan.md` — research & licensing plan
- `docs/election-maps-pm-letter.md` — memo to the product manager (open questions + costs)
- `docs/election-maps-mvp-build-plan.md` — the build plan this MVP implements

**Attribution:** הלשכה המרכזית לסטטיסטיקה · ועדת הבחירות המרכזית לכנסת · © OpenStreetMap contributors.
