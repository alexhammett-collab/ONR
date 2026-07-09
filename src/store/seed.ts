import { getDb, nextId, save, daysAgo, daysFromNow, iso } from "./store";

/** Deterministic PRNG so the demo is stable across reseeds. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Profile = "strong" | "steady" | "slipping" | "drifting" | "silent";

interface ClientSeed {
  name: string;
  emoji: string;
  profile: Profile;
  commitments: { category: string; title: string; per_week: number; weight: number; time: string }[];
  goals: { title: string; target: string; progress: number; target_date: string }[];
  sessionDay: number;
  extraSessionStatus?: "cancelled" | "no-show";
}

const CLIENTS: ClientSeed[] = [
  {
    name: "Sam Whitfield", emoji: "🏃", profile: "drifting", sessionDay: 2, extraSessionStatus: "no-show",
    commitments: [
      { category: "diet", title: "Hit protein target", per_week: 7, weight: 1.5, time: "20:00" },
      { category: "steps", title: "10k steps", per_week: 7, weight: 1, time: "21:00" },
      { category: "solo_session", title: "Solo gym session", per_week: 2, weight: 2, time: "18:00" },
    ],
    goals: [{ title: "Drop to 82kg", target: "82kg by September", progress: 35, target_date: iso(daysFromNow(70)) }],
  },
  {
    name: "Priya Nair", emoji: "🧗", profile: "strong", sessionDay: 1,
    commitments: [
      { category: "diet", title: "Log meals & hit macros", per_week: 7, weight: 1, time: "20:30" },
      { category: "steps", title: "8k steps", per_week: 7, weight: 1, time: "21:00" },
      { category: "solo_session", title: "Climbing conditioning", per_week: 2, weight: 1.5, time: "19:00" },
    ],
    goals: [{ title: "First 7a climb", target: "Send 7a route", progress: 70, target_date: iso(daysFromNow(45)) }],
  },
  {
    name: "Marcus Chen", emoji: "🏋️", profile: "steady", sessionDay: 3,
    commitments: [
      { category: "diet", title: "3500 kcal bulk target", per_week: 7, weight: 1.5, time: "21:00" },
      { category: "sleep", title: "8h sleep", per_week: 7, weight: 1, time: "09:00" },
      { category: "solo_session", title: "Solo hypertrophy session", per_week: 3, weight: 2, time: "18:30" },
    ],
    goals: [{ title: "140kg squat", target: "140kg x1 by December", progress: 55, target_date: iso(daysFromNow(150)) }],
  },
  {
    name: "Elena Rodriguez", emoji: "🚴", profile: "slipping", sessionDay: 4,
    commitments: [
      { category: "diet", title: "No late-night snacking", per_week: 7, weight: 1, time: "22:00" },
      { category: "steps", title: "12k steps", per_week: 7, weight: 1, time: "20:00" },
      { category: "custom", title: "Morning mobility (10 min)", per_week: 5, weight: 0.5, time: "07:30" },
    ],
    goals: [{ title: "Century ride", target: "100 mile sportive", progress: 40, target_date: iso(daysFromNow(60)) }],
  },
  {
    name: "Tom Okafor", emoji: "🥊", profile: "strong", sessionDay: 5,
    commitments: [
      { category: "diet", title: "Fight-camp meal plan", per_week: 7, weight: 2, time: "20:00" },
      { category: "solo_session", title: "Roadwork run", per_week: 3, weight: 1.5, time: "06:30" },
      { category: "sleep", title: "In bed by 22:30", per_week: 7, weight: 1, time: "08:00" },
    ],
    goals: [{ title: "Make 75kg", target: "Weigh-in at 75kg", progress: 80, target_date: iso(daysFromNow(30)) }],
  },
  {
    name: "Grace Lindqvist", emoji: "🧘", profile: "steady", sessionDay: 1,
    commitments: [
      { category: "steps", title: "9k steps", per_week: 7, weight: 1, time: "20:30" },
      { category: "custom", title: "Evening stretch routine", per_week: 4, weight: 0.5, time: "21:30" },
      { category: "diet", title: "Veg with every meal", per_week: 7, weight: 1, time: "20:00" },
    ],
    goals: [{ title: "Pain-free 5k", target: "Run 5k without knee pain", progress: 60, target_date: iso(daysFromNow(40)) }],
  },
  {
    name: "Dev Patel", emoji: "⚽", profile: "silent", sessionDay: 2, extraSessionStatus: "cancelled",
    commitments: [
      { category: "diet", title: "Cut takeaways to 1/week", per_week: 7, weight: 1, time: "20:00" },
      { category: "solo_session", title: "Gym session", per_week: 2, weight: 2, time: "18:00" },
      { category: "steps", title: "10k steps", per_week: 7, weight: 1, time: "21:00" },
    ],
    goals: [{ title: "Pre-season fitness", target: "Beep test level 11", progress: 20, target_date: iso(daysFromNow(55)) }],
  },
  {
    name: "Hannah Moore", emoji: "🏊", profile: "slipping", sessionDay: 6,
    commitments: [
      { category: "diet", title: "Hydration: 2.5L water", per_week: 7, weight: 0.5, time: "19:00" },
      { category: "solo_session", title: "Swim session", per_week: 2, weight: 2, time: "07:00" },
      { category: "sleep", title: "7.5h sleep", per_week: 7, weight: 1, time: "09:00" },
    ],
    goals: [{ title: "Open-water 3k", target: "3k open-water swim", progress: 45, target_date: iso(daysFromNow(80)) }],
  },
];

function doneProb(profile: Profile, weekIdx: number): number {
  switch (profile) {
    case "strong":   return [0.85, 0.9, 0.92, 0.95][3 - weekIdx];
    case "steady":   return [0.75, 0.8, 0.72, 0.78][3 - weekIdx];
    case "slipping": return [0.85, 0.75, 0.6, 0.45][3 - weekIdx];
    case "drifting": return [0.7, 0.55, 0.4, 0.25][3 - weekIdx];
    case "silent":   return [0.65, 0.5, 0.3, 0.0][3 - weekIdx];
  }
}

const TEMPLATES: { tier: number; category: string; text: string }[] = [
  { tier: 1, category: "diet", text: "One off-plan day never sank a ship, {name} — next meal is a fresh start. 🍳" },
  { tier: 1, category: "steps", text: "Legs still work, {name}? 😄 Even a 20-min walk tonight keeps the wheels turning." },
  { tier: 1, category: "solo_session", text: "That solo session won't do itself, {name} — 45 minutes, in and out. You always feel better after." },
  { tier: 1, category: "sleep", text: "Recovery is where the gains happen, {name}. Screens off early tonight? 😴" },
  { tier: 1, category: "any", text: "Small slip, {name} — nothing we can't fix today. One tap, one win." },
  { tier: 2, category: "any", text: "Hey {name}, I've noticed this week's been tough. What's the real blocker? Reply with one word and we'll sort it." },
  { tier: 2, category: "diet", text: "{name}, let's not let one rough week become a rough month. Tonight: one good meal, one tick. Deal?" },
  { tier: 2, category: "solo_session", text: "{name} — book your solo session for tomorrow right now, before you talk yourself out of it. I'll check in after." },
];

export function seed(): boolean {
  const db = getDb();
  if (db.pts.length > 0) return false;
  const rand = mulberry32(42);
  const now = new Date().toISOString();

  const ptId = nextId();
  db.pts.push({ id: ptId, name: "Maya Kowalski" });

  for (const t of TEMPLATES) {
    db.templates.push({ id: nextId(), pt_id: ptId, tier: t.tier, category: t.category, text: t.text });
  }

  for (const c of CLIENTS) {
    const clientId = nextId();
    db.clients.push({
      id: clientId,
      pt_id: ptId,
      name: c.name,
      emoji: c.emoji,
      joined_at: daysAgo(28 + Math.floor(rand() * 60)),
    });

    for (const g of c.goals) {
      db.goals.push({ id: nextId(), client_id: clientId, ...g });
    }

    const commitmentIds: { id: number; per_week: number }[] = [];
    for (const cm of c.commitments) {
      const id = nextId();
      db.commitments.push({
        id,
        client_id: clientId,
        category: cm.category,
        title: cm.title,
        per_week: cm.per_week,
        weight: cm.weight,
        checkin_time: cm.time,
        active: 1,
        created_at: now,
      });
      commitmentIds.push({ id, per_week: cm.per_week });
    }

    // 4 weeks of check-in history (yesterday backwards; today left open for the demo)
    for (let d = 1; d <= 28; d++) {
      const weekIdx = Math.floor((d - 1) / 7);
      const date = daysAgo(d);
      const p = doneProb(c.profile, weekIdx);
      for (const cm of commitmentIds) {
        const isDaily = cm.per_week >= 7;
        if (!isDaily && rand() > cm.per_week / 7) continue;
        if (c.profile === "silent" && d <= 6) continue;
        const r = rand();
        let status: "done" | "missed" | "rest";
        if (r < p) status = "done";
        else if (isDaily && r < p + 0.08) status = "rest";
        else status = "missed";
        const source = status === "missed" && rand() < 0.4 ? "auto-missed" : "tap";
        db.checkIns.push({ id: nextId(), commitment_id: cm.id, date, status, source, created_at: now });
      }
    }

    // Sessions: 4 past + 2 upcoming
    for (let w = 4; w >= 1; w--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - w * 7 + (c.sessionDay - dt.getDay()));
      if (dt >= new Date()) dt.setDate(dt.getDate() - 7);
      const status = w === 1 && c.extraSessionStatus ? c.extraSessionStatus : "completed";
      dt.setHours(9 + (c.sessionDay % 3) * 4, 0, 0, 0);
      db.sessions.push({ id: nextId(), client_id: clientId, datetime: dt.toISOString(), status });
    }
    for (let w = 0; w < 2; w++) {
      const dt = new Date();
      dt.setDate(dt.getDate() + ((c.sessionDay - dt.getDay() + 7) % 7 || 7) + w * 7);
      dt.setHours(9 + (c.sessionDay % 3) * 4, 0, 0, 0);
      db.sessions.push({ id: nextId(), client_id: clientId, datetime: dt.toISOString(), status: w === 0 ? "confirmed" : "proposed" });
    }
  }

  save();
  return true;
}
