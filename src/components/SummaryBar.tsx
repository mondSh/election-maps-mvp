import type { NationalEntry, Parties } from "../types";
import { fmt, pct } from "../format";

interface Props {
  national: NationalEntry[];
  totalValid: number;
  parties: Parties;
}

/** National K25 result: a stacked share bar + the leading parties. */
export default function SummaryBar({ national, totalValid, parties }: Props) {
  const shown = national.filter((e) => e.family !== "other").slice(0, 11);
  return (
    <div className="summary">
      <div className="summary-head">
        <span className="summary-title">תוצאות ארציות · כנסת 25</span>
        <span className="summary-total">{fmt(totalValid)} קולות כשרים</span>
      </div>
      <div className="summary-bar" role="img" aria-label="התפלגות קולות ארצית">
        {national.map((e) => (
          <span
            key={e.family}
            className="summary-seg"
            style={{ width: `${e.share * 100}%`, background: parties[e.family]?.color ?? "#c9ccd1" }}
            title={`${e.label} ${pct(e.share)}`}
          />
        ))}
      </div>
      <div className="summary-chips">
        {shown.map((e) => (
          <span className="chip" key={e.family}>
            <span className="chip-dot" style={{ background: parties[e.family]?.color }} />
            {e.label}
            <b>{pct(e.share)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
