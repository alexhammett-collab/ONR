import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-3xl p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-mute">
      <span className="h-px w-4 bg-gradient-to-r from-accent/60 to-transparent" />
      {children}
    </h2>
  );
}

export const heatDot: Record<string, string> = {
  green: "bg-accent shadow-[0_0_12px_rgba(91,255,176,.8)]",
  amber: "bg-warn shadow-[0_0_12px_rgba(255,209,102,.8)]",
  red: "bg-danger shadow-[0_0_12px_rgba(255,107,122,.8)]",
};

export function HeatBadge({ heat }: { heat: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${heatDot[heat]}`} />;
}

const heatStops: Record<string, [string, string]> = {
  green: ["#5bffb0", "#35d3a0"],
  amber: ["#ffd166", "#ff9f5b"],
  red: ["#ff8b96", "#ff5a6b"],
};

export function ScoreBar({ score, heat }: { score: number; heat: string }) {
  const [a, b] = heatStops[heat] ?? heatStops.green;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${Math.max(score, 2)}%`,
          background: `linear-gradient(90deg, ${a}, ${b})`,
          boxShadow: `0 0 12px ${a}66`,
        }}
      />
    </div>
  );
}

/** Circular gradient score ring with animated sweep. */
export function ScoreRing({
  score,
  heat,
  size = 108,
  stroke = 7,
  label = "ONR score",
}: {
  score: number;
  heat: string;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(score, 100) / 100) * c;
  const [a, b] = heatStops[heat] ?? heatStops.green;
  const id = `ring-${heat}`;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="ring-anim"
          style={{ ["--ring-c" as string]: `${c}px`, filter: `drop-shadow(0 0 8px ${a}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display tabular text-3xl font-bold leading-none">{score}</span>
        <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-mute">{label}</span>
      </div>
    </div>
  );
}

export function Trend({ trend }: { trend: number }) {
  if (trend === 0) return <span className="tabular text-mute">→ 0</span>;
  return trend > 0 ? (
    <span className="tabular font-medium text-accent">▲ {trend}</span>
  ) : (
    <span className="tabular font-medium text-danger">▼ {Math.abs(trend)}</span>
  );
}

export function Spark({ points, width = 130, height = 40 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const step = width / (points.length - 1);
  const y = (p: number) => height - 4 - (p / 100) * (height - 8);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${i * step},${y(p)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7ccbff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7ccbff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sparkLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#9b8cff" />
          <stop offset="100%" stopColor="#7ccbff" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path
        d={line}
        fill="none"
        stroke="url(#sparkLine)"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px rgba(124,203,255,.5))" }}
      />
      <circle cx={(points.length - 1) * step} cy={y(points[points.length - 1])} r="3.5" fill="#7ccbff"
        style={{ filter: "drop-shadow(0 0 6px rgba(124,203,255,.9))" }} />
    </svg>
  );
}

export const tierLabel: Record<number, { label: string; cls: string }> = {
  0: { label: "Reinforce", cls: "border-accent/30 bg-accent/10 text-accent" },
  1: { label: "Gentle nudge", cls: "border-second/30 bg-second/10 text-second" },
  2: { label: "Kick suggested", cls: "border-warn/30 bg-warn/10 text-warn" },
  3: { label: "Intervention", cls: "border-danger/30 bg-danger/10 text-danger" },
};

export function TierBadge({ tier }: { tier: number }) {
  const t = tierLabel[tier];
  return (
    <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t.cls}`}>
      T{tier} · {t.label}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    completed: "border-accent/30 bg-accent/10 text-accent",
    confirmed: "border-second/30 bg-second/10 text-second",
    proposed: "border-white/15 bg-white/5 text-mute",
    cancelled: "border-danger/30 bg-danger/10 text-danger",
    "no-show": "border-danger/30 bg-danger/10 text-danger",
  };
  return (
    <span className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls[status] ?? cls.proposed}`}>
      {status}
    </span>
  );
}

export const categoryEmoji: Record<string, string> = {
  diet: "🍽️",
  steps: "👟",
  solo_session: "🏋️",
  sleep: "😴",
  custom: "✨",
};

export function fmtDateTime(dt: string) {
  return new Date(dt).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(d: string) {
  return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
