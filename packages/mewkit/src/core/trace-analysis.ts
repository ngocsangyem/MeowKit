// Pure, deterministic analysis over the append trace log. No filesystem, no clock — the CLI
// supplies records and `now`. On-demand only: nothing here runs in a hook hot-path. Everything
// is advisory — these functions report; they never gate.

/** One JSONL trace record (shape written by hooks/append-trace.sh; fields are best-effort). */
export interface TraceRecord {
	schema_version?: string;
	ts?: string;
	event?: string;
	run_id?: string;
	model?: string;
	density?: string;
	/** Canonical task identity for task-joined queries (absent on legacy/pre-task logs). */
	task_id?: string;
	plan_path?: string;
	data?: Record<string, unknown>;
}

export type TraceTier = "minimal" | "standard" | "detailed";

const VERIFY_RE = /verif|test|review|evaluat|pass|lint|typecheck/i;
const WORK_RE = /edit|build|implement|write|generat|fix|refactor/i;

/** Parse JSONL; skip blank/malformed lines rather than throwing (logs are append-only and
 *  may contain a partially-written trailing line). */
export function parseTraceLog(content: string): TraceRecord[] {
	const out: TraceRecord[] = [];
	for (const line of content.split("\n")) {
		const t = line.trim();
		if (!t) continue;
		try {
			const obj = JSON.parse(t) as unknown;
			if (obj && typeof obj === "object") out.push(obj as TraceRecord);
		} catch {
			/* skip malformed line */
		}
	}
	return out;
}

export interface ScoreResult {
	tier: TraceTier;
	events: number;
	types: number;
	hasVerification: boolean;
}

/** Trace-quality tier for a set of records: richer + more diverse + verified ⇒ higher tier. */
export function scoreTier(records: TraceRecord[]): ScoreResult {
	const events = records.length;
	const types = new Set(records.map((r) => r.event ?? "unknown")).size;
	const hasVerification = records.some((r) => VERIFY_RE.test(r.event ?? ""));
	let tier: TraceTier = "minimal";
	if (events >= 10 && types >= 4) tier = "detailed";
	else if (events >= 3 && types >= 2) tier = "standard";
	return { tier, events, types, hasVerification };
}

/** Group records by run_id (a "lane") and score each. Records with no run_id share the
 *  synthetic "(unattributed)" lane. */
export function scoreByRun(records: TraceRecord[]): Map<string, ScoreResult> {
	const byRun = new Map<string, TraceRecord[]>();
	for (const r of records) {
		const id = r.run_id && r.run_id.length > 0 ? r.run_id : "(unattributed)";
		const list = byRun.get(id) ?? [];
		list.push(r);
		byRun.set(id, list);
	}
	const out = new Map<string, ScoreResult>();
	for (const [id, list] of byRun) out.set(id, scoreTier(list));
	return out;
}

/** Shannon entropy (bits) over the event-type distribution — a disorder measure. */
export function shannonEntropy(records: TraceRecord[]): number {
	if (records.length === 0) return 0;
	const counts = new Map<string, number>();
	for (const r of records) {
		const e = r.event ?? "unknown";
		counts.set(e, (counts.get(e) ?? 0) + 1);
	}
	const n = records.length;
	let h = 0;
	for (const c of counts.values()) {
		const p = c / n;
		h -= p * Math.log2(p);
	}
	return Math.round(h * 1000) / 1000;
}

/** Normalize a friction message for grouping: lowercase, collapse whitespace, strip wrapping
 *  quotes and trailing punctuation. Identical-in-meaning lines collapse to one key. */
