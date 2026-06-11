# ETL — data pipeline & source provenance

All datasets below are **open / commercially-licensed**. The national map is built
**only** from CEC election results + official CBS boundaries — no address file, no
geocoding — so it ships regardless of the one open licensing question (the ballot
**address** file, used only in the scoped Tel Aviv demo). See the PM memo in
`/docs/election-maps-pm-letter.md`.

## Run order

```bash
node etl/01-build-results.mjs   # K25 + K24 results by settlement  → k25/k24-settlements.json
node etl/export-static.mjs      # party metadata                    → parties.json
node etl/02-build-geo.mjs       # CBS settlement polygons + bubbles  → k25-settlements.geojson (+ points)
node etl/03-build-sankey.mjs    # K24→K25 vote-migration estimate    → sankey-25-24.json
node etl/04-geocode-city.mjs    # YELLOW demo: Tel Aviv SA drill-down → telaviv-sa.geojson  (slow; cached)
# or: npm run etl   (runs the green stages 01→03)
```

Generated outputs live in `../public/data/` and are **committed** (election data is static).
`etl/raw/` and `etl/cache/` are working artifacts (raw API dumps / geocode cache).

## Sources & licensing (provenance)

| Data | Source | Resource / Service | License | Used by |
|---|---|---|---|---|
| K25 / K24 results by settlement | ועדת הבחירות המרכזית via **data.gov.il** | CKAN `b392b8ee-…` (K25), `9921a347-…` (K24) | Open (data.gov.il terms) | national map, Sankey |
| K25 results by ballot box | ועדת הבחירות המרכזית via **data.gov.il** | CKAN `cc223336-…` | Open | TLV demo |
| Ballot-box addresses (voting-polls) | רשות האוכלוסין via **data.gov.il** | CKAN `68c4d7e8-…` | ⚠️ **unstated** — see PM memo | TLV demo **only** |
| Settlement boundary polygons | **הלשכה המרכזית לסטטיסטיקה** (official `ISRAEL_CBS_GIS` org) | `SOEC_SetlBord_2021_Dissolve` / FeatureServer / layer 2, field `SEMEL_YISH` | CBS license — commercial use permitted with attribution | national choropleth |
| Settlement points (incl. Judea & Samaria) | **CBS** (`ISRAEL_CBS_GIS`) | `Setl_Point` / FeatureServer / 0, field `SETL_CODE` | CBS license (commercial + attribution) | bubble fallback, labels |
| Statistical-area polygons 2022 | **CBS** (`ISRAEL_CBS_GIS`) | `Statistical__Areas_2022` / FeatureServer / 0, field `SEMEL_YISHUV`/`STAT_2022` | CBS license (commercial + attribution) | TLV neighborhood demo |
| Geocoding (TLV demo) | **Nominatim / OpenStreetMap** | public endpoint, ≤1 req/s, cached | ODbL (commercial OK, attribution) | TLV demo only |

Retrieved: **2026-06-12**. CBS FeatureServer base:
`https://services2.arcgis.com/xMRYm7cNgdR5RN6F/arcgis/rest/services/`.
These are CBS's **own** ArcGIS Online services (not a third-party mirror).

**Required attribution (shown in the app footer):** "מקורות: הלשכה המרכזית לסטטיסטיקה ·
ועדת הבחירות המרכזית לכנסת · © OpenStreetMap contributors".

## Coverage (honest disclosure — see `public/data/geo-meta.json`)

- ~85.7% of national valid votes fall on a settlement **polygon**; +~4% render as
  **bubbles** (mainly Judea & Samaria localities the national-borders layer omits).
- The remaining ~10% is almost entirely **מעטפות חיצוניות** (external/double-envelope
  votes — soldiers, prisoners, hospitals, embassies), which have no geographic
  location by definition and are correctly excluded.

## Party continuity (hand-curated — `party-map.mjs`)

Letters denote different parties across elections, so the canonical-family mapping is
manual and curated from the CEC (the `candidates-lists` dataset has **no** K25). Verified
against live vote columns — e.g. `עם`=רע"ם (dominant in Bedouin localities), `ום`=חד"ש־תע"ל;
K24 `ב`=ימינה, `ת`=תקווה חדשה, `ודעם`=הרשימה המשותפת.
