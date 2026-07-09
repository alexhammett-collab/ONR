// Local "API": same call signatures the views always used, but dispatching to
// the in-browser store instead of a server. Fully static — Vercel-friendly.
import { getDb, nextId, save, today, daysAgo } from "./store/store";
import type { CommitmentRow, ClientRow } from "./store/store";
import { seed } from "./store/seed";
import {
  adherenceScore,
  activeCommitments,
  heatColour,
  runEngine,
  runEngineForClient,
  scoreHistory as scoreHistoryFn,
  streak as streakFn,
} from "./store/logic";

// boot: seed once per browser, then run the engine so the demo is alive
if (seed()) {
  runEngine();
  save();
}

// ---------- public types (unchanged from the server era) ----------
export interface Streak {
  count: number;
  unit: "days" | "weeks";
}

export interface Commitment {
  id: number;
  client_id: number;
  category: string;
  title: string;
  per_week: number;
  weight: number;
  checkin_time: string;
  active: number;
  streak?: Streak;
  todayCheckIn?: { status: string } | null;
  doneThisWeek?: number;
}

export interface ClientSummary {
  id: number;
  name: string;
  emoji: string;
  joined_at: string;
  score: number;
  trend: number;
  heat: "green" | "amber" | "red";
  pendingNudges: number;
  nextSession?: Session | null;
  lastCheckIn?: string | null;
}

export interface Session {
  id: number;
  client_id: number;
  datetime: string;
  status: string;
  client_name?: string;
  client_emoji?: string;
}

export interface Nudge {
  id: number;
  client_id: number;
  tier: number;
  trigger_rule: string;
  category?: string | null;
  message: string;
  status: string;
  sent_by?: string | null;
  created_at: string;
  sent_at?: string | null;
  acknowledged_at?: string | null;
  client_name?: string;
  client_emoji?: string;
}

export interface Goal {
  id: number;
  title: string;
  target: string;
  progress: number;
  target_date?: string;
}

export interface CheckIn {
  id: number;
  commitment_id: number;
  date: string;
  status: string;
  source: string;
  category: string;
  title: string;
}

export interface ScorePoint {
  weekEnding: string;
  score: number;
}

export interface ClientDetail extends ClientSummary {
  commitments: Commitment[];
  checkIns: CheckIn[];
  goals: Goal[];
  sessions: Session[];
  nudges: Nudge[];
  scoreHistory: ScorePoint[];
}

export interface Template {
  id: number;
  tier: number;
  category: string;
  text: string;
}

export interface PrepCard {
  client: { id: number; name: string; emoji: string };
  score: number;
  prev: number;
  praise: string[];
  address: string[];
}

// ---------- helpers ----------
function clientSummary(c: ClientRow): ClientSummary {
  const db = getDb();
  const score = adherenceScore(c.id);
  const prev = adherenceScore(c.id, daysAgo(7));
  const trend = score - prev;
  const pendingNudges = db.nudges.filter((n) => n.client_id === c.id && n.status === "suggested").length;
  const now = new Date().toISOString();
  const nextSession =
    db.sessions
      .filter((s) => s.client_id === c.id && s.datetime >= now && ["proposed", "confirmed"].includes(s.status))
      .sort((a, b) => a.datetime.localeCompare(b.datetime))[0] ?? null;
  const commitmentIds = new Set(db.commitments.filter((cm) => cm.client_id === c.id).map((cm) => cm.id));
  let lastCheckIn: string | null = null;
  for (const ci of db.checkIns) {
    if (!commitmentIds.has(ci.commitment_id) || ci.source === "auto-missed") continue;
    if (!lastCheckIn || ci.date > lastCheckIn) lastCheckIn = ci.date;
  }
  return { ...c, score, trend, heat: heatColour(score, trend), pendingNudges, nextSession, lastCheckIn };
}

function withStreak(c: CommitmentRow): Commitment {
  return { ...c, streak: streakFn(c) };
}

function getClient(id: number): ClientRow {
  const c = getDb().clients.find((x) => x.id === id);
  if (!c) throw new Error(`client ${id} not found`);
  return c;
}

function withClientInfo<T extends { client_id: number }>(rows: T[]) {
  const byId = new Map(getDb().clients.map((c) => [c.id, c]));
  return rows.map((r) => ({
    ...r,
    client_name: byId.get(r.client_id)?.name,
    client_emoji: byId.get(r.client_id)?.emoji,
  }));
}

