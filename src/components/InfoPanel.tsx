import type { Parties, Settlement } from "../types";
import { fmt, pct } from "../format";

interface Props {
  settlement: Settlement;
  parties: Parties;
  onClose: () => void;
  drillAvailable?: boolean;
  onDrill?: () => void;
}

export default function InfoPanel({ settlement: s, parties, onClose, drillAvailable, onDrill }: Props) {
  const rows = Object.entries(s.parties)
    .map(([family, votes]) => ({ family, votes, label: parties[family]?.label ?? family, color: parties[family]?.color ?? "#c9ccd1" }))
    .sort((a, b) => b.votes - a.votes);
  const max = rows.length ? rows[0].votes : 1;

  return (
    <div className="panel info-panel">
      <button className="close-btn" onClick={onClose} aria-label="סגור">×</button>
      <h3 className="info-name">{s.name.trim()}</h3>
      <div className="info-stats">
        <div><span className="stat-num">{fmt(s.valid)}</span><span className="stat-cap">קולות כשרים</span></div>
        <div><span className="stat-num">{pct(s.turnout)}</span><span className="stat-cap">אחוז הצבעה</span></div>
        <div><span className="stat-num">{fmt(s.eligible)}</span><span className="stat-cap">בעלי זכות בחירה</span></div>
      </div>
      {drillAvailable && (
        <button className="drill-btn" onClick={onDrill}>
          הצג ברזולוציית שכונה (אזורים סטטיסטיים) →
        </button>
      )}
      <div className="breakdown">
        {rows.map((r) => (
          <div className="bd-row" key={r.family}>
            <span className="bd-label">{r.label}</span>
            <span className="bd-bar-wrap">
              <span className="bd-bar" style={{ width: `${(r.votes / max) * 100}%`, background: r.color }} />
            </span>
            <span className="bd-val">{pct(r.votes / s.valid)}</span>
            <span className="bd-votes">{fmt(r.votes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
