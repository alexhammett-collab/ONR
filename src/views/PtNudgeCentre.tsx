import { useEffect, useState } from "react";
import { api } from "../api";
import type { Nudge } from "../api";
import { Card, SectionTitle, TierBadge } from "../ui";

function SuggestedNudge({ n, onDone }: { n: Nudge; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const match = n.message.match(/Suggested message: "(.+)"$/s);
  const [msg, setMsg] = useState(match?.[1] ?? "");

  const send = async () => {
    await api.post(`/nudges/${n.id}/send`, msg ? { message: msg } : undefined);
    onDone();
  };
  const dismiss = async () => {
    await api.post(`/nudges/${n.id}/dismiss`);
    onDone();
  };

  return (
    <Card className={`rise lift ${n.tier === 3 ? "!border-danger/25" : "!border-warn/20"}`}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-lg">{n.client_emoji}</span>
        <span className="font-semibold">{n.client_name}</span>
        <TierBadge tier={n.tier} />
        <span className="ml-auto text-xs text-mute">{new Date(n.created_at).toLocaleDateString()}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-mute">
        {match ? n.message.slice(0, n.message.indexOf(" Suggested message:")) : n.message}
      </p>
      {match && !editing && (
        <p className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3.5 text-sm italic leading-relaxed">
          "{msg}"
        </p>
      )}
      {editing && (
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          className="field mt-3 w-full rounded-2xl p-3.5 text-sm"
        />
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {n.tier === 2 && (
          <button onClick={send} className="btn-primary rounded-xl px-4 py-2 text-xs">
            Send kick →
          </button>
        )}
        {n.tier === 3 && (
          <button onClick={dismiss} className="btn-danger rounded-xl px-4 py-2 text-xs">
            Handled ✓
          </button>
        )}
        {match && (
          <button onClick={() => setEditing(!editing)} className="btn-ghost rounded-xl px-4 py-2 text-xs">
            {editing ? "Done editing" : "Personalise"}
          </button>
        )}
        <button onClick={dismiss} className="ml-auto rounded-xl px-4 py-2 text-xs text-mute transition hover:text-danger">
          Dismiss
        </button>
      </div>
    </Card>
  );
}

export default function PtNudgeCentre() {
  const [suggested, setSuggested] = useState<Nudge[]>([]);
  const [sent, setSent] = useState<Nudge[]>([]);

  const load = () =>
    Promise.all([
      api.get<Nudge[]>("/nudges?status=suggested").then(setSuggested),
      api.get<Nudge[]>("/nudges?status=sent").then(setSent),
    ]);
  useEffect(() => {
    load();
  }, []);

  const runEngine = async () => {
    await api.post("/engine/run");
    load();
  };

  return (
    <div className="space-y-7">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold">Nudge centre</h1>
          <p className="mt-0.5 text-sm text-mute">
            The engine handles the routine. Your attention goes where it matters.
          </p>
        </div>
        <button
          onClick={runEngine}
          className="btn-ghost rounded-xl px-3.5 py-2 text-xs font-medium"
          title="Re-evaluate all rules now (normally runs on a schedule)"
        >
          ⚙ Run engine now
        </button>
      </div>

      <section>
        <SectionTitle>Needs your attention ({suggested.length})</SectionTitle>
        {suggested.length === 0 && (
          <Card className="rise text-sm text-mute">All quiet — the engine has nothing for you. 🎉</Card>
        )}
        <div className="space-y-3.5">
          {suggested.map((n) => (
            <SuggestedNudge key={n.id} n={n} onDone={load} />
          ))}
        </div>
      </section>

      <section className="rise rise-3">
        <SectionTitle>Recently sent — automated + yours</SectionTitle>
        <div className="space-y-2.5">
          {sent.slice(0, 12).map((n) => (
            <Card key={n.id} className="flex items-center gap-3 !p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">{n.client_emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{n.client_name}</span>
                  <TierBadge tier={n.tier} />
                  <span className="text-xs text-mute">{n.sent_by === "pt" ? "sent by you" : "automated"}</span>
                  {n.acknowledged_at && <span className="text-xs font-medium text-accent">acknowledged ✓</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-mute">{n.message}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
