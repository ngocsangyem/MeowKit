// Single classification table mapping a legacy `.claude/memory/` file (by relative
// path / basename) to a runtime-neutral `.meowkit/` taxonomy class. First matching
// rule wins; anything unrecognized falls through to the lossless `legacy` catch-all
// (`memory/legacy/<relPath>`) so no file is ever silently dropped. Content-based
// validation (curated JSON schema) happens in the inventory step, not here.
import { posix } from "node:path";
import { CURATED_STORES, type StoreSpec } from "../../memory/schemas.js";
import type { Classification, TargetClass } from "./preflight-types.js";

const CURATED_JSON = new Map<string, StoreSpec>(CURATED_STORES.map((s) => [s.file, s]));

// Curated human-readable stores/notes that belong with `memory/` (NOT logs).
const CURATED_MEMORY_FILES = new Set([
	"fixes.md",
	"review-patterns.md",
	"architecture-decisions.md",
	"security-notes.md",
	"decisions.md",
	"quick-notes.md",
	"lessons.md",
	"lessons-archive.md",
	"patterns.json", // deprecated stub — preserved under memory/
]);

function base(relPath: string): string {
	return posix.basename(relPath.split("\\").join("/"));
}

function isLog(name: string): boolean {
	// cost/trace/skill-usage/review/eval logs + any `*-log.(md|json|jsonl)`.
	return (
		name === "cost-log.json" ||
		name === "trace-log.jsonl" ||
		name === "security-log.md" ||
		/-log\.(md|json|jsonl)$/.test(name) ||
		/^(skill-usage|eval|review-log)/.test(name)
	);
}

function isCache(name: string): boolean {
	return /\.(db|sqlite|sqlite3)$/.test(name);
}

function isStateMarker(name: string): boolean {
	// Session markers, feature flags, model metadata, preferences.
	return name === "last-model-id.txt" || /\.flag$/.test(name) || /^session|preferences|model-id/.test(name);
}

function target(cls: TargetClass, relPath: string): string {
	const rel = relPath.split("\\").join("/");
	switch (cls) {
		case "memory":
			return posix.join("memory", rel);
		case "legacy":
			return posix.join("memory", "legacy", rel);
		case "telemetry":
		case "state":
		case "cache":
			return posix.join(cls, base(rel));
		case "retain":
			return "";
	}
}

/** Classify one legacy memory file. `relPath` is relative to `.claude/memory/`,
 *  using either separator; the result's targetRelPath is always POSIX-style. */
export function classifyMemoryFile(relPath: string): Classification {
	const name = base(relPath);
	const rel = relPath.split("\\").join("/");

	// Tracked directory marker — stays in place, never migrated.
	if (name === ".gitkeep") return { targetClass: "retain", targetRelPath: "" };

	// Curated JSON stores (schema-validated later).
	const curated = CURATED_JSON.get(name);
	if (curated && !rel.includes("/")) {
		return { targetClass: "memory", targetRelPath: target("memory", rel), curatedStore: curated };
	}

	// Explicit curated human stores/notes.
	if (CURATED_MEMORY_FILES.has(name) && !rel.includes("/")) {
		return { targetClass: "memory", targetRelPath: target("memory", rel) };
	}

	// Generated views live under memory/views/.
	if (rel.startsWith("views/")) return { targetClass: "memory", targetRelPath: target("memory", rel) };

	if (isLog(name)) return { targetClass: "telemetry", targetRelPath: target("telemetry", rel) };
	if (isCache(name)) return { targetClass: "cache", targetRelPath: target("cache", rel) };
	if (isStateMarker(name)) return { targetClass: "state", targetRelPath: target("state", rel) };

	// Unknown regular file — preserved losslessly under memory/legacy/.
	return { targetClass: "legacy", targetRelPath: target("legacy", rel) };
}
