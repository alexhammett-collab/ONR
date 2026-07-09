import { useEffect, useRef, useState } from "react";
import { Card, SectionTitle } from "../ui";
import { resetDb } from "../store/store";

interface FeedbackItem {
  id: number;
  text: string;
  created_at: string;
}

// Feedback lives under its own key so resetting the demo data never wipes it.
const KEY = "onr-feedback-v1";

function loadFeedback(): FeedbackItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as FeedbackItem[];
  } catch {
    return [];
  }
}

function saveFeedback(items: FeedbackItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

function composeShareText(items: FeedbackItem[]): string {
  const lines = items
    .slice()
    .reverse()
    .map((f, i) => `${i + 1}. ${f.text}`);
  return `ONR feedback from Onur:\n\n${lines.join("\n\n")}`;
}

export default function Feedback() {
  const [items, setItems] = useState<FeedbackItem[]>(loadFeedback);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => saveFeedback(items), [items]);

  const add = () => {
    const t = text.trim();
    if (!t) return;
    setItems([{ id: Date.now(), text: t, created_at: new Date().toISOString() }, ...items]);
    setText("");
    inputRef.current?.focus();
  };

  const remove = (id: number) => setItems(items.filter((f) => f.id !== id));

  const shareAll = async () => {
    const body = composeShareText(items);
    if (navigator.share) {
      try {
        await navigator.share({ title: "ONR feedback for Alex", text: body });
        return;
      } catch { /* user cancelled — fall through to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:?subject=${encodeURIComponent("ONR feedback for Alex")}&body=${encodeURIComponent(body)}`;
    }
  };

  const resetDemo = () => {
    if (!window.confirm("Reset the demo data? Your feedback notes are kept.")) return;
    resetDb();
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-md space-y-7">
      <div className="rise">
        <h1 className="display text-2xl font-bold">
          Feedback from Onur <span className="text-mute">→</span> Alex
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-mute">
          Anything and everything — ideas, gripes, missing features, wild thoughts.
          Add as many as you like, then hit <span className="text-accent">Send to Alex</span>.
        </p>
      </div>

      <Card className="rise rise-1 glass-strong space-y-3 !p-4">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          rows={3}
          placeholder="What's on your mind, Onur? Freeform — one thought per note…"
          className="field w-full resize-none rounded-2xl p-3.5 text-base leading-relaxed sm:text-sm"
        />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-mute">Enter to add · Shift+Enter for a new line</span>
          <button onClick={add} className="btn-primary ml-auto rounded-xl px-5 py-2.5 text-sm">
            + Add note
          </button>
        </div>
      </Card>

      {items.length > 0 && (
        <div className="rise rise-2 flex items-center">
          <SectionTitle>
            {items.length} note{items.length === 1 ? "" : "s"}
          </SectionTitle>
          <button onClick={shareAll} className="btn-ghost mb-3 ml-auto rounded-xl px-4 py-2 text-xs font-medium">
            {copied ? "Copied ✓" : "📤 Send to Alex"}
          </button>
        </div>
      )}

      <div className="space-y-2.5">
        {items.length === 0 && (
          <Card className="rise rise-2 text-center text-sm text-mute">
            No notes yet. First impressions are the most valuable — write the first one now.
          </Card>
        )}
        {items.map((f, i) => (
          <Card key={f.id} className={`rise !p-4 ${i < 4 ? `rise-${i + 1}` : "rise-4"}`}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{f.text}</p>
            <div className="mt-2.5 flex items-center text-[11px] text-mute">
              <span>
                {new Date(f.created_at).toLocaleString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <button onClick={() => remove(f.id)} className="ml-auto transition hover:text-danger">
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="rise rise-4 pt-4 text-center">
        <button onClick={resetDemo} className="text-[11px] text-mute/60 transition hover:text-mute">
          Reset demo data (keeps your notes)
        </button>
      </div>
    </div>
  );
}
