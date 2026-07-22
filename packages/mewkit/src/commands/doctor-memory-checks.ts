import fs from "node:fs";
import path from "node:path";
import { validateMemory } from "../memory/validate.js";
import { detectLegacyDrift } from "../migrate/memory-preflight/legacy-drift-detector.js";
import type { DiagResult } from "./doctor-checks.js";

// Post-migration drift: once memory has migrated to `.meowkit/`, any regular file
// reappearing under `.claude/memory/` is a writer still targeting the legacy path.
// Reported (never silently re-migrated), with managed-code vs user attribution.
export function checkMemoryDrift(root: string | null): DiagResult[] {
	if (!root) return [];
	const drift = detectLegacyDrift(root);
	if (!drift.migrated || !drift.hasDrift) return [];
	const managed = drift.drifted.filter((d) => d.kind === "managed");
	const user = drift.drifted.filter((d) => d.kind === "user");
	const parts = drift.drifted.map((d) => `${d.relPath} [${d.kind}]`).join(", ");
	return [
		{
			status: "warn",
			name: "Memory drift",
			detail: `${drift.drifted.length} legacy-path write(s) after migration (${user.length} user, ${managed.length} managed): ${parts}`,
			fix: "Re-run 'mewkit migrate' to re-plan, or remove the stale legacy files; managed-code drift is fixed by upgrading the offending hook/self-update path.",
		},
	];
}

// Memory-health diagnostics surfaced under `mewkit doctor --state`. Kept in a
// separate module because doctor-checks.ts is already over the 200-line guard.
// Non-blocking by design: issues are WARN, never FAIL — existing v2.0.0
// data must never make doctor exit non-zero.
export function checkMemoryHealth(root: string | null): DiagResult[] {
	if (!root) {
		return [{ status: "warn", name: "Memory schema", detail: "Project root not found; skipped memory-schema checks." }];
	}
	const drift = checkMemoryDrift(root);
	const memoryDir = path.join(root, ".claude", "memory");
	if (!fs.existsSync(memoryDir)) {
		return [{ status: "warn", name: "Memory schema", detail: ".claude/memory/ not found." }, ...drift];
	}

	const report = validateMemory(memoryDir);
	const totalEntries = report.stores.reduce((n, s) => n + s.entryCount, 0);

	if (report.errorCount === 0 && report.warnCount === 0) {
		return [
			{
				status: "pass",
				name: "Memory schema",
				detail: `${report.stores.length} curated stores valid; ${totalEntries} entries.`,
			},
			...drift,
		];
	}

	const summaries = report.stores
		.filter((s) => s.issues.length > 0)
		.map((s) => `${s.file}: ${s.issues.map((i) => `[${i.level}] ${i.message}`).join("; ")}`);

	return [
		{
			status: "warn",
			name: "Memory schema",
			detail: `${report.errorCount} error(s), ${report.warnCount} warning(s). ${summaries.join(" | ")}`,
			fix: "Run 'mewkit memory validate' (add --strict for nonzero exit on errors); 'mewkit memory seed-from-md' to populate empty stores.",
		},
		...drift,
	];
}
