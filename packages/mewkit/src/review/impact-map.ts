// Deterministic, diff-scoped Review Impact Map. Pure derivation over a unified diff
// (no repo access) + an optional search-enrichment step that takes an injected
// `search` callback (so caller/consumer discovery is unit-testable without a worktree).
// Every field is source-cited (file paths + literal search terms) — never a free-form
// architecture summary. It decides whether a targeted `mk:scout` pass is REQUIRED
// before review fan-out.

export interface ChangedFile {
	path: string;
	kind: "source" | "test" | "docs" | "config" | "lockfile" | "other";
	deleted: boolean;
	renamedFrom?: string;
	added: number; // added lines in this file's hunks
	removed: number; // removed lines
}

export interface DiffStats {
	sourceChanged: number; // added+removed lines in source files (drives topology tier)
	totalChanged: number; // added+removed lines across all files
}

export interface SymbolRef {
	file: string;
	symbol: string;
}

export interface ImpactMap {
	changedFiles: ChangedFile[];
	changedExports: SymbolRef[]; // added/modified exported symbols in production source
	removedOrRenamed: SymbolRef[]; // removed exports + renamed/deleted files (contract risk)
	configKeys: string[]; // added/changed keys in config files
	productionDirs: string[]; // distinct dirs of changed source files
	riskFlags: string[]; // AUTH, PAYMENT, DATA_MODEL, CONCURRENCY, PUBLIC_API, ABSTRACTION
	searchTerms: string[]; // symbols to grep for callers/consumers/read-sites
	scoutRequired: boolean;
	scoutReasons: string[];
	stats: DiffStats; // line counts for topology-tier selection (Phase 5)
	// Populated by enrichWithSearches(); each maps a search term to cited hits.
	callers?: { term: string; hits: string[] }[];
}

const TEST_RE = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const DOCS_RE = /(^|\/)docs\/|\.md$/;
const LOCKFILE_RE = /(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|.*\.lock)$/;
const CONFIG_RE = /\.(json|ya?ml|toml|ini|env)$|(^|\/)\.env(\.|$)/;
const SOURCE_RE = /\.[cm]?[jt]sx?$|\.py$|\.go$|\.rs$|\.rb$|\.java$|\.kt$|\.swift$/;

const RISK_PATTERNS: { flag: string; re: RegExp }[] = [
	{ flag: "AUTH", re: /auth|login|logout|session|jwt|oauth|passwd|password|passkey|token/i },
	{ flag: "PAYMENT", re: /payment|billing|invoice|charge|stripe|payout|refund/i },
	{ flag: "DATA_MODEL", re: /migration|schema|alter table|\bcascade\b|drop table|createtable/i },
	{ flag: "CONCURRENCY", re: /mutex|lock|semaphore|worker|thread|race|atomic|concurren/i },
];

function classify(path: string): ChangedFile["kind"] {
	if (TEST_RE.test(path)) return "test";
	if (LOCKFILE_RE.test(path)) return "lockfile";
	if (DOCS_RE.test(path)) return "docs";
	if (SOURCE_RE.test(path)) return "source";
	if (CONFIG_RE.test(path)) return "config";
	return "other";
}

function topDir(path: string): string {
	const parts = path.split("/");
	return parts.length > 1 ? parts.slice(0, 2).join("/") : ".";
}

// Extract exported symbol names from a single added/removed content line.
function exportSymbols(line: string): string[] {
	const out: string[] = [];
	// export function/const/class/interface/type/enum NAME
	const decl = line.match(/export\s+(?:async\s+)?(?:default\s+)?(?:function|const|let|var|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/);
	if (decl) out.push(decl[1]);
	// export { A, B as C }
	const named = line.match(/export\s*\{([^}]+)\}/);
	if (named) {
		for (const part of named[1].split(",")) {
			const name = part.trim().split(/\s+as\s+/i).pop()?.trim();
			if (name && /^[A-Za-z0-9_$]+$/.test(name)) out.push(name);
		}
	}
	return out;
}

