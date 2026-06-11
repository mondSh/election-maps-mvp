import type { ColorMode, NationalEntry, Parties } from "../types";

interface Props {
  parties: Parties;
  national: NationalEntry[];
  colorMode: ColorMode;
  onChange: (mode: ColorMode) => void;
}

/** Color-mode picker (winner vs. a single party's share) + matching legend. */
export default function ControlPanel({ parties, national, colorMode, onChange }: Props) {
  const selectableParties = national.filter((e) => e.family !== "other");

  return (
    <div className="panel control-panel">
      <label className="panel-label" htmlFor="color-mode">צביעת המפה</label>
      <select
        id="color-mode"
        className="select"
        value={colorMode.kind === "winner" ? "winner" : colorMode.family}
        onChange={(e) => onChange(e.target.value === "winner" ? { kind: "winner" } : { kind: "party", family: e.target.value })}
      >
        <option value="winner">המפלגה המנצחת</option>
        <optgroup label="לפי אחוז למפלגה">
          {selectableParties.map((e) => (
            <option key={e.family} value={e.family}>{e.label}</option>
          ))}
        </optgroup>
      </select>

      {colorMode.kind === "winner" ? (
        <div className="legend">
          {selectableParties.slice(0, 12).map((e) => (
            <div className="legend-row" key={e.family}>
              <span className="legend-swatch" style={{ background: parties[e.family]?.color }} />
              <span className="legend-name">{e.label}</span>
            </div>
          ))}
          <div className="legend-row">
            <span className="legend-swatch" style={{ background: "#e3ded3" }} />
            <span className="legend-name">ללא נתונים</span>
          </div>
        </div>
      ) : (
        <div className="legend">
          <div className="legend-name" style={{ marginBottom: 6 }}>{parties[colorMode.family]?.label} — אחוז קולות</div>
          <div className="gradient" style={{ background: `linear-gradient(90deg, #eef1f4, ${parties[colorMode.family]?.color})` }} />
          <div className="gradient-scale"><span>0%</span><span>50%+</span></div>
        </div>
      )}
    </div>
  );
}
