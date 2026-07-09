import { useEffect, useState } from "react";
import { api } from "./api";
import type { ClientSummary } from "./api";
import ClientToday from "./views/ClientToday";
import PtRoster from "./views/PtRoster";
import PtClientDetail from "./views/PtClientDetail";
import PtNudgeCentre from "./views/PtNudgeCentre";
import PtSchedule from "./views/PtSchedule";
import PtTemplates from "./views/PtTemplates";
import Feedback from "./views/Feedback";

type PtTab = "roster" | "nudges" | "schedule" | "templates";

export default function App() {
  const [role, setRole] = useState<"pt" | "client">("pt");
  const [ptName, setPtName] = useState("Your coach");
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [activeClientId, setActiveClientId] = useState<number | null>(null);
  const [ptTab, setPtTab] = useState<PtTab>("roster");
  const [detailClientId, setDetailClientId] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    api.get<{ pt: { name: string }; clients: ClientSummary[] }>("/pt/overview").then((d) => {
      setPtName(d.pt.name);
      const sorted = [...d.clients].sort((a, b) => a.name.localeCompare(b.name));
      setClients(sorted);
      setActiveClientId((id) => id ?? sorted[0]?.id ?? null);
    });
  }, [role]);

  const tabs: { id: PtTab; label: string }[] = [
    { id: "roster", label: "Roster" },
    { id: "nudges", label: "Nudge centre" },
    { id: "schedule", label: "Schedule" },
    { id: "templates", label: "Templates" },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[#35d3a0] shadow-[0_0_24px_rgba(91,255,176,.45)]">
              <span className="display text-sm font-extrabold text-ink">O</span>
            </span>
            <div className="leading-tight">
              <div className="display text-lg font-bold tracking-tight">
                ONR<span className="text-accent">.</span>
              </div>
              <div className="hidden text-[10px] uppercase tracking-[0.25em] text-mute sm:block">
                honour your commitments
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="glass flex rounded-2xl p-1 text-xs">
              <button
                onClick={() => { setRole("pt"); setDetailClientId(null); setShowFeedback(false); }}
                className={`rounded-xl px-4 py-2 font-semibold transition-all duration-200 ${
                  role === "pt" && !showFeedback ? "btn-primary" : "text-mute hover:text-white"
                }`}
              >
                PT
              </button>
              <button
                onClick={() => { setRole("client"); setShowFeedback(false); }}
                className={`rounded-xl px-4 py-2 font-semibold transition-all duration-200 ${
                  role === "client" && !showFeedback ? "btn-primary" : "text-mute hover:text-white"
                }`}
              >
                Client
              </button>
              <button
                onClick={() => setShowFeedback(true)}
                className={`rounded-xl px-4 py-2 font-semibold transition-all duration-200 ${
                  showFeedback ? "btn-primary" : "text-mute hover:text-white"
                }`}
              >
                💬<span className="ml-1 hidden sm:inline">Feedback</span>
              </button>
            </div>
            {role === "client" && !showFeedback && (
              <select
                value={activeClientId ?? ""}
                onChange={(e) => setActiveClientId(Number(e.target.value))}
                className="field rounded-2xl px-3 py-2.5 text-xs font-medium"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {role === "pt" && !showFeedback && (
          <div className="mx-auto flex max-w-5xl gap-1 px-5 pb-3">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setPtTab(t.id); setDetailClientId(null); }}
                className={`rounded-xl px-3.5 py-1.5 text-sm transition-all duration-200 ${
                  ptTab === t.id && !detailClientId
                    ? "glass-strong font-semibold text-white"
                    : "text-mute hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {showFeedback && <Feedback />}
        {!showFeedback && role === "client" && activeClientId && (
          <ClientToday key={activeClientId} clientId={activeClientId} ptName={ptName} />
        )}
        {!showFeedback && role === "pt" && detailClientId && (
          <PtClientDetail clientId={detailClientId} onBack={() => setDetailClientId(null)} />
        )}
        {!showFeedback && role === "pt" && !detailClientId && ptTab === "roster" && (
          <PtRoster onOpenClient={setDetailClientId} />
        )}
        {!showFeedback && role === "pt" && !detailClientId && ptTab === "nudges" && <PtNudgeCentre />}
        {!showFeedback && role === "pt" && !detailClientId && ptTab === "schedule" && <PtSchedule />}
        {!showFeedback && role === "pt" && !detailClientId && ptTab === "templates" && <PtTemplates />}
      </main>
    </div>
  );
}
