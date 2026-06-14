import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, type StyleSpecification, type ExpressionSpecification, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ColorMode, Parties, Settlements, Theme, MapViewMode } from "../types";
import type { PointLookup, FeatureCollection } from "../data";
import { fmt, pct } from "../format";

// Map palette per theme. Party colors are brand colors and stay constant; only the
// "scaffolding" colors (sea background, no-data fill, gradient low-end, selected
// outline) flip between light and dark.
const PALETTE: Record<Theme, { sea: string; noData: string; gradLow: string; selected: string }> = {
  light: { sea: "#dfe7ec", noData: "#e3ded3", gradLow: "#eef1f4", selected: "#11161d" },
  dark: { sea: "#0e131b", noData: "#2c333f", gradLow: "#1b2330", selected: "#f2f5f9" },
};

interface Props {
  parties: Parties;
  settlements: Settlements;
  points: PointLookup;
  colorMode: ColorMode;
  selected: string | null;
  onSelect: (semel: string | null) => void;
  settlementsGeo: FeatureCollection;
  pointsGeo: FeatureCollection;
  allPointsGeo: FeatureCollection;
  /** When set, swap to the neighborhood (statistical-area) drill-down for that GeoJSON. */
  drillData: FeatureCollection | null;
  theme: Theme;
  /** Election year for winner/share coloring: 25 = 2022, 24 = 2021. */
  year: 24 | 25;
  /** "choropleth" = filled polygons; "bubbles" = vote-sized proportional symbols. */
  mapView: MapViewMode;
}

const TLV_BOUNDS: [[number, number], [number, number]] = [[34.736, 32.01], [34.862, 32.13]];
const ISRAEL_BOUNDS: [[number, number], [number, number]] = [[34.2, 29.45], [35.95, 33.4]];

type Pal = (typeof PALETTE)[Theme];

/** fill-color expression for the current coloring mode + election year. */
function fillExpression(mode: ColorMode, parties: Parties, pal: Pal, year: 24 | 25): ExpressionSpecification {
  const winnerField = year === 25 ? "winner" : "winner24";
  const sharePrefix = year === 25 ? "sh" : "sh24";
  if (mode.kind === "winner") {
    const pairs: (string | string[])[] = [];
    for (const [key, p] of Object.entries(parties)) {
      if (key === "other") continue;
      pairs.push(key, p.color);
    }
    return ["match", ["get", winnerField], ...pairs, pal.noData] as unknown as ExpressionSpecification;
  }
  if (mode.kind === "swing") {
    // Δ vote-share 2021→2022 for the selected party; neutral where K24 data is absent.
    const delta: ExpressionSpecification = [
      "case",
      ["all", ["has", `sh_${mode.family}`], ["has", `sh24_${mode.family}`]],
      ["-", ["get", `sh_${mode.family}`], ["get", `sh24_${mode.family}`]],
      0,
    ] as unknown as ExpressionSpecification;
    return [
      "interpolate", ["linear"], delta,
      -0.12, "#b3322c", -0.03, "#dca39b", 0, pal.gradLow, 0.03, "#8fb4e0", 0.12, "#1f4e8c",
    ] as unknown as ExpressionSpecification;
  }
  const color = parties[mode.family]?.color ?? "#3367d6";
  return [
    "interpolate", ["linear"], ["coalesce", ["get", `${sharePrefix}_${mode.family}`], 0],
    0, pal.gradLow,
    0.5, color,
  ] as ExpressionSpecification;
}

function baseStyle(pal: Pal): StyleSpecification {
  // No `glyphs` key at all — we render labels as HTML markers, not GL symbols.
  return {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": pal.sea } }],
  };
}

const CHOROPLETH_LAYERS = ["settle-fill", "settle-line", "settle-selected", "bubbles"];

