import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line as d3line, curveMonotoneX } from "d3-shape";
import type { SocioData, FamilyKey } from "../types";
import { pct, fmt } from "../format";

const W = 760, H = 430;
const M = { top: 22, right: 26, bottom: 52, left: 48 };

export default function DemographicsView({ socio }: { socio: SocioData }) {
  const [hover, setHover] = useState<FamilyKey | null>(null);

  const { x, y, yTicks, lineGen } = useMemo(() => {
    const allShares = socio.series.flatMap((s) => s.points.map((p) => p.share));
    const maxShare = Math.min(0.85, Math.ceil(Math.max(...allShares, 0.1) * 10) / 10);
    // Cluster 1 (weakest) on the RIGHT for natural RTL reading.
    const x = scaleLinear().domain([1, 10]).range([W - M.right, M.left]);
    const y = scaleLinear().domain([0, maxShare]).range([H - M.bottom, M.top]);
    const yTicks: number[] = [];
    for (let t = 0; t <= maxShare + 1e-9; t += 0.1) yTicks.push(+t.toFixed(2));
    const lineGen = d3line<{ cluster: number; share: number }>().x((d) => x(d.cluster)).y((d) => y(d.share)).curve(curveMonotoneX);
    return { x, y, yTicks, lineGen };
  }, [socio]);

  // Scale turnout bars from a baseline (turnouts cluster in a narrow band) so the
  // differences between socio-economic clusters are visible.
  const turnouts = socio.clusters.map((c) => c.turnout);
  const tMin = Math.min(...turnouts) * 0.96;
  const tMax = Math.max(...turnouts);
  const turnoutH = (t: number) => 6 + ((t - tMin) / (tMax - tMin)) * 94;

  return (
    <div className="demo">
      <div className="demo-head">
        <h2>איך הצביעה ישראל לפי מצב חברתי-כלכלי</h2>
        <p className="demo-sub">
          אחוז הקולות לכל מפלגה לפי <b>האשכול החברתי-כלכלי</b> של היישוב (הלמ"ס, 1 = החלש ביותר … 10 = החזק ביותר).
        </p>
        <p className="disclaimer">
          ⚠️ <b>ניתוח מצרפי.</b> זהו ממוצע לפי יישובים, לא הצבעת הפרט — <b>כשל אקולוגי</b>: דפוס של קבוצת יישובים אינו מעיד בהכרח על אדם יחיד.
        </p>
      </div>

      <div className="demo-chart" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="demo-svg" role="img" aria-label="אחוז קולות לפי אשכול חברתי-כלכלי">
          {/* y gridlines + labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" className="axis-label">{Math.round(t * 100)}%</text>
            </g>
          ))}
          {/* x ticks */}
          {socio.clusters.map((c) => (
            <text key={c.cluster} x={x(c.cluster)} y={H - M.bottom + 18} textAnchor="middle" className="axis-label">{c.cluster}</text>
          ))}
          <text x={(W) / 2} y={H - 10} textAnchor="middle" className="axis-title">אשכול חברתי-כלכלי  ←  חזק יותר</text>

          {/* lines */}
          {socio.series.map((s) => {
            const dim = hover && hover !== s.family;
            return (
              <path
                key={s.family}
                d={lineGen(s.points) ?? ""}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.family ? 3.4 : 2}
                opacity={dim ? 0.12 : 1}
                className="demo-line"
              />
            );
          })}
          {/* dots for hovered (or all if none hovered, lightly) */}
          {socio.series.map((s) =>
            (hover === s.family ? s.points : []).map((p) => (
              <circle key={`${s.family}-${p.cluster}`} cx={x(p.cluster)} cy={y(p.share)} r={3.4} fill={s.color} />
            )),
          )}
        </svg>
      </div>

      <div className="demo-legend">
        {socio.series.map((s) => (
          <button
            key={s.family}
            className={hover === s.family ? "demo-chip on" : "demo-chip"}
            onMouseEnter={() => setHover(s.family)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(s.family)}
            onBlur={() => setHover(null)}
          >
            <span className="demo-dot" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="demo-turnout">
        <span className="demo-turnout-title">אחוז הצבעה לפי אשכול:</span>
        <div className="turnout-bars">
          {socio.clusters.map((c) => (
            <div key={c.cluster} className="turnout-col" title={`אשכול ${c.cluster}: ${pct(c.turnout)} · ${c.localities} יישובים · ${fmt(c.valid)} קולות`}>
              <div className="turnout-bar" style={{ height: `${turnoutH(c.turnout)}%` }} />
              <span className="turnout-cluster">{c.cluster}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="muted demo-note">מקור: הלשכה המרכזית לסטטיסטיקה — מדד חברתי-כלכלי 2021 לפי יישוב · {socio.matchedLocalities} יישובים שותפו לתוצאות. אחוז ההצבעה הוא ממוצע משוקלל-קולות בכל אשכול.</p>
    </div>
  );
}
