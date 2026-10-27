import { formatMoney } from "@/lib/format";

type Point = { label: string; value: number };

const W = 600;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

/** Rounds up to a tidy axis maximum (1, 2, 2.5 or 5 x a power of ten). */
export function niceMax(value: number) {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= value)!;
  return step * pow;
}

/**
 * A single-series line chart in the surrounding text color, so it follows the
 * theme. Each point has a hover tooltip, and a hidden table reads the same
 * data to screen readers.
 */
export function LineChart({
  points,
  title,
}: {
  points: Point[];
  title: string;
}) {
  const max = niceMax(Math.max(...points.map((p) => p.value), 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left +
    (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`)
    .join(" ");
  const last = points.length - 1;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={title}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeOpacity={0.12}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize="12"
              fill="currentColor"
              fillOpacity={0.7}
            >
              {formatMoney(String(t)).replace(/\.00$/, "")}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text
            key={p.label}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="12"
            fill="currentColor"
            fillOpacity={0.7}
          >
            {p.label}
          </text>
        ))}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r={4} fill="currentColor" />
            {/* Bigger invisible target so the tooltip is easy to hit. */}
            <circle cx={x(i)} cy={y(p.value)} r={14} fill="transparent">
              <title>{`${p.label}: ${formatMoney(String(p.value))}`}</title>
            </circle>
          </g>
        ))}
        {last >= 0 && (
          <text
            x={x(last)}
            y={y(points[last].value) - 12}
            textAnchor="end"
            fontSize="12"
            fontWeight="600"
            fill="currentColor"
          >
            {formatMoney(String(points[last].value))}
          </text>
        )}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Spent</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <td>{p.label}</td>
              <td>{formatMoney(String(p.value))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