// Parse a unified diff into a deterministic impact map (no repo access).
export function deriveImpactFromDiff(diffText: string): ImpactMap {
	const lines = (diffText ?? "").split("\n");
	const files: ChangedFile[] = [];
	const changedExports: SymbolRef[] = [];
	const removedOrRenamed: SymbolRef[] = [];
	const configKeys = new Set<string>();
	const riskFlags = new Set<string>();

	let cur: ChangedFile | null = null;
	for (const line of lines) {
		const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
		if (header) {
			cur = { path: header[2], kind: classify(header[2]), deleted: false, added: 0, removed: 0 };
			files.push(cur);
			continue;
		}
		if (!cur) continue;
		if (line.startsWith("deleted file mode")) cur.deleted = true;
		const rf = line.match(/^rename from (.+)$/);
		if (rf) cur.renamedFrom = rf[1];

		const added = line.startsWith("+") && !line.startsWith("+++");
		const removed = line.startsWith("-") && !line.startsWith("---");
		if (!added && !removed) continue;
		if (added) cur.added++;
		else cur.removed++;
		const content = line.slice(1);

		// risk flags from changed content
		for (const { flag, re } of RISK_PATTERNS) if (re.test(content) || re.test(cur.path)) riskFlags.add(flag);

		if (cur.kind === "source") {
			for (const sym of exportSymbols(content)) {
				(added ? changedExports : removedOrRenamed).push({ file: cur.path, symbol: sym });
			}
		}
		if (cur.kind === "config" && added) {
			const key = content.match(/^\s*["']?([A-Za-z0-9_.-]+)["']?\s*[:=]/);
			if (key) configKeys.add(key[1]);
		}
	}

	// Deleted/renamed files → contract risk. Source removals feed PUBLIC_API; config
	// and generic (schema, feature-flag, .env, .prisma, …) removals/renames are a
	// contract change too and MUST escalate scout (criterion #4). Only test/docs/
	// lockfile deletions are ignorable churn.
	let sourceRemovals = removedOrRenamed.length; // removed source EXPORTS from the main loop
	for (const f of files) {
		if (!f.deleted && !f.renamedFrom) continue;
		if (f.kind === "test" || f.kind === "docs" || f.kind === "lockfile") continue;
		if (f.deleted) removedOrRenamed.push({ file: f.path, symbol: f.kind === "source" ? "<file deleted>" : "<config/file deleted>" });
		if (f.renamedFrom) removedOrRenamed.push({ file: f.renamedFrom, symbol: `<renamed → ${f.path}>` });
		if (f.kind === "source") sourceRemovals++;
	}

	const sourceFiles = files.filter((f) => f.kind === "source");
	const productionDirs = [...new Set(sourceFiles.map((f) => topDir(f.path)))].sort();
	if (changedExports.length > 0 || sourceRemovals > 0) riskFlags.add("PUBLIC_API");
	// New util/lib/helper source file → prior-art search warranted.
	if (sourceFiles.some((f) => !f.deleted && /(^|\/)(lib|utils?|helpers?|shared|common)(\/|[.-])/i.test(f.path))) riskFlags.add("ABSTRACTION");

	const searchTerms = [...new Set([...changedExports, ...removedOrRenamed].map((s) => s.symbol).filter((s) => /^[A-Za-z0-9_$]+$/.test(s)))];

	// ── scout escalation ──────────────────────────────────────────────────────
	const scoutReasons: string[] = [];
	if (removedOrRenamed.length > 0) scoutReasons.push("public symbol / file / config removed or renamed");
	for (const flag of ["AUTH", "PAYMENT", "DATA_MODEL", "CONCURRENCY"]) if (riskFlags.has(flag)) scoutReasons.push(`touches ${flag}`);
	if (productionDirs.length >= 3) scoutReasons.push(`spans ${productionDirs.length} production directories`);
	if (sourceFiles.length >= 5) scoutReasons.push(`${sourceFiles.length} source files changed`);
	if (riskFlags.has("ABSTRACTION")) scoutReasons.push("introduces a utility/abstraction (prior-art search)");

	const nonSource = files.every((f) => f.kind === "docs" || f.kind === "lockfile" || f.kind === "test");
	const scoutRequired = !nonSource && scoutReasons.length > 0;

	const stats: DiffStats = {
		sourceChanged: sourceFiles.reduce((n, f) => n + f.added + f.removed, 0),
		totalChanged: files.reduce((n, f) => n + f.added + f.removed, 0),
	};

	return {
		changedFiles: files,
		changedExports,
		removedOrRenamed,
		configKeys: [...configKeys].sort(),
		productionDirs,
		riskFlags: [...riskFlags].sort(),
		searchTerms,
		scoutRequired,
		scoutReasons,
		stats,
	};
}

// Enrich the map with caller/consumer hits using an injected search function
// (prepare.ts supplies a grep over the isolated PR worktree). Kept separate + pure
// so the derivation is testable without a repo.
export function enrichWithSearches(map: ImpactMap, search: (term: string) => string[]): ImpactMap {
	const callers = map.searchTerms.map((term) => ({ term, hits: search(term) }));
	return { ...map, callers };
}
