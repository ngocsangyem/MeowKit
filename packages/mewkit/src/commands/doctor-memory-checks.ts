import fs from "node:fs";
import path from "node:path";
import { validateMemory } from "../memory/validate.js";
import type { DiagResult } from "./doctor-checks.js";

// Memory-health diagnostics surfaced under `mewkit doctor --state`. Kept in a
// separate module because doctor-checks.ts is already over the 200-line guard.
// Non-blocking by design (CP-4): issues are WARN, never FAIL — existing v2.0.0
// data must never make doctor exit non-zero.
export function checkMemoryHealth(root: string | null): DiagResult[] {
	if (!root) {
		return [{ status: "warn", name: "Memory schema", detail: "Project root not found; skipped memory-schema checks." }];
	}
	const memoryDir = path.join(root, ".claude", "memory");
	if (!fs.existsSync(memoryDir)) {
		return [{ status: "warn", name: "Memory schema", detail: ".claude/memory/ not found." }];
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
	];
}
