import { useEffect, useState } from "react";
import { api } from "../api";
import type { Template } from "../api";
import { Card, SectionTitle, TierBadge, categoryEmoji } from "../ui";

export default function PtTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [text, setText] = useState("");
  const [tier, setTier] = useState(1);
  const [category, setCategory] = useState("any");

  const load = () => api.get<Template[]>("/templates").then(setTemplates);
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!text.trim()) return;
    await api.post("/templates", { tier, category, text: text.trim() });
    setText("");
    load();
  };

  return (
    <div className="space-y-7">
      <div className="rise">
        <h1 className="display text-2xl font-bold">Your voice</h1>
        <p className="mt-0.5 text-sm text-mute">
          Write once — the engine reuses these so every automated nudge still sounds like you.
        </p>
      </div>

      <Card className="rise rise-1 space-y-3">
        <div className="text-sm text-mute">
          Use <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-accent">{"{name}"}</code> for the client's first name.
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder='e.g. "No drama, {name} — tomorrow we go again. One tap."'
          className="field w-full rounded-2xl p-3.5 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className="field rounded-xl px-3 py-2.5 text-sm">
            <option value={1}>Tier 1 — gentle (automated)</option>
            <option value={2}>Tier 2 — kick (you approve)</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field rounded-xl px-3 py-2.5 text-sm">
            {["any", "diet", "steps", "solo_session", "sleep", "custom"].map((c) => (
              <option key={c} value={c}>
                {c === "any" ? "🌐 any category" : `${categoryEmoji[c]} ${c.replace("_", " ")}`}
              </option>
            ))}
          </select>
          <button onClick={create} className="btn-primary ml-auto rounded-xl px-4 py-2.5 text-xs">
            Save template
          </button>
        </div>
      </Card>

      <section className="rise rise-2">
        <SectionTitle>Your templates ({templates.length})</SectionTitle>
        <div className="space-y-2.5">
          {templates.map((t) => (
            <Card key={t.id} className="lift flex items-center gap-3 !p-4">
              <TierBadge tier={t.tier} />
              <span className="w-20 shrink-0 text-xs text-mute">{t.category === "any" ? "any" : t.category.replace("_", " ")}</span>
              <p className="min-w-0 flex-1 text-sm leading-relaxed">{t.text}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
