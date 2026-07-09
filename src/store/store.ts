// In-browser data layer: the whole ONR "backend" lives in localStorage so the
// app deploys as a fully static site. Every visitor gets a live seeded sandbox.

export interface PtRow { id: number; name: string; }
export interface ClientRow { id: number; pt_id: number; name: string; emoji: string; joined_at: string; }
export interface CommitmentRow {
  id: number; client_id: number; category: string; title: string;
  per_week: number; weight: number; checkin_time: string; active: number; created_at: string;
}
export interface CheckInRow {
  id: number; commitment_id: number; date: string;
  status: "done" | "missed" | "rest"; source: string; created_at: string;
}
export interface GoalRow {
  id: number; client_id: number; title: string; target: string; progress: number; target_date?: string;
}
export interface SessionRow { id: number; client_id: number; datetime: string; status: string; }
export interface NudgeRow {
  id: number; client_id: number; tier: number; trigger_rule: string; category: string | null;
  message: string; status: string; sent_by: string | null;
  created_at: string; sent_at: string | null; acknowledged_at: string | null;
}
export interface TemplateRow { id: number; pt_id: number; tier: number; category: string; text: string; }

export interface DB {
  pts: PtRow[];
  clients: ClientRow[];
  commitments: CommitmentRow[];
  checkIns: CheckInRow[];
  goals: GoalRow[];
  sessions: SessionRow[];
  nudges: NudgeRow[];
  templates: TemplateRow[];
  seq: number;
}

const KEY = "onr-db-v1";

function empty(): DB {
  return { pts: [], clients: [], commitments: [], checkIns: [], goals: [], sessions: [], nudges: [], templates: [], seq: 0 };
}

let db: DB | null = null;

export function getDb(): DB {
  if (db) return db;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      db = JSON.parse(raw) as DB;
      return db;
    }
  } catch { /* corrupted or unavailable — fall through to fresh seed */ }
  db = empty();
  return db;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(getDb()));
  } catch { /* storage full/unavailable — keep going in memory */ }
}

export function nextId(): number {
  const d = getDb();
  d.seq += 1;
  return d.seq;
}

export function resetDb() {
  db = empty();
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// ---- date helpers ----
export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function today(): string {
  return iso(new Date());
}
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}
export function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
