# ONR — honour your commitments

A fitness accountability platform connecting PTs and clients during the
~165 hours a week they're *not* in the gym together. Not an exercise library —
an engagement layer: one-tap check-ins, adherence scoring, and a tiered nudge
engine.

**Live demo**: deploy to Vercel with zero config — it's a fully static Vite app.

## How it works

The entire "backend" runs in the browser: seed data, adherence scoring, streaks,
and the rules-based nudge engine live in `src/store/` and persist to
localStorage. Every visitor gets their own live sandbox seeded with 1 PT and
8 clients with 4 weeks of history — no server, no database, no env vars.

## Views

- **PT** — roster heatmap (sorted by needs-attention), client detail with
  28-day check-in grid + session prep card, nudge centre, schedule, templates
- **Client** — Today view with one-tap ✅/❌/⏭ check-ins, ONR score ring,
  streaks, shared goals, nudge inbox with one-tap acknowledgement
- **💬 Feedback** — "Feedback from Onur → Alex": freeform notes, add as many
  as you like, one-tap **Send to Alex** (native share sheet on mobile, clipboard
  fallback on desktop). Notes persist independently of the demo data.

## Nudge engine tiers

| Tier | Trigger | Action |
|---|---|---|
| 0 Reinforce | streak milestones | automatic celebration |
| 1 Gentle | 1–2 misses in a category / 7 days | automated template nudge, max 1/category/day |
| 2 Kick | 3+ misses in 7 days, or 5+ days silent | suggestion in nudge centre, PT approves |
| 3 Intervention | score declining 2 weeks running, cancelled/no-show | red flag, prompt to call |

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static output in dist/
```

Reset the demo sandbox any time from the Feedback tab (feedback notes are kept),
or clear the `onr-db-v1` localStorage key.
