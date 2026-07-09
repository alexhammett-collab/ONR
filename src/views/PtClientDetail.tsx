import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { ClientDetail, PrepCard } from "../api";
import {
  Card,
  HeatBadge,
  ScoreRing,
  SectionTitle,
  Spark,
  StatusPill,
  TierBadge,
  Trend,
  categoryEmoji,
  fmtDateTime,
} from "../ui";

const CATEGORIES = ["diet", "steps", "solo_session", "sleep", "custom"];

function CommitmentBuilder({ clientId, onDone }: { clientId: number; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("diet");
  const [perWeek, setPerWeek] = useState(7);

  const create = async () => {
    if (!title.trim()) return;
    await api.post(`/clients/${clientId}/commitments`, {
      title: title.trim(),
      category,
      per_week: perWeek,
    });
    setTitle("");
    onDone();
  };

  return (
    <Card className="rise space-y-3">
      <div className="text-sm font-semibold">New commitment — co-signed in session</div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder='e.g. "10k steps daily"'
        className="field w-full rounded-xl px-3.5 py-2.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="field rounded-xl px-3 py-2.5 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{categoryEmoji[c]} {c.replace("_", " ")}</option>
          ))}
        </select>
        <select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))} className="field rounded-xl px-3 py-2.5 text-sm">
          {[7, 5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n === 7 ? "Daily" : `${n}× / week`}</option>
          ))}
        </select>
        <button onClick={create} className="btn-primary ml-auto rounded-xl px-4 py-2.5 text-xs">
          Add commitment
        </button>
      </div>
    </Card>
  );
}

