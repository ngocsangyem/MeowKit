/**
 * Resolve a subagent's display name from its `.meta.json` sidecar.
 *
 * Per red-team Finding High #7, both `description` and `agentType` strings
 * are stripped of ANSI sequences before return.
 */

import * as fs from "node:fs";
import { generateSubagentFallbackName, resolveSubagentChildName } from "./constants.js";
import { stripAnsi } from "./parser/strip-ansi.js";

export function resolveNameFromMeta(jsonlPath: string, fallbackIndex: number): string {
	const metaPath = jsonlPath.replace(/\.jsonl$/, ".meta.json");
	try {
		const raw = fs.readFileSync(metaPath, "utf-8");
		const meta = JSON.parse(raw) as Record<string, unknown>;
		const sanitized: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(meta)) {
			sanitized[k] = typeof v === "string" ? stripAnsi(v) : v;
		}
		const name = resolveSubagentChildName(sanitized);
		if (name && name !== "subagent") return name;
	} catch {
		// meta missing on older Claude Code versions
	}
	return generateSubagentFallbackName("", fallbackIndex);
}
