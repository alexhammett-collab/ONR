// Scoring + nudge engine, ported from the original Express server to run in-browser.
import { getDb, daysAgo, today, nextId } from "./store";
import type { ClientRow, CommitmentRow } from "./store";

// ---------- scoring ----------
function doneCount(commitmentId: number, from: string, to: string): number {
  return getDb().checkIns.filter(
    (ci) => ci.commitment_id === commitmentId && ci.date >= from && ci.date <= to && ci.status === "done"
  ).length;
}

export function activeCommitments(clientId: number): CommitmentRow[] {
  return getDb().commitments.filter((c) => c.client_id === clientId && c.active === 1);
}

/** Weighted % of expected check-ins completed over a 7-day window ending at `end`. */
export function adherenceScore(clientId: number, end: string = today()): number {
  const commitments = activeCommitments(clientId);
  if (commitments.length === 0) return 0;
  const endDate = new Date(end + "T00:00:00Z");
  const start = new Date(endDate);
  start.setUTCDate(start.getUTCDate() - 6);
  const from = start.toISOString().slice(0, 10);

  let weighted = 0;
  let totalWeight = 0;
  for (const c of commitments) {
    const done = doneCount(c.id, from, end);
    weighted += Math.min(done / c.per_week, 1) * c.weight;
    totalWeight += c.weight;
  }
  return Math.round((weighted / totalWeight) * 100);
}

export interface ScorePoint { weekEnding: string; score: number; }

export function scoreHistory(clientId: number, weeks = 4): ScorePoint[] {
  const points: ScorePoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = daysAgo(w * 7);
    points.push({ weekEnding: end, score: adherenceScore(clientId, end) });
  }
  return points;
}

export function streak(c: CommitmentRow): { count: number; unit: "days" | "weeks" } {
  if (c.per_week >= 7) {
    const byDate = new Map(
      getDb().checkIns.filter((ci) => ci.commitment_id === c.id).map((ci) => [ci.date, ci.status])
    );
    let count = 0;
    const cursor = new Date();
    if (!byDate.has(today())) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      const s = byDate.get(cursor.toISOString().slice(0, 10));
      if (s !== "done" && s !== "rest") break;
      if (s === "done") count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return { count, unit: "days" };
  }
  let count = 0;
  for (let w = 0; w < 12; w++) {
    if (doneCount(c.id, daysAgo(w * 7 + 6), daysAgo(w * 7)) >= c.per_week) count++;
    else break;
  }
  return { count, unit: "weeks" };
}

export function heatColour(score: number, trend: number): "green" | "amber" | "red" {
  if (score >= 70 && trend >= -10) return "green";
  if (score >= 40) return "amber";
  return "red";
}

// ---------- nudge engine ----------
function firstName(name: string): string {
  return name.split(" ")[0];
}

function template(ptId: number, tier: number, category: string): string | null {
  const pool = getDb().templates.filter(
    (t) => t.pt_id === ptId && t.tier === tier && (t.category === category || t.category === "any")
  );
  pool.sort((a, b) => (a.category === category ? 0 : 1) - (b.category === category ? 0 : 1));
  const best = pool.filter((t) => t.category === pool[0]?.category);
  return best.length ? best[Math.floor(Math.random() * best.length)].text : null;
}

function hasRecentNudge(clientId: number, rule: string, sinceDays = 1): boolean {
  const since = daysAgo(sinceDays - 1);
  return getDb().nudges.some(
    (n) =>
      n.client_id === clientId &&
      n.trigger_rule === rule &&
      n.created_at.slice(0, 10) >= since &&
      (n.status === "suggested" || n.status === "sent")
  );
}

function autoNudgedToday(clientId: number, category: string): boolean {
  return getDb().nudges.some(
    (n) =>
      n.client_id === clientId &&
      n.category === category &&
      n.sent_by === "system" &&
      n.created_at.slice(0, 10) === today()
  );
}

function insertNudge(n: {
  clientId: number; tier: number; rule: string; category?: string;
  message: string; status: "suggested" | "sent"; sentBy?: "system" | "pt";
}) {
  const now = new Date().toISOString();
  getDb().nudges.push({
    id: nextId(),
    client_id: n.clientId,
    tier: n.tier,
    trigger_rule: n.rule,
    category: n.category ?? null,
    message: n.message,
    status: n.status,
    sent_by: n.sentBy ?? null,
    created_at: now,
    sent_at: n.status === "sent" ? now : null,
    acknowledged_at: null,
  });
}

function missesInLast7(clientId: number): Map<string, number> {
  const db = getDb();
  const since = daysAgo(6);
  const commitmentsById = new Map(db.commitments.map((c) => [c.id, c]));
  const misses = new Map<string, number>();
  for (const ci of db.checkIns) {
    if (ci.status !== "missed" || ci.date < since) continue;
    const c = commitmentsById.get(ci.commitment_id);
    if (!c || c.client_id !== clientId) continue;
    misses.set(c.category, (misses.get(c.category) ?? 0) + 1);
  }
  return misses;
}