/** 28-day check-in grid, one row per commitment. */
function HistoryGrid({ data }: { data: ClientDetail }) {
  const days: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const cell = (commitmentId: number, date: string) => {
    const ci = data.checkIns.find((c) => c.commitment_id === commitmentId && c.date === date);
    if (!ci)
      return <div key={date} className="h-4 w-4 rounded-[5px] bg-white/[0.05]" title={`${date}: —`} />;
    const cls =
      ci.status === "done"
        ? "bg-accent shadow-[0_0_8px_rgba(91,255,176,.4)]"
        : ci.status === "rest"
          ? "bg-second/50"
          : "bg-danger/90 shadow-[0_0_8px_rgba(255,107,122,.3)]";
    return <div key={date} className={`h-4 w-4 rounded-[5px] ${cls}`} title={`${date}: ${ci.status}`} />;
  };
  const legendDot = (cls: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-[4px] ${cls}`} />{label}
    </span>
  );
  return (
    <Card className="overflow-x-auto">
      <div className="space-y-2.5">
        {data.commitments
          .filter((c) => c.active)
          .map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <div className="w-44 shrink-0 truncate text-xs text-mute">
                {categoryEmoji[c.category]} {c.title}
              </div>
              <div className="flex gap-[5px]">{days.map((d) => cell(c.id, d))}</div>
              {c.streak && c.streak.count > 0 && (
                <span className="shrink-0 text-xs font-medium text-warn">
                  🔥 {c.streak.count}{c.streak.unit === "days" ? "d" : "w"}
                </span>
              )}
            </div>
          ))}
      </div>
      <div className="mt-4 flex gap-4 text-[11px] text-mute">
        {legendDot("bg-accent", "done")}
        {legendDot("bg-danger/90", "missed")}
        {legendDot("bg-second/50", "rest")}
        {legendDot("bg-white/[0.05]", "no check-in")}
        <span className="ml-auto">← 4 weeks ago · today →</span>
      </div>
    </Card>
  );
}

export default function PtClientDetail({ clientId, onBack }: { clientId: number; onBack: () => void }) {
  const [data, setData] = useState<ClientDetail | null>(null);
  const [prep, setPrep] = useState<PrepCard | null>(null);
  const [building, setBuilding] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([
        api.get<ClientDetail>(`/clients/${clientId}`).then(setData),
        api.get<PrepCard>(`/clients/${clientId}/prep-card`).then(setPrep),
      ]),
    [clientId]
  );
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <p className="text-mute">Loading…</p>;

  const setSession = async (id: number, status: string) => {
    await api.patch(`/sessions/${id}`, { status });
    load();
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="rise text-sm text-mute transition hover:text-accent">
        ← Back to roster
      </button>

      <Card className="rise glass-strong relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-high/10 blur-3xl" />
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-3xl">{data.emoji}</span>
          <div>
            <div className="flex items-center gap-2.5">
              <HeatBadge heat={data.heat} />
              <span className="display text-xl font-bold">{data.name}</span>
            </div>
            <div className="mt-1 text-xs text-mute">Client since {data.joined_at}</div>
          </div>
          <div className="ml-auto flex items-center gap-7">
            <div className="flex flex-col items-end gap-1.5">
              <Spark points={data.scoreHistory.map((p) => p.score)} />
              <div className="text-xs text-mute"><Trend trend={data.trend} /> vs last week</div>
            </div>
            <ScoreRing score={data.score} heat={data.heat} size={96} />
          </div>
        </div>
      </Card>

      {prep && (prep.praise.length > 0 || prep.address.length > 0) && (
        <Card className="rise rise-1 !border-high/25">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-high">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-high/15">📋</span>
            Session prep card
          </div>
          {prep.praise.length > 0 && (
            <div className="text-sm">
              <span className="font-medium text-accent">Praise</span>
              <ul className="ml-4 mt-1 list-disc space-y-0.5 text-mute">{prep.praise.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {prep.address.length > 0 && (
            <div className="mt-3 text-sm">
              <span className="font-medium text-danger">Address</span>
              <ul className="ml-4 mt-1 list-disc space-y-0.5 text-mute">{prep.address.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
        </Card>
      )}

      <section className="rise rise-2">
        <div className="flex items-center">
          <SectionTitle>Commitments — 4-week history</SectionTitle>
          <button onClick={() => setBuilding(!building)} className="btn-ghost mb-3 ml-auto rounded-xl px-3.5 py-2 text-xs font-medium">
            {building ? "Close" : "+ New commitment"}
          </button>
        </div>
        {building && (
          <div className="mb-3">
            <CommitmentBuilder clientId={clientId} onDone={() => { setBuilding(false); load(); }} />
          </div>
        )}
        <HistoryGrid data={data} />
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="rise rise-3">
          <SectionTitle>Goals</SectionTitle>
          <div className="space-y-2.5">
            {data.goals.map((g) => (
              <Card key={g.id} className="!p-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{g.title}</span>
                  <span className="tabular text-mute">{g.progress}%</span>
                </div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-high to-second"
                    style={{ width: `${g.progress}%`, boxShadow: "0 0 12px rgba(155,140,255,.5)" }}
                  />
                </div>
                <div className="mt-1.5 text-xs text-mute">{g.target} · by {g.target_date}</div>
              </Card>
            ))}
          </div>
        </section>

        <section className="rise rise-3">
          <SectionTitle>Sessions</SectionTitle>
          <div className="space-y-2.5">
            {data.sessions.slice(0, 5).map((s) => (
              <Card key={s.id} className="flex items-center justify-between !p-4 text-sm">
                <span>{fmtDateTime(s.datetime)}</span>
                <span className="flex items-center gap-2">
                  <StatusPill status={s.status} />
                  {["proposed", "confirmed"].includes(s.status) && new Date(s.datetime) < new Date() && (
                    <>
                      <button onClick={() => setSession(s.id, "completed")} className="text-xs text-accent hover:underline">done</button>
                      <button onClick={() => setSession(s.id, "no-show")} className="text-xs text-danger hover:underline">no-show</button>
                    </>
                  )}
                </span>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <section className="rise rise-4">
        <SectionTitle>Nudge history</SectionTitle>
        <div className="space-y-2.5">
          {data.nudges.slice(0, 6).map((n) => (
            <Card key={n.id} className="flex items-center gap-3 !p-4">
              <TierBadge tier={n.tier} />
              <p className="min-w-0 flex-1 truncate text-xs text-mute">{n.message}</p>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-mute">{n.status}</span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