export default function MapView({ parties, settlements, points, colorMode, selected, onSelect, settlementsGeo, pointsGeo, allPointsGeo, drillData, theme, year, mapView }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const yearRef = useRef(year);
  yearRef.current = year;
  const mapViewRef = useRef(mapView);
  mapViewRef.current = mapView;
  const settlementsRef = useRef(settlements);
  settlementsRef.current = settlements;
  const labelsRef = useRef<LabelManager | null>(null);
  const [ready, setReady] = useState(false);

  // ---- init map once ----
  useEffect(() => {
    if (!containerRef.current) return;
    const pal = PALETTE[themeRef.current];
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(pal),
      center: [35.1, 31.4],
      zoom: 6.7,
      minZoom: 6,
      maxZoom: 13,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.touchZoomRotate.disableRotation();

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, className: "hover-popup" });
    popupRef.current = popup;

    map.on("load", () => {
      map.addSource("settlements", { type: "geojson", data: settlementsGeo, promoteId: "semel" });
      map.addSource("points", { type: "geojson", data: pointsGeo, promoteId: "semel" });

      map.addLayer({
        id: "settle-fill", type: "fill", source: "settlements",
        paint: {
          "fill-color": fillExpression(colorMode, parties, pal, yearRef.current),
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.95, 0.82],
        },
      });
      map.addLayer({
        id: "settle-line", type: "line", source: "settlements",
        paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.2, 10, 0.8], "line-opacity": 0.5 },
      });
      map.addLayer({
        id: "settle-selected", type: "line", source: "settlements",
        filter: ["==", ["get", "semel"], -1],
        paint: { "line-color": pal.selected, "line-width": 2.2 },
      });

      // West-Bank / no-polygon settlements as proportional bubbles.
      map.addLayer({
        id: "bubbles", type: "circle", source: "points",
        paint: {
          "circle-color": winnerCircleColor(parties, pal),
          "circle-radius": ["interpolate", ["linear"], ["sqrt", ["coalesce", ["get", "valid"], 0]], 0, 2.5, 60, 6, 170, 14],
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-opacity": 0.92,
        },
      });

      // Proportional-symbol "cartogram" view: every settlement a vote-sized circle.
      map.addSource("allpoints", { type: "geojson", data: allPointsGeo, promoteId: "semel" });
      map.addLayer({
        id: "cartogram", type: "circle", source: "allpoints",
        layout: { visibility: mapViewRef.current === "bubbles" ? "visible" : "none" },
        paint: {
          "circle-color": fillExpression(colorMode, parties, pal, yearRef.current),
          "circle-radius": ["interpolate", ["linear"], ["sqrt", ["coalesce", ["get", "valid"], 0]], 0, 1.5, 80, 5, 520, 26],
          "circle-stroke-color": pal.sea, "circle-stroke-width": 0.6, "circle-opacity": 0.9,
        },
      });
      if (mapViewRef.current === "bubbles") for (const l of CHOROPLETH_LAYERS) map.setLayoutProperty(l, "visibility", "none");

      map.fitBounds([[34.2, 29.45], [35.95, 33.4]], { padding: 24, animate: false });
      labelsRef.current = createCityLabels(map, settlements, points);

      for (const layer of ["settle-fill", "bubbles", "cartogram"]) {
        map.on("mousemove", layer, (e) => onHover(e, layer));
        map.on("mouseleave", layer, () => clearHover());
        map.on("click", layer, (e) => {
          const f = e.features?.[0];
          if (f) onSelectRef.current(String(f.properties?.semel));
        });
      }
      map.on("click", "settle-fill", () => {}); // ensure fill wins over background
      setReady(true);
    });

    function onHover(e: maplibregl.MapLayerMouseEvent, layer: string) {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      const semel = String(f.properties?.semel);
      if (layer === "settle-fill") {
        if (hoveredRef.current && hoveredRef.current !== semel) {
          map.setFeatureState({ source: "settlements", id: hoveredRef.current }, { hover: false });
        }
        hoveredRef.current = semel;
        map.setFeatureState({ source: "settlements", id: semel }, { hover: true });
      }
      const s = settlementsRef.current[semel];
      const name = s?.name ?? settlements[semel]?.name ?? "";
      const yr = yearRef.current === 25 ? "2022" : "2021";
      if (s) {
        const winnerLabel = s.winner ? parties[s.winner]?.label ?? "" : "ללא נתונים";
        popupRef.current
          ?.setLngLat(e.lngLat)
          .setHTML(`<strong>${name}</strong> <span class="muted">· ${yr}</span><br/>${winnerLabel}${s.winner ? ` · ${pct(s.winnerShare)}` : ""}<br/><span class="muted">${fmt(s.valid)} קולות · השתתפות ${pct(s.turnout)}</span>`)
          .addTo(map);
      } else {
        popupRef.current?.setLngLat(e.lngLat).setHTML(`<strong>${name}</strong> <span class="muted">· ${yr}</span><br/><span class="muted">אין נתונים</span>`).addTo(map);
      }
    }
    function clearHover() {
      map.getCanvas().style.cursor = "";
      if (hoveredRef.current) map.setFeatureState({ source: "settlements", id: hoveredRef.current }, { hover: false });
      hoveredRef.current = null;
      popupRef.current?.remove();
    }

    return () => { labelsRef.current?.destroy(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- repaint on colorMode or theme change (national + drill layers) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const pal = PALETTE[theme];
    const expr = fillExpression(colorMode, parties, pal, year);
    map.setPaintProperty("bg", "background-color", pal.sea);
    if (map.getLayer("settle-fill")) map.setPaintProperty("settle-fill", "fill-color", expr);
    if (map.getLayer("city-fill")) map.setPaintProperty("city-fill", "fill-color", expr);
    if (map.getLayer("bubbles")) map.setPaintProperty("bubbles", "circle-color", winnerCircleColor(parties, pal));
    if (map.getLayer("cartogram")) {
      map.setPaintProperty("cartogram", "circle-color", expr);
      map.setPaintProperty("cartogram", "circle-stroke-color", pal.sea);
    }
    if (map.getLayer("settle-selected")) map.setPaintProperty("settle-selected", "line-color", pal.selected);
  }, [colorMode, theme, parties, ready, year]);

  // ---- city drill-down: create the SA source + frame the city ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("settle-fill")) return; // wait until base layers exist

    if (drillData) {
      if (!map.getSource("city")) {
        map.addSource("city", { type: "geojson", data: drillData, promoteId: "sa" });
        map.addLayer({
          id: "city-fill", type: "fill", source: "city",
          paint: { "fill-color": fillExpression(colorMode, parties, PALETTE[themeRef.current], yearRef.current), "fill-opacity": 0.85 },
        });
        map.addLayer({
          id: "city-line", type: "line", source: "city",
          paint: { "line-color": "#ffffff", "line-width": 0.7, "line-opacity": 0.65 },
        });
        map.on("mousemove", "city-fill", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          map.getCanvas().style.cursor = "pointer";
          const p = f.properties ?? {};
          const winnerLabel = p.winner ? parties[p.winner as string]?.label ?? "" : "ללא נתונים";
          const body = p.winner
            ? `${winnerLabel} · ${pct(Number(p.winnerShare))}<br/><span class="muted">${fmt(Number(p.valid))} קולות · השתתפות ${pct(Number(p.turnout))}</span>`
            : `<span class="muted">ללא קלפי באזור זה</span>`;
          popupRef.current?.setLngLat(e.lngLat).setHTML(`<strong>${p.name}</strong><br/>${body}`).addTo(map);
        });
        map.on("mouseleave", "city-fill", () => { map.getCanvas().style.cursor = ""; popupRef.current?.remove(); });
      } else {
        (map.getSource("city") as GeoJSONSource).setData(drillData);
      }
      map.fitBounds(TLV_BOUNDS, { padding: 30, animate: true });
    } else {
      map.fitBounds(ISRAEL_BOUNDS, { padding: 24, animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillData, ready]);

  // ---- single source of truth for base-layer visibility ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("settle-fill")) return;
    const setVis = (ids: string[], v: "visible" | "none") => {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    };
    const drilled = !!drillData;
    setVis(["city-fill", "city-line"], drilled ? "visible" : "none");
    setVis(CHOROPLETH_LAYERS, !drilled && mapView === "choropleth" ? "visible" : "none");
    setVis(["cartogram"], !drilled && mapView === "bubbles" ? "visible" : "none");
    labelsRef.current?.setEnabled(!drilled); // national settlement labels off in the SA drill-down
  }, [drillData, mapView, ready]);

  // ---- selected highlight + fly ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("settle-selected")) return;
    map.setFilter("settle-selected", ["==", ["get", "semel"], selected ? Number(selected) : -1]);
    if (selected && points[selected]) {
      map.flyTo({ center: points[selected], zoom: Math.max(map.getZoom(), 9), speed: 0.8 });
    }
  }, [selected, points]);

  return <div ref={containerRef} className="map-canvas" />;
}

