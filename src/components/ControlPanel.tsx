import type { ColorMode, NationalEntry, Parties, MapViewMode } from "../types";

interface Props {
  parties: Parties;
  national: NationalEntry[];
  colorMode: ColorMode;
  onChange: (mode: ColorMode) => void;
  year: 24 | 25;
  onYear: (y: 24 | 25) => void;
  mapView: MapViewMode;
  onMapView: (v: MapViewMode) => void;
}

/** View + color-mode picker (winner / share / swing) + year + legend. */
export default function ControlPanel({ parties, national, colorMode, onChange, year, onYear, mapView, onMapView }: Props) {
  const selectableParties = national.filter((e) => e.family !== "other");
  const family = colorMode.kind === "winner" ? null : colorMode.family;

  return (
    <div className="panel control-panel">
      <div className="year-toggle">
        <button className={mapView === "choropleth" ? "year-btn on" : "year-btn"} onClick={() => onMapView("choropleth")}>מפה מלאה</button>
        <button className={mapView === "bubbles" ? "year-btn on" : "year-btn"} onClick={() => onMapView("bubbles")}>בועות (לפי קולות)</button>
      </div>
      {colorMode.kind !== "swing" && (
        <div className="year-toggle">
          <button className={year === 25 ? "year-btn on" : "year-btn"} onClick={() => onYear(25)}>2022 · כנסת 25</button>
          <button className={year === 24 ? "year-btn on" : "year-btn"} onClick={() => onYear(24)}>2021 · כנסת 24</button>
        </div>
      )}
      <label className="panel-label" htmlFor="color-mode">צביעת המפה</label>
      <select
        id="color-mode"
        className="select"
        value={colorMode.kind === "winner" ? "winner" : colorMode.family}
        onChange={(e) =>
          onChange(
            e.target.value === "winner"
              ? { kind: "winner" }
              : { kind: colorMode.kind === "swing" ? "swing" : "party", family: e.target.value },
          )
        }
      >
        <option value="winner">המפלגה המנצחת</option>
        <optgroup label="לפי מפלגה">
          {selectableParties.map((e) => (
            <option key={e.family} value={e.family}>{e.label}</option>
          ))}
        </optgroup>
      </select>

      {family && (
        <div className="mode-toggle">
          <button
            className={colorMode.kind === "party" ? "mode-btn on" : "mode-btn"}
            onClick={() => onChange({ kind: "party", family })}
          >
            אחוז קולות
          </button>
          <button
            className={colorMode.kind === "swing" ? "mode-btn on" : "mode-btn"}
            onClick={() => onChange({ kind: "swing", family })}
          >
            תזוזה 21→22
          </button>
        </div>
      )}

      {colorMode.kind === "winner" && (
        <div className="legend">
          {selectableParties.slice(0, 12).map((e) => (
            <div className="legend-row" key={e.family}>
              <span className="legend-swatch" style={{ background: parties[e.family]?.color }} />
              <span className="legend-name">{e.label}</span>
            </div>
          ))}
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: "var(--nodata)" }} />
            <span className="legend-name">ללא נתונים</span>
          </div>
        </div>
      )}

      {colorMode.kind === "party" && (
        <div className="legend">
          <div className="legend-name" style={{ marginBottom: 6 }}>{parties[colorMode.family]?.label} — אחוז קולות</div>
          <div className="gradient" style={{ background: `linear-gradient(90deg, var(--grad-low), ${parties[colorMode.family]?.color})` }} />
          <div className="gradient-scale"><span>0%</span><span>50%+</span></div>
        </div>
      )}

      {colorMode.kind === "swing" && (
        <div className="legend">
          <div className="legend-name" style={{ marginBottom: 6 }}>{parties[colorMode.family]?.label} — שינוי מ-2021</div>
          <div className="gradient" style={{ background: "linear-gradient(90deg, #b3322c, var(--grad-low), #1f4e8c)" }} />
          <div className="gradient-scale"><span>התחזקה</span><span>נחלשה</span></div>
        </div>
      )}
    </div>
  );
}
