import Image from "next/image";
import type { DeckStats } from "@/lib/decks/types";
import { COLOR_NAMES, MANA_SYMBOL_URL } from "@/lib/cards/mana";
import { formatUsd } from "@/lib/utils";

export function DeckStatsPanel({ stats }: { stats: DeckStats }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3">
        <Stat label="Main deck" value={stats.main_count} />
        <Stat label="Sideboard" value={stats.side_count} />
        <Stat
          label="Average MV"
          value={stats.average_mana_value.toFixed(2)}
          hint="non-lands"
        />
        <Stat label="Price" value={formatUsd(stats.total_price)} />
      </dl>

      <ManaCurve stats={stats} />
      <ColorDistribution stats={stats} />
    </div>
  );
}

const CURVE_WIDTH = 260;
const CURVE_HEIGHT = 112;
const PAD_X = 14;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;

function ManaCurve({ stats }: { stats: DeckStats }) {
  const points = stats.curve;
  const max = Math.max(1, ...points.map((point) => point.count));
  const innerWidth = CURVE_WIDTH - PAD_X * 2;
  const innerHeight = CURVE_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => ({
    ...point,
    x: PAD_X + index * step,
    y: PAD_TOP + innerHeight - (point.count / max) * innerHeight,
  }));

  const line = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const area = `${line} L ${coordinates[coordinates.length - 1]?.x ?? PAD_X} ${
    PAD_TOP + innerHeight
  } L ${coordinates[0]?.x ?? PAD_X} ${PAD_TOP + innerHeight} Z`;

  const summary = points.map((point) => `${point.bucket}: ${point.count}`).join(", ");

  return (
    <section aria-labelledby="curve-heading">
      <h3
        id="curve-heading"
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Mana curve
      </h3>
      <svg
        viewBox={`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`}
        role="img"
        aria-label={`Mana curve. ${summary}`}
        className="mt-2 h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <path d={area} className="fill-primary/15" />
        <path d={line} className="fill-none stroke-primary" strokeWidth={2} />
        {coordinates.map((point) => (
          <g key={point.bucket}>
            <circle cx={point.x} cy={point.y} r={2.5} className="fill-primary" />
            <text
              x={point.x}
              y={point.y - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {point.count}
            </text>
            <text
              x={point.x}
              y={CURVE_HEIGHT - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {point.bucket === "1 or less" ? "1-" : point.bucket}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

function ColorDistribution({ stats }: { stats: DeckStats }) {
  const total = stats.color_counts.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <section aria-labelledby="color-heading">
      <h3
        id="color-heading"
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Color distribution
      </h3>
      <ul className="mt-2 grid grid-cols-5 gap-2">
        {stats.color_counts.map((entry) => {
          const percent = total ? (entry.count / total) * 100 : 0;
          return (
            <li
              key={entry.color}
              className="flex flex-col items-center gap-1"
              title={`${COLOR_NAMES[entry.color]}: ${entry.count}`}
            >
              <Image
                src={MANA_SYMBOL_URL[entry.color]}
                alt={COLOR_NAMES[entry.color]}
                width={22}
                height={22}
                unoptimized
              />
              <span className="numeric text-xs text-muted-foreground">
                {percent.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-medium numeric">{value}</dd>
      {hint ? <dd className="text-[10px] text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