function winnerCircleColor(parties: Parties, pal: Pal): ExpressionSpecification {
  const pairs: (string | string[])[] = [];
  for (const [key, p] of Object.entries(parties)) {
    if (key === "other") continue;
    pairs.push(key, p.color);
  }
  return ["match", ["get", "winner"], ...pairs, pal.noData] as unknown as ExpressionSpecification;
}

interface LabelManager {
  /** Show/hide the whole label layer (hidden in the city drill-down). */
  setEnabled(on: boolean): void;
  /** Remove listeners + every live marker. */
  destroy(): void;
}

/**
 * Progressive settlement labels as HTML markers (no glyph server, stays self-contained).
 *
 * Real map engines hide overlapping text automatically; HTML markers don't, so we do the
 * collision ourselves — greedily, biggest-town-first, in absolute Web-Mercator world-pixel
 * space at the current zoom. World-pixel (not screen) coords make a label's eligibility
 * depend on zoom alone, so the set is stable while you pan and simply grows as you zoom in.
 * A marker pool keeps only the on-screen labels live in the DOM, so the candidate list can
 * be the full ~1,200 settlements without 1,200 DOM nodes.
 */
function createCityLabels(map: MlMap, settlements: Settlements, points: PointLookup): LabelManager {
  const LINE_H = 14; // px — .city-label line box
  const PAD_X = 7; // px — half-gap each side (covers the ~4px text-shadow halo + breathing room)
  const PAD_Y = 6;
  const FONT = '700 12px "Moses","Heebo",system-ui,-apple-system,"Segoe UI",sans-serif';

  // Candidate list, importance-sorted (votes desc), with normalized mercator coords [0,1].
  const candidates = Object.entries(settlements)
    .filter(([semel, s]) => points[semel] && s.name)
    .map(([semel, s]) => {
      const [lng, lat] = points[semel];
      const m = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat });
      return { semel, name: s.name.trim(), valid: s.valid, mx: m.x, my: m.y };
    })
    .sort((a, b) => b.valid - a.valid);

  // Text widths via canvas. measureText lies until the webfont resolves, so we measure once
  // up front (fallback metrics) and again on document.fonts.ready.
  const ctx = document.createElement("canvas").getContext("2d")!;
  const widths = new Map<string, number>();
  const measure = () => {
    ctx.font = FONT;
    for (const c of candidates) widths.set(c.semel, ctx.measureText(c.name).width);
  };

  let enabled = true;
  let eligible = new Set<string>();
  const pool = new Map<string, maplibregl.Marker>();

  // Greedy collision in world pixels at the current zoom → the set that fits without overlap.
  const computeEligible = () => {
    const scale = 512 * Math.pow(2, map.getZoom());
    const placed: { x: number; y: number; hw: number; hh: number }[] = [];
    const next = new Set<string>();
    for (const c of candidates) {
      const x = c.mx * scale;
      const y = c.my * scale;
      const hw = (widths.get(c.semel) ?? c.name.length * 7) / 2 + PAD_X;
      const hh = LINE_H / 2 + PAD_Y;
      let ok = true;
      for (const p of placed) {
        if (Math.abs(x - p.x) < hw + p.hw && Math.abs(y - p.y) < hh + p.hh) { ok = false; break; }
      }
      if (ok) { placed.push({ x, y, hw, hh }); next.add(c.semel); }
    }
    eligible = next;
  };

  // Instantiate DOM only for eligible labels currently in view; tear down the rest.
  const syncViewport = () => {
    if (!enabled) return;
    const b = map.getBounds();
    for (const [semel, marker] of pool) {
      if (!eligible.has(semel) || !b.contains(points[semel])) { marker.remove(); pool.delete(semel); }
    }
    for (const semel of eligible) {
      if (pool.has(semel) || !b.contains(points[semel])) continue;
      const el = document.createElement("div");
      el.className = "city-label";
      el.textContent = settlements[semel].name.trim();
      pool.set(semel, new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(points[semel]).addTo(map));
    }
  };

  const refresh = () => { if (!enabled) return; computeEligible(); syncViewport(); };
  const clearAll = () => { for (const [, m] of pool) m.remove(); pool.clear(); };

  // Eligibility is zoom-based (recompute on zoomend); panning only re-instantiates (moveend).
  const onZoom = () => refresh();
  const onMove = () => syncViewport();
  map.on("zoomend", onZoom);
  map.on("moveend", onMove);

  measure();
  refresh();
  document.fonts?.ready.then(() => { measure(); refresh(); });

  return {
    setEnabled(on: boolean) {
      if (on === enabled) return;
      enabled = on;
      if (on) refresh(); else clearAll();
    },
    destroy() {
      map.off("zoomend", onZoom);
      map.off("moveend", onMove);
      clearAll();
    },
  };
}
