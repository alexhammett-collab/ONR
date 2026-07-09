import { useEffect, useState } from "react";
import { api } from "../api";
import type { ClientSummary, Session } from "../api";
import { Card, SectionTitle, StatusPill, fmtDateTime } from "../ui";

export default function PtSchedule() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [clientId, setClientId] = useState<number | "">("");
  const [dt, setDt] = useState("");

  const load = () =>
    Promise.all([
      api.get<Session[]>("/sessions").then(setSessions),
      api.get<{ clients: ClientSummary[] }>("/pt/overview").then((d) => setClients(d.clients)),
    ]);
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!clientId || !dt) return;
    await api.post("/sessions", { client_id: clientId, datetime: new Date(dt).toISOString() });
    setDt("");
    load();
  };

  const upcoming = sessions.filter(
    (s) => new Date(s.datetime) >= new Date() && ["proposed", "confirmed"].includes(s.status)
  );
  const past = sessions
    .filter((s) => new Date(s.datetime) < new Date())
    .sort((a, b) => b.datetime.localeCompare(a.datetime));

  const row = (s: Session) => (
    <Card key={s.id} className="lift flex items-center gap-3.5 !p-4 text-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">{s.client_emoji}</span>
      <span className="font-medium">{s.client_name}</span>
      <span className="text-mute">{fmtDateTime(s.datetime)}</span>
      <span className="ml-auto"><StatusPill status={s.status} /></span>
    </Card>
  );

  return (
    <div className="space-y-7">
      <div className="rise">
        <h1 className="display text-2xl font-bold">Schedule</h1>
        <p className="mt-0.5 text-sm text-mute">Sessions across your book — clients confirm with one tap.</p>
      </div>

      <Card className="rise rise-1 flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-semibold">New session</span>
        <select
          value={clientId}
          onChange={(e) => setClientId(Number(e.target.value))}
          className="field rounded-xl px-3 py-2.5 text-sm"
        >
          <option value="">Pick client…</option>
          {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={dt}
          onChange={(e) => setDt(e.target.value)}
          className="field rounded-xl px-3 py-2.5 text-sm [color-scheme:dark]"
        />
        <button onClick={create} className="btn-primary rounded-xl px-4 py-2.5 text-xs">
          Propose to client
        </button>
      </Card>

      <section className="rise rise-2">
        <SectionTitle>Upcoming ({upcoming.length})</SectionTitle>
        <div className="space-y-2.5">{upcoming.map(row)}</div>
      </section>

      <section className="rise rise-3">
        <SectionTitle>Past</SectionTitle>
        <div className="space-y-2.5">{past.slice(0, 10).map(row)}</div>
      </section>
    </div>
  );
}
