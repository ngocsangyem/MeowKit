/**
 * Resolve a subagent's display name from its `.meta.json` sidecar.
 *
 * Per red-team Finding High #7, both `description` and `agentType` strings
 * are stripped of ANSI sequences before return.
 */

import * as fs from "node:fs";
import { generateSubagentFallbackName, resolveSubagentChildName } from "./constants.js";
import { stripAnsi } from "./parser/strip-ansi.js";

export interface MetaResolution {
	name: string;
	toolUseId?: string;
}

export function resolveNameFromMeta(jsonlPath: string, fallbackIndex: number): MetaResolution {
	const metaPath = jsonlPath.replace(/\.jsonl$/, ".meta.json");
	try {
		const raw = fs.readFileSync(metaPath, "utf-8");
		const meta = JSON.parse(raw) as Record<string, unknown>;
		const sanitized: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(meta)) {
			sanitized[k] = typeof v === "string" ? stripAnsi(v) : v;
		}
		const toolUseId =
			typeof sanitized.toolUseId === "string"
				? sanitized.toolUseId
				: typeof sanitized.tool_use_id === "string"
					? sanitized.tool_use_id
					: undefined;
		const name = resolveSubagentChildName(sanitized, toolUseId);
		if (name && name !== "subagent") return { name, toolUseId };
		return { name: generateSubagentFallbackName(toolUseId ?? "", fallbackIndex), toolUseId };
	} catch {
		// meta missing on older Claude Code versions
	}
	return { name: generateSubagentFallbackName("", fallbackIndex) };
}
