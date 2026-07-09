import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { ClientDetail, Commitment, Nudge } from "../api";
import {
  Card,
  SectionTitle,
  ScoreRing,
  Spark,
  Trend,
  categoryEmoji,
  fmtDateTime,
} from "../ui";

function CheckInRow({ c, onTap }: { c: Commitment; onTap: (status: string) => void }) {
  const answered = c.todayCheckIn?.status;
  const btn = (status: string, label: string, active: string, glow: string) => (
    <button
      onClick={() => onTap(status)}
      className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-xl transition-all duration-200 active:scale-90 ${
        answered === status
          ? `${active} border-transparent ${glow}`
          : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
      }`}
      title={status}
    >
      {label}
    </button>
  );
  return (
    <Card className="lift flex items-center justify-between gap-3 !p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-lg">
            {categoryEmoji[c.category] ?? "✅"}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.title}</div>
            <div className="text-xs text-mute">
              {c.per_week >= 7 ? "Daily" : `${c.doneThisWeek ?? 0}/${c.per_week} this week`}
              {c.streak && c.streak.count > 0 && (
                <span className="ml-2 font-medium text-warn">
                  🔥 {c.streak.count}{c.streak.unit === "days" ? "d" : "w"} streak
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {btn("done", "✅", "bg-accent/20", "shadow-[0_0_20px_rgba(91,255,176,.35)]")}
        {btn("missed", "❌", "bg-danger/20", "shadow-[0_0_20px_rgba(255,107,122,.35)]")}
        {btn("rest", "⏭", "bg-second/20", "shadow-[0_0_20px_rgba(124,203,255,.35)]")}
      </div>
    </Card>
  );
}

function NudgeCard({ n, ptName, onAck }: { n: Nudge; ptName: string; onAck: () => void }) {
  return (
    <Card className={`!p-4 ${n.tier === 0 ? "!border-accent/25" : "!border-high/25"}`}>
      <div className="mb-2 flex items-center gap-2.5 text-xs text-mute">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-high to-second text-[10px] font-bold text-ink shadow-[0_0_16px_rgba(155,140,255,.4)]">
          {ptName.split(" ").map((w) => w[0]).join("")}
        </span>
        <span className="font-medium text-white/80">{ptName}</span>
        {n.sent_by !== "pt" && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-wider">auto</span>}
        <span className="ml-auto">{new Date(n.sent_at ?? n.created_at).toLocaleDateString()}</span>
      </div>
      <p className="text-sm leading-relaxed">{n.message}</p>
      {n.tier > 0 &&
        (n.acknowledged_at ? (
          <div className="mt-3 text-xs font-medium text-accent">Acknowledged ✓</div>
        ) : (
          <button onClick={onAck} className="btn-primary mt-3 rounded-xl px-4 py-2 text-xs">
            On it 💪
          </button>
        ))}
    </Card>
  );
}

export default function ClientToday({ clientId, ptName }: { clientId: number; ptName: string }) {
  const [data, setData] = useState<ClientDetail | null>(null);

  const load = useCallback(
    () => api.get<ClientDetail>(`/clients/${clientId}/today`).then(setData),
    [clientId]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-mute">Loading…</p>;

  const tap = async (commitmentId: number, status: string) => {
    await api.post("/checkins", { commitment_id: commitmentId, status });
    load();
  };

  const confirmSession = async (id: number) => {
    await api.patch(`/sessions/${id}`, { status: "confirmed" });
    load();
  };

  const nextSession = data.sessions[0];
  const firstName = data.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-md space-y-7">
      <div className="rise">
        <h1 className="display text-2xl font-bold">
          Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName}
        </h1>
        <p className="mt-0.5 text-sm text-mute">Here's today. One tap at a time.</p>
      </div>

      <Card className="rise rise-1 glass-strong relative overflow-hidden">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="flex items-center justify-between gap-4">
          <ScoreRing score={data.score} heat={data.heat} />
          <div className="flex flex-col items-end gap-2">
            <Spark points={data.scoreHistory.map((p) => p.score)} />
            <div className="text-xs text-mute">
              <Trend trend={data.trend} /> vs last week
            </div>
          </div>
        </div>
      </Card>

      {nextSession && (
        <Card className="rise rise-2 flex items-center justify-between !p-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-mute">Next session · {ptName}</div>
            <div className="mt-1 font-medium">{fmtDateTime(nextSession.datetime)}</div>
          </div>
          {nextSession.status === "proposed" ? (
            <button onClick={() => confirmSession(nextSession.id)} className="btn-primary rounded-xl px-4 py-2 text-xs">
              Confirm ✓
            </button>
          ) : (
            <span className="text-xs font-medium text-accent">Confirmed ✓</span>
          )}
        </Card>
      )}

      <section className="rise rise-2">
        <SectionTitle>Today's commitments</SectionTitle>
        <div className="space-y-2.5">
          {data.commitments.map((c) => (
            <CheckInRow key={c.id} c={c} onTap={(s) => tap(c.id, s)} />
          ))}
        </div>
      </section>

      {data.nudges.length > 0 && (
        <section className="rise rise-3">
          <SectionTitle>From your coach</SectionTitle>
          <div className="space-y-2.5">
            {data.nudges.slice(0, 4).map((n) => (
              <NudgeCard key={n.id} n={n} ptName={ptName} onAck={() => api.post(`/nudges/${n.id}/ack`).then(load)} />
            ))}
          </div>
        </section>
      )}

      <section className="rise rise-4">
        <SectionTitle>Shared goals</SectionTitle>
        <div className="space-y-2.5">
          {data.goals.map((g) => (
            <Card key={g.id} className="!p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{g.title}</span>
                <span className="tabular text-mute">{g.progress}%</span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-high to-second transition-[width] duration-700"
                  style={{ width: `${g.progress}%`, boxShadow: "0 0 12px rgba(155,140,255,.5)" }}
                />
              </div>
              <div className="mt-1.5 text-xs text-mute">{g.target}</div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
