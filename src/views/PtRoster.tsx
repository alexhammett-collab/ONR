import { useEffect, useState } from "react";
import { api } from "../api";
import type { ClientSummary } from "../api";
import { Card, HeatBadge, ScoreBar, Trend, fmtDateTime } from "../ui";

export default function PtRoster({ onOpenClient }: { onOpenClient: (id: number) => void }) {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const load = () =>
    api.get<{ clients: ClientSummary[] }>("/pt/overview").then((d) => setClients(d.clients));
  useEffect(() => {
    load();
  }, []);

  const counts = { red: 0, amber: 0, green: 0 } as Record<string, number>;
  clients.forEach((c) => counts[c.heat]++);

  const addClient = async () => {
    if (!name.trim()) return;
    await api.post("/clients", { name: name.trim() });
    setName("");
    setAdding(false);
    load();
  };

  const legend = (heat: string, label: string, n: number) => (
    <span className="flex items-center gap-1.5 text-xs text-mute">
      <HeatBadge heat={heat} />
      <span className="tabular font-medium text-white/80">{n}</span> {label}
    </span>
  );

  return (
    <div className="space-y-5">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-bold">Your book</h1>
          <p className="mt-0.5 text-sm text-mute">Sorted by needs attention</p>
        </div>
        <div className="flex items-center gap-4">
          {legend("red", "at risk", counts.red)}
          {legend("amber", "slipping", counts.amber)}
          {legend("green", "on track", counts.green)}
          <button onClick={() => setAdding(!adding)} className="btn-ghost rounded-xl px-3.5 py-2 text-xs font-medium">
            + Add client
          </button>
        </div>
      </div>

      {adding && (
        <Card className="rise flex items-center gap-2 !p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addClient()}
            placeholder="Client name"
            className="field flex-1 rounded-xl px-3.5 py-2.5 text-sm"
            autoFocus
          />
          <button onClick={addClient} className="btn-primary rounded-xl px-4 py-2.5 text-xs">
            Create
          </button>
        </Card>
      )}

      <div className="grid gap-3.5 md:grid-cols-2">
        {clients.map((c, i) => (
          <Card
            key={c.id}
            className={`lift rise cursor-pointer !p-5 ${i < 4 ? `rise-${i + 1}` : "rise-4"}`}
          >
            <div onClick={() => onOpenClient(c.id)}>
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-2xl">
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <HeatBadge heat={c.heat} />
                    <span className="truncate font-semibold">{c.name}</span>
                    {c.pendingNudges > 0 && (
                      <span className="whitespace-nowrap rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warn">
                        {c.pendingNudges} action{c.pendingNudges > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate text-xs text-mute">
                    Last check-in {c.lastCheckIn ?? "never"}
                    {c.nextSession && <> · {fmtDateTime(c.nextSession.datetime)}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="display tabular text-2xl font-bold">{c.score}</div>
                  <div className="text-xs"><Trend trend={c.trend} /></div>
                </div>
              </div>
              <div className="mt-4">
                <ScoreBar score={c.score} heat={c.heat} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