function daysSilent(clientId: number): number {
  const db = getDb();
  const ids = new Set(db.commitments.filter((c) => c.client_id === clientId).map((c) => c.id));
  let last: string | null = null;
  for (const ci of db.checkIns) {
    if (!ids.has(ci.commitment_id) || ci.source === "auto-missed") continue;
    if (!last || ci.date > last) last = ci.date;
  }
  if (!last) return 999;
  return Math.floor(
    (new Date(today() + "T00:00:00Z").getTime() - new Date(last + "T00:00:00Z").getTime()) / 86_400_000
  );
}

export function runEngineForClient(client: ClientRow): void {
  const commitments = activeCommitments(client.id);
  if (commitments.length === 0) return;

  const misses = missesInLast7(client.id);
  const totalMisses = [...misses.values()].reduce((a, b) => a + b, 0);
  const silent = daysSilent(client.id);
  const scoreNow = adherenceScore(client.id);
  const scoreLastWeek = adherenceScore(client.id, daysAgo(7));
  const scoreTwoWeeksAgo = adherenceScore(client.id, daysAgo(14));

  // Tier 0: reinforce (streak milestones)
  for (const c of commitments) {
    const s = streak(c);
    const milestones = s.unit === "days" ? [7, 14, 21, 28] : [2, 4, 8];
    if (milestones.includes(s.count)) {
      const rule = `tier0:streak:${c.id}:${s.count}`;
      if (!hasRecentNudge(client.id, rule, 7)) {
        insertNudge({
          clientId: client.id,
          tier: 0,
          rule,
          category: c.category,
          message: `🔥 ${s.count}-${s.unit === "days" ? "day" : "week"} streak on "${c.title}" — outstanding, ${firstName(client.name)}!`,
          status: "sent",
          sentBy: "system",
        });
      }
    }
  }

  // Tier 3: intervention
  const declining2Weeks = scoreNow < scoreLastWeek && scoreLastWeek < scoreTwoWeeksAgo;
  const since = daysAgo(7);
  const badSessions = getDb().sessions.filter(
    (s) => s.client_id === client.id && ["cancelled", "no-show"].includes(s.status) && s.datetime.slice(0, 10) >= since
  ).length;
  if (declining2Weeks || badSessions > 0) {
    const reasons: string[] = [];
    if (declining2Weeks)
      reasons.push(`ONR score declining two weeks running (${scoreTwoWeeksAgo} → ${scoreLastWeek} → ${scoreNow})`);
    if (badSessions > 0) reasons.push(`${badSessions} cancelled/no-show session(s) this week`);
    const rule = "tier3:intervention";
    if (!hasRecentNudge(client.id, rule, 3)) {
      insertNudge({
        clientId: client.id,
        tier: 3,
        rule,
        message: `${firstName(client.name)} needs a human touch: ${reasons.join("; ")}. Consider a call or address it in the next session.`,
        status: "suggested",
      });
    }
    return;
  }

  // Tier 2: kick suggested
  if (totalMisses >= 3 || silent >= 5) {
    const context =
      silent >= 5
        ? `${firstName(client.name)} hasn't checked in for ${silent} days.`
        : `${firstName(client.name)} has missed ${totalMisses} check-ins in the last 7 days (${[...misses.entries()]
            .map(([cat, n]) => `${n}× ${cat.replace("_", " ")}`)
            .join(", ")}).`;
    const topCategory = [...misses.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "any";
    const suggested =
      template(client.pt_id, 2, topCategory) ??
      `Hey ${firstName(client.name)}, noticed things have slipped a little this week — what's getting in the way? Let's get one small win today.`;
    const rule = "tier2:kick";
    if (!hasRecentNudge(client.id, rule, 2)) {
      insertNudge({
        clientId: client.id,
        tier: 2,
        rule,
        message: `${context} Suggested message: "${suggested.replace("{name}", firstName(client.name))}"`,
        status: "suggested",
      });
    }
    return;
  }

  // Tier 1: gentle automated nudge
  for (const [category, n] of misses) {
    if (n >= 1 && n <= 2 && !autoNudgedToday(client.id, category)) {
      const rule = `tier1:${category}`;
      if (hasRecentNudge(client.id, rule, 2)) continue;
      const text =
        template(client.pt_id, 1, category) ??
        `Quick one, {name} — let's get back on track with ${category.replace("_", " ")} today. One tap at a time. 💪`;
      insertNudge({
        clientId: client.id,
        tier: 1,
        rule,
        category,
        message: text.replace("{name}", firstName(client.name)),
        status: "sent",
        sentBy: "system",
      });
    }
  }
}

export function runEngine(): { evaluated: number } {
  const clients = getDb().clients;
  for (const c of clients) runEngineForClient(c);
  return { evaluated: clients.length };
}
