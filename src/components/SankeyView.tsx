import { useMemo } from "react";
import { sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";
import type { SankeyData } from "../types";
import { fmt } from "../format";

interface Props {
  data: SankeyData;
}

const WIDTH = 920;
const MARGIN = { top: 16, right: 116, bottom: 16, left: 116 };

export default function SankeyView({ data }: Props) {
  const layout = useMemo(() => {
    const leftCount = new Set(data.links.map((l) => l.source)).size;
    const rightCount = new Set(data.links.map((l) => l.target)).size;
    const height = Math.max(540, Math.max(leftCount, rightCount) * 34 + MARGIN.top + MARGIN.bottom);

    const gen = sankey<any, any>()
      .nodeId((d: any) => d.id)
      .nodeWidth(15)
      .nodePadding(13)
      .nodeAlign(sankeyLeft)
      .extent([[MARGIN.left, MARGIN.top], [WIDTH - MARGIN.right, height - MARGIN.bottom]]);

    const graph = gen({
      nodes: data.nodes.map((d) => ({ ...d })),
      links: data.links.map((d) => ({ ...d })),
    });
    return { graph, height };
  }, [data]);

  const { graph, height } = layout;
  const linkPath = sankeyLinkHorizontal();

  return (
    <div className="sankey-wrap" dir="ltr">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="sankey-svg" role="img" aria-label="תרשים מעבר קולות בין כנסת 24 לכנסת 25">
        <g className="sankey-links">
          {graph.links.map((l: any, i: number) => (
            <path
              key={i}
              d={linkPath(l) ?? ""}
              stroke={l.source.color}
              strokeWidth={Math.max(1, l.width)}
              fill="none"
              opacity={0.38}
            >
              <title>{`${l.source.label} → ${l.target.label}: ${fmt(l.value)} קולות (אומדן)`}</title>
            </path>
          ))}
        </g>
        <g className="sankey-nodes">
          {graph.nodes.map((n: any) => {
            const isLeft = n.id.startsWith("24:");
            return (
              <g key={n.id}>
                <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(1, n.y1 - n.y0)} fill={n.color} rx={2}>
                  <title>{`${n.label}: ${fmt(n.value)} קולות`}</title>
                </rect>
                <text
                  x={isLeft ? n.x0 - 6 : n.x1 + 6}
                  y={(n.y0 + n.y1) / 2}
                  textAnchor={isLeft ? "end" : "start"}
                  dominantBaseline="middle"
                  className="sankey-label"
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
