import { useMemo, useState } from "react";
import type { SeatsData, FamilyKey } from "../types";
import { fmt } from "../format";

// Ideological left→right ordering for the hemicycle wedges.
const LEFT_TO_RIGHT: FamilyKey[] = ["hadash", "raam", "labor", "yesh_atid", "gantz", "yb", "likud", "shas", "utj", "rz"];

interface Seat { x: number; y: number; angle: number; r: number }

/** Classic parliament hemicycle layout: `total` seats across concentric rows. */
function hemicycleLayout(total: number): Seat[] {
  const rows = Math.max(3, Math.round(Math.sqrt(total) * 0.82));
  const rIn = 0.42, rOut = 1.0;
  const radii = Array.from({ length: rows }, (_, i) => rIn + (rOut - rIn) * (rows === 1 ? 0 : i / (rows - 1)));
  const wsum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(1, Math.round((total * r) / wsum)));
  let diff = total - counts.reduce((a, b) => a + b, 0);
  let i = rows - 1;
  while (diff > 0) { counts[i]++; diff--; i = (i - 1 + rows) % rows; }
  while (diff < 0) { const mx = counts.indexOf(Math.max(...counts)); counts[mx]--; diff++; }

  const pts: Seat[] = [];
  for (let row = 0; row < rows; row++) {
    const n = counts[row], r = radii[row];
    for (let j = 0; j < n; j++) {
      const t = n === 1 ? 0.5 : j / (n - 1);
      const angle = Math.PI * t; // 0 = right, π = left
      pts.push({ x: r * Math.cos(angle), y: -r * Math.sin(angle), angle, r });
    }
  }
  pts.sort((a, b) => b.angle - a.angle || a.r - b.r); // left → right
  return pts;
}

export default function CoalitionBuilder({ seats }: { seats: SeatsData }) {
  const [coalition, setCoalition] = useState<Set<FamilyKey>>(new Set());

  const seatByFamily = useMemo(() => Object.fromEntries(seats.parties.map((p) => [p.family, p])), [seats]);

  // Map each hemicycle seat to a party, in ideological order.
  const arc = useMemo(() => {
    const pts = hemicycleLayout(seats.total);
    const flat: FamilyKey[] = [];
    for (const fam of LEFT_TO_RIGHT) {
      const n = seatByFamily[fam]?.seats ?? 0;
      for (let k = 0; k < n; k++) flat.push(fam);
    }
    return pts.map((p, idx) => ({ ...p, family: flat[idx] }));
  }, [seats, seatByFamily]);

  const totalSelected = [...coalition].reduce((sum, fam) => sum + (seatByFamily[fam]?.seats ?? 0), 0);
  const hasMajority = totalSelected >= seats.majority;

  const toggle = (fam: FamilyKey) =>
    setCoalition((prev) => {
      const next = new Set(prev);
      next.has(fam) ? next.delete(fam) : next.add(fam);
      return next;
    });
  const preset = (test: (bloc: string) => boolean) =>
    setCoalition(new Set(seats.parties.filter((p) => test(p.bloc)).map((p) => p.family)));

  const sorted = [...seats.parties].sort((a, b) => b.seats - a.seats);

  return (
    <div className="coalition">
      <div className="coalition-head">
        <h2>בנה ממשלה · כנסת 25</h2>
        <p className="coalition-sub">לחצו על מפלגות (או על המושבים) כדי לצרף אותן לקואליציה. צריך {seats.majority} מנדטים לרוב.</p>
      </div>

      <div className="coalition-grid">
        <div className="hemicycle-wrap">
          <svg viewBox="-1.08 -1.13 2.16 1.18" className="hemicycle" role="img" aria-label="תרשים 120 מושבי הכנסת">
            {arc.map((s, idx) => {
              const inCoal = coalition.has(s.family);
              return (
                <circle
                  key={idx}
                  cx={s.x}
                  cy={s.y}
                  r={0.026}
                  fill={seatByFamily[s.family]?.color ?? "#c9ccd1"}
                  opacity={inCoal ? 1 : 0.18}
                  stroke={inCoal ? "rgba(0,0,0,0.25)" : "none"}
                  strokeWidth={0.004}
                  className="seat"
                  onClick={() => toggle(s.family)}
                />
              );
            })}
            <text x="0" y="-0.03" textAnchor="middle" fontSize={0.32} fontWeight={800} className={hasMajority ? "hemi-count maj" : "hemi-count"}>
              {totalSelected}
            </text>
            <text x="0" y="0.08" textAnchor="middle" fontSize={0.07} className="hemi-of">מתוך {seats.majority} לרוב</text>
          </svg>

          <div className={hasMajority ? "majority-bar has" : "majority-bar"}>
            <div className="majority-fill" style={{ width: `${(totalSelected / seats.total) * 100}%` }} />
            <div className="majority-line" style={{ right: `${(seats.majority / seats.total) * 100}%` }} />
          </div>
          <div className={hasMajority ? "majority-msg has" : "majority-msg"}>
            {hasMajority
              ? `✅ יש רוב — ${totalSelected} מנדטים (עודף של ${totalSelected - seats.majority})`
              : `אין רוב — חסרים ${seats.majority - totalSelected} מנדטים`}
          </div>
        </div>

        <div className="coalition-side">
          <div className="preset-row">
            <button className="preset-btn" onClick={() => preset((b) => b === "net")}>קואליציית נתניהו 2022</button>
            <button className="preset-btn" onClick={() => preset((b) => b === "opp" || b === "arab")}>הגוש החוסם</button>
            <button className="preset-btn ghost" onClick={() => setCoalition(new Set())}>נקה</button>
          </div>
          <div className="party-list">
            {sorted.map((p) => {
              const inCoal = coalition.has(p.family);
              return (
                <button
                  key={p.family}
                  className={inCoal ? "party-chip in" : "party-chip"}
                  onClick={() => toggle(p.family)}
                  style={inCoal ? { borderColor: p.color, background: `${p.color}1a` } : undefined}
                >
                  <span className="party-dot" style={{ background: p.color }} />
                  <span className="party-name">{p.label}</span>
                  <span className="party-seats">{fmt(p.seats)}</span>
                  <span className="party-check">{inCoal ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
          <p className="muted coalition-note">מנדטים: תוצאות רשמיות של ועדת הבחירות לכנסת ה-25 (שיטת בדר-עופר). מרצ ובל"ד לא עברו את אחוז החסימה.</p>
        </div>
      </div>
    </div>
  );
}