// ---------- endpoint implementations ----------
const handlers = {
  ptOverview() {
    const db = getDb();
    const clients = db.clients.map(clientSummary);
    const heatRank = { red: 0, amber: 1, green: 2 } as Record<string, number>;
    clients.sort((a, b) => heatRank[a.heat] - heatRank[b.heat] || a.score - b.score);
    return { pt: db.pts[0], clients };
  },

  clientDetail(id: number): ClientDetail {
    const db = getDb();
    const client = getClient(id);
    const commitments = db.commitments
      .filter((c) => c.client_id === id)
      .sort((a, b) => b.active - a.active || a.id - b.id)
      .map(withStreak);
    const since = daysAgo(27);
    const byId = new Map(db.commitments.map((c) => [c.id, c]));
    const checkIns = db.checkIns
      .filter((ci) => byId.get(ci.commitment_id)?.client_id === id && ci.date >= since)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((ci) => ({ ...ci, category: byId.get(ci.commitment_id)!.category, title: byId.get(ci.commitment_id)!.title }));
    const goals = db.goals.filter((g) => g.client_id === id);
    const sessions = db.sessions
      .filter((s) => s.client_id === id)
      .sort((a, b) => b.datetime.localeCompare(a.datetime))
      .slice(0, 12);
    const nudges = db.nudges
      .filter((n) => n.client_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20);
    return { ...clientSummary(client), commitments, checkIns, goals, sessions, nudges, scoreHistory: scoreHistoryFn(id, 4) };
  },

  clientToday(id: number): ClientDetail {
    const db = getDb();
    const client = getClient(id);
    const commitments = activeCommitments(id).map((c) => {
      const todayCheckIn = db.checkIns.find((ci) => ci.commitment_id === c.id && ci.date === today()) ?? null;
      const doneThisWeek = db.checkIns.filter(
        (ci) => ci.commitment_id === c.id && ci.date >= daysAgo(6) && ci.status === "done"
      ).length;
      return { ...withStreak(c), todayCheckIn, doneThisWeek };
    });
    const goals = db.goals.filter((g) => g.client_id === id);
    const nudges = db.nudges
      .filter((n) => n.client_id === id && n.status === "sent")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10);
    const cutoff = new Date(Date.now() - 3600_000).toISOString();
    const sessions = db.sessions
      .filter((s) => s.client_id === id && s.datetime >= cutoff && ["proposed", "confirmed"].includes(s.status))
      .sort((a, b) => a.datetime.localeCompare(b.datetime))
      .slice(0, 3);
    return {
      ...clientSummary(client),
      commitments,
      checkIns: [],
      goals,
      nudges,
      sessions,
      scoreHistory: scoreHistoryFn(id, 4),
    };
  },

  prepCard(id: number): PrepCard {
    const client = getClient(id);
    const db = getDb();
    const praise: string[] = [];
    const address: string[] = [];
    for (const c of activeCommitments(id)) {
      const week = db.checkIns.filter((ci) => ci.commitment_id === c.id && ci.date >= daysAgo(6));
      const done = week.filter((ci) => ci.status === "done").length;
      const missed = week.filter((ci) => ci.status === "missed").length;
      const s = streakFn(c);
      if (done >= c.per_week)
        praise.push(`"${c.title}" honoured in full (${done}/${c.per_week})${s.count >= 7 ? ` — ${s.count}-${s.unit} streak` : ""}`);
      else if (missed >= 2) address.push(`"${c.title}" slipping: ${missed} misses this week (${done}/${c.per_week} done)`);
    }
    return {
      client: { id: client.id, name: client.name, emoji: client.emoji },
      score: adherenceScore(id),
      prev: adherenceScore(id, daysAgo(7)),
      praise,
      address,
    };
  },

  createClient(body: { name: string; emoji?: string }) {
    const db = getDb();
    const row: ClientRow = {
      id: nextId(),
      pt_id: db.pts[0].id,
      name: body.name,
      emoji: body.emoji ?? "🙂",
      joined_at: today(),
    };
    db.clients.push(row);
    save();
    return row;
  },

  createCommitment(clientId: number, body: Partial<CommitmentRow>) {
    const db = getDb();
    const row: CommitmentRow = {
      id: nextId(),
      client_id: clientId,
      category: body.category!,
      title: body.title!,
      per_week: body.per_week!,
      weight: body.weight ?? 1,
      checkin_time: body.checkin_time ?? "19:00",
      active: 1,
      created_at: new Date().toISOString(),
    };
    db.commitments.push(row);
    save();
    return row;
  },

  patchCommitment(id: number, body: Partial<CommitmentRow>) {
    const c = getDb().commitments.find((x) => x.id === id);
    if (!c) throw new Error("commitment not found");
    for (const f of ["title", "per_week", "weight", "checkin_time", "active"] as const) {
      if (body[f] !== undefined) (c as unknown as Record<string, unknown>)[f] = body[f];
    }
    save();
    return c;
  },

  checkIn(body: { commitment_id: number; status: "done" | "missed" | "rest"; date?: string }) {
    const db = getDb();
    const d = body.date ?? today();
    const existing = db.checkIns.find((ci) => ci.commitment_id === body.commitment_id && ci.date === d);
    if (existing) {
      existing.status = body.status;
      existing.source = "tap";
    } else {
      db.checkIns.push({
        id: nextId(),
        commitment_id: body.commitment_id,
        date: d,
        status: body.status,
        source: "tap",
        created_at: new Date().toISOString(),
      });
    }
    const commitment = db.commitments.find((c) => c.id === body.commitment_id)!;
    const client = getClient(commitment.client_id);
    runEngineForClient(client);
    save();
    return { ok: true, score: adherenceScore(client.id) };
  },

  nudges(status: string) {
    return withClientInfo(
      getDb()
        .nudges.filter((n) => n.status === status)
        .sort((a, b) => b.tier - a.tier || b.created_at.localeCompare(a.created_at))
    );
  },

  sendNudge(id: number, message?: string) {
    const n = getDb().nudges.find((x) => x.id === id);
    if (n && n.status === "suggested") {
      n.status = "sent";
      n.sent_by = "pt";
      n.sent_at = new Date().toISOString();
      if (message) n.message = message;
    }
    save();
    return n;
  },

  dismissNudge(id: number) {
    const n = getDb().nudges.find((x) => x.id === id);
    if (n) n.status = "dismissed";
    save();
    return { ok: true };
  },

  ackNudge(id: number) {
    const n = getDb().nudges.find((x) => x.id === id);
    if (n) n.acknowledged_at = new Date().toISOString();
    save();
    return { ok: true };
  },

  sessions() {
    return withClientInfo([...getDb().sessions].sort((a, b) => a.datetime.localeCompare(b.datetime)));
  },

  createSession(body: { client_id: number; datetime: string }) {
    const row = { id: nextId(), client_id: body.client_id, datetime: body.datetime, status: "proposed" };
    getDb().sessions.push(row);
    save();
    return row;
  },

  patchSession(id: number, body: { status?: string; datetime?: string }) {
    const s = getDb().sessions.find((x) => x.id === id);
    if (s) {
      if (body.status) s.status = body.status;
      if (body.datetime) {
        s.datetime = body.datetime;
        s.status = "proposed";
      }
    }
    save();
    return s;
  },

  templates() {
    return [...getDb().templates].sort((a, b) => a.tier - b.tier || a.category.localeCompare(b.category));
  },

  createTemplate(body: { tier: number; category?: string; text: string }) {
    const db = getDb();
    const row = { id: nextId(), pt_id: db.pts[0].id, tier: body.tier, category: body.category ?? "any", text: body.text };
    db.templates.push(row);
    save();
    return row;
  },

  runEngine() {
    const r = runEngine();
    save();
    return r;
  },
};

