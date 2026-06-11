import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MlMap, type StyleSpecification, type ExpressionSpecification, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ColorMode, Parties, Settlements } from "../types";
import { GEOJSON_SETTLEMENTS, GEOJSON_POINTS, type PointLookup } from "../data";
import { fmt, pct } from "../format";

const NO_DATA = "#e3ded3"; // settlements with a polygon but no election join
const SEA = "#dfe7ec";

interface Props {
  parties: Parties;
  settlements: Settlements;
  points: PointLookup;
  colorMode: ColorMode;
  selected: string | null;
  onSelect: (semel: string | null) => void;
  /** When set, swap to the neighborhood (statistical-area) drill-down for that GeoJSON. */
  drillUrl: string | null;
}

const NATIONAL_LAYERS = ["settle-fill", "settle-line", "settle-selected", "bubbles"];
const TLV_BOUNDS: [[number, number], [number, number]] = [[34.736, 32.01], [34.862, 32.13]];
const ISRAEL_BOUNDS: [[number, number], [number, number]] = [[34.2, 29.45], [35.95, 33.4]];

/** fill-color expression for the current coloring mode. */
function fillExpression(mode: ColorMode, parties: Parties): ExpressionSpecification {
  if (mode.kind === "winner") {
    const pairs: (string | string[])[] = [];
    for (const [key, p] of Object.entries(parties)) {
      if (key === "other") continue;
      pairs.push(key, p.color);
    }
    return ["match", ["get", "winner"], ...pairs, NO_DATA] as unknown as ExpressionSpecification;
  }
  const color = parties[mode.family]?.color ?? "#3367d6";
  return [
    "interpolate", ["linear"], ["coalesce", ["get", `sh_${mode.family}`], 0],
    0, "#eef1f4",
    0.5, color,
  ] as ExpressionSpecification;
}

function baseStyle(): StyleSpecification {
  // No `glyphs` key at all — we render labels as HTML markers, not GL symbols.
  return {
    version: 8,
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": SEA } }],
  };
}

export default function MapView({ parties, settlements, points, colorMode, selected, onSelect, drillUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);

  // ---- init map once ----
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(),
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
      map.addSource("settlements", { type: "geojson", data: GEOJSON_SETTLEMENTS, promoteId: "semel" });
      map.addSource("points", { type: "geojson", data: GEOJSON_POINTS, promoteId: "semel" });

      map.addLayer({
        id: "settle-fill", type: "fill", source: "settlements",
        paint: {
          "fill-color": fillExpression(colorMode, parties),
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
        paint: { "line-color": "#11161d", "line-width": 2.2 },
      });

      // West-Bank / no-polygon settlements as proportional bubbles.
      map.addLayer({
        id: "bubbles", type: "circle", source: "points",
        paint: {
          "circle-color": winnerCircleColor(parties),
          "circle-radius": ["interpolate", ["linear"], ["sqrt", ["coalesce", ["get", "valid"], 0]], 0, 2.5, 60, 6, 170, 14],
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-opacity": 0.92,
        },
      });

      map.fitBounds([[34.2, 29.45], [35.95, 33.4]], { padding: 24, animate: false });
      addCityLabels(map, settlements, points);

      for (const layer of ["settle-fill", "bubbles"]) {
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
      const s = settlements[semel];
      if (s) {
        const winnerLabel = s.winner ? parties[s.winner]?.label ?? "" : "ללא נתונים";
        popupRef.current
          ?.setLngLat(e.lngLat)
          .setHTML(`<strong>${s.name}</strong><br/>${winnerLabel}${s.winner ? ` · ${pct(s.winnerShare)}` : ""}<br/><span class="muted">${fmt(s.valid)} קולות · השתתפות ${pct(s.turnout)}</span>`)
          .addTo(map);
      }
    }
    function clearHover() {
      map.getCanvas().style.cursor = "";
      if (hoveredRef.current) map.setFeatureState({ source: "settlements", id: hoveredRef.current }, { hover: false });
      hoveredRef.current = null;
      popupRef.current?.remove();
    }

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- recolor when colorMode changes (national + drill layers) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const expr = fillExpression(colorMode, parties);
    if (map.getLayer("settle-fill")) map.setPaintProperty("settle-fill", "fill-color", expr);
    if (map.getLayer("city-fill")) map.setPaintProperty("city-fill", "fill-color", expr);
  }, [colorMode, parties]);

  // ---- city drill-down: swap to statistical-area resolution ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("settle-fill")) return; // wait until base layers exist

    const setVis = (ids: string[], v: "visible" | "none") => {
      for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
    };

    if (drillUrl) {
      if (!map.getSource("city")) {
        map.addSource("city", { type: "geojson", data: drillUrl, promoteId: "sa" });
        map.addLayer({
          id: "city-fill", type: "fill", source: "city",
          paint: { "fill-color": fillExpression(colorMode, parties), "fill-opacity": 0.85 },
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
        (map.getSource("city") as GeoJSONSource).setData(drillUrl);
        setVis(["city-fill", "city-line"], "visible");
      }
      setVis(NATIONAL_LAYERS, "none");
      map.fitBounds(TLV_BOUNDS, { padding: 30, animate: true });
    } else {
      setVis(["city-fill", "city-line"], "none");
      setVis(NATIONAL_LAYERS, "visible");
      map.fitBounds(ISRAEL_BOUNDS, { padding: 24, animate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillUrl, ready]);

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

function winnerCircleColor(parties: Parties): ExpressionSpecification {
  const pairs: (string | string[])[] = [];
  for (const [key, p] of Object.entries(parties)) {
    if (key === "other") continue;
    pairs.push(key, p.color);
  }
  return ["match", ["get", "winner"], ...pairs, NO_DATA] as unknown as ExpressionSpecification;
}

/** A handful of HTML markers for the biggest cities — no glyph server needed. */
function addCityLabels(map: MlMap, settlements: Settlements, points: PointLookup) {
  const top = Object.entries(settlements)
    .filter(([semel]) => points[semel])
    .sort((a, b) => b[1].valid - a[1].valid)
    .slice(0, 18);
  // Tiered labels: the 6 biggest cities always; the rest only when zoomed in,
  // so the national view stays uncluttered in dense Gush Dan.
  const markers: { marker: maplibregl.Marker; tier: number }[] = [];
  top.forEach(([semel, s], i) => {
    const el = document.createElement("div");
    el.className = "city-label";
    el.textContent = s.name.trim();
    const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(points[semel]).addTo(map);
    markers.push({ marker, tier: i < 6 ? 0 : 1 });
  });
  const updateVisibility = () => {
    const z = map.getZoom();
    for (const { marker, tier } of markers) {
      const show = tier === 0 || z >= 9.3;
      marker.getElement().style.opacity = show ? "1" : "0";
    }
  };
  updateVisibility();
  map.on("zoom", updateVisibility);
}