export function normalizeFriction(msg: string): string {
	return msg
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/^["'`]+|["'`]+$/g, "")
		.replace(/[.!?,;:]+$/g, "")
		.trim();
}

function isFriction(r: TraceRecord): boolean {
	return r.event === "friction";
}

function frictionMessage(r: TraceRecord): string {
	const m = r.data?.["message"];
	return typeof m === "string" ? m : "";
}

function frictionResponsibility(r: TraceRecord): string | undefined {
	const v = r.data?.["responsibility"];
	return typeof v === "string" && v.length > 0 ? v : undefined;
}

export interface FrictionGroup {
	message: string; // the first-seen original (not normalized) for display
	count: number;
	responsibility?: string;
}

/** Group friction records by normalized message, descending by count then message. */
export function groupFriction(records: TraceRecord[]): FrictionGroup[] {
	const groups = new Map<string, FrictionGroup>();
	for (const r of records) {
		if (!isFriction(r)) continue;
		const raw = frictionMessage(r);
		if (!raw) continue;
		const key = normalizeFriction(raw);
		const existing = groups.get(key);
		if (existing) existing.count += 1;
		else groups.set(key, { message: raw, count: 1, responsibility: frictionResponsibility(r) });
	}
	return [...groups.values()].sort((a, b) => b.count - a.count || a.message.localeCompare(b.message));
}

export interface AuditResult {
	total: number;
	orphaned: number; // no run_id
	stale: number; // older than staleDays
	unverifiedRuns: number; // runs with work events but no verification event
	entropy: number;
	repeatedFriction: FrictionGroup[]; // count >= 2
	frictionByResponsibility: Record<string, number>;
}

/** Entropy / drift audit. `now` + `staleDays` are injected for determinism. */
export function auditTraces(records: TraceRecord[], opts: { now: Date; staleDays?: number }): AuditResult {
	const staleDays = opts.staleDays ?? 30;
	const cutoff = opts.now.getTime() - staleDays * 24 * 60 * 60 * 1000;

	let orphaned = 0;
	let stale = 0;
	const byRun = new Map<string, TraceRecord[]>();
	const frictionByResponsibility: Record<string, number> = {};

	for (const r of records) {
		if (!r.run_id) orphaned += 1;
		if (r.ts) {
			const t = Date.parse(r.ts);
			if (!Number.isNaN(t) && t < cutoff) stale += 1;
		}
		const id = r.run_id ?? "";
		if (id) {
			const list = byRun.get(id) ?? [];
			list.push(r);
			byRun.set(id, list);
		}
		if (isFriction(r)) {
			const resp = frictionResponsibility(r);
			if (resp) frictionByResponsibility[resp] = (frictionByResponsibility[resp] ?? 0) + 1;
		}
	}

	let unverifiedRuns = 0;
	for (const list of byRun.values()) {
		const hasWork = list.some((r) => WORK_RE.test(r.event ?? ""));
		const hasVerify = list.some((r) => VERIFY_RE.test(r.event ?? ""));
		if (hasWork && !hasVerify) unverifiedRuns += 1;
	}

	return {
		total: records.length,
		orphaned,
		stale,
		unverifiedRuns,
		entropy: shannonEntropy(records),
		repeatedFriction: groupFriction(records).filter((g) => g.count >= 2),
		frictionByResponsibility,
	};
}

export interface ProposalItem {
	kind: "friction" | "drift";
	title: string;
	evidenceCount: number;
	responsibility?: string;
}

/** Advisory backlog proposals: repeated friction (≥2) + audit drift findings. Never gates. */
export function proposeImprovements(audit: AuditResult): ProposalItem[] {
	const items: ProposalItem[] = [];
	for (const g of audit.repeatedFriction) {
		items.push({ kind: "friction", title: g.message, evidenceCount: g.count, responsibility: g.responsibility });
	}
	if (audit.unverifiedRuns > 0)
		items.push({
			kind: "drift",
			title: "Runs with work but no verification event",
			evidenceCount: audit.unverifiedRuns,
		});
	if (audit.orphaned > 0)
		items.push({ kind: "drift", title: "Unattributed trace records (no run_id)", evidenceCount: audit.orphaned });
	if (audit.stale > 0) items.push({ kind: "drift", title: "Stale trace records", evidenceCount: audit.stale });
	return items;
}