// ---------- tiny router keeping the old fetch-style call sites working ----------
function dispatch(method: string, path: string, body?: unknown): unknown {
  const [p, query] = path.split("?");
  const q = new URLSearchParams(query ?? "");
  let m: RegExpMatchArray | null;

  if (method === "GET") {
    if (p === "/pt/overview") return handlers.ptOverview();
    if ((m = p.match(/^\/clients\/(\d+)\/today$/))) return handlers.clientToday(Number(m[1]));
    if ((m = p.match(/^\/clients\/(\d+)\/prep-card$/))) return handlers.prepCard(Number(m[1]));
    if ((m = p.match(/^\/clients\/(\d+)$/))) return handlers.clientDetail(Number(m[1]));
    if (p === "/nudges") return handlers.nudges(q.get("status") ?? "suggested");
    if (p === "/sessions") return handlers.sessions();
    if (p === "/templates") return handlers.templates();
  }
  if (method === "POST") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = (body ?? {}) as any;
    if (p === "/clients") return handlers.createClient(b);
    if ((m = p.match(/^\/clients\/(\d+)\/commitments$/))) return handlers.createCommitment(Number(m[1]), b);
    if (p === "/checkins") return handlers.checkIn(b);
    if ((m = p.match(/^\/nudges\/(\d+)\/send$/))) return handlers.sendNudge(Number(m[1]), (b as { message?: string }).message);
    if ((m = p.match(/^\/nudges\/(\d+)\/dismiss$/))) return handlers.dismissNudge(Number(m[1]));
    if ((m = p.match(/^\/nudges\/(\d+)\/ack$/))) return handlers.ackNudge(Number(m[1]));
    if (p === "/sessions") return handlers.createSession(b);
    if (p === "/templates") return handlers.createTemplate(b);
    if (p === "/engine/run") return handlers.runEngine();
  }
  if (method === "PATCH") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = (body ?? {}) as any;
    if ((m = p.match(/^\/commitments\/(\d+)$/))) return handlers.patchCommitment(Number(m[1]), b);
    if ((m = p.match(/^\/sessions\/(\d+)$/))) return handlers.patchSession(Number(m[1]), b);
  }
  throw new Error(`no local handler for ${method} ${path}`);
}

export const api = {
  get: <T>(path: string) => Promise.resolve(dispatch("GET", path) as T),
  post: <T>(path: string, body?: unknown) => Promise.resolve(dispatch("POST", path, body) as T),
  patch: <T>(path: string, body: unknown) => Promise.resolve(dispatch("PATCH", path, body) as T),
};
