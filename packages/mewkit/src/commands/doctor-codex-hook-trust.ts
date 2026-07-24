import fs from "node:fs";
import path from "node:path";
import type { DiagResult } from "./doctor-checks.js";

// Honest per-hook trust-state reporting for a generated Codex target. Reports ONLY what is
// locally inspectable and NEVER implies runtime observability or enforcement that Codex's
// hook model does not guarantee. State definitions:
//   configured = the hook is present in .codex/hooks.json
//   trusted    = Codex records trust per-hook-hash (confirmed via `/hooks`); that store is
//                not a documented, stable surface to read here → reported as "unverified"
//   executed   = "not-observed" — Codex exposes no documented hook-execution-log surface,
//                so doctor must not claim a hook ran
//   enforced   = "no" — command hooks are defense-in-depth and are per-hook-trust-gated;
//                the MeowKit CLI gate remains authoritative

type HooksJson = {
	hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ command?: string; commandWindows?: string }> }>>;
};

/** Per-hook trust-state lines for a codex target dir. Empty when there is no hooks.json. */
export function checkCodexHookTrust(dir: string): DiagResult[] {
	const hooksJson = path.join(dir, ".codex", "hooks.json");
	if (!fs.existsSync(hooksJson)) return [];

	let parsed: HooksJson;
	try {
		parsed = JSON.parse(fs.readFileSync(hooksJson, "utf-8"));
	} catch (e) {
		return [{ status: "fail", name: "Codex hooks.json parse", detail: `invalid JSON: ${(e as Error).message}` }];
	}

	const entries: string[] = [];
	for (const [event, groups] of Object.entries(parsed.hooks ?? {})) {
		for (const g of groups) {
			for (const h of g.hooks ?? []) {
				const cmd = h.command ?? h.commandWindows ?? "";
				const m = cmd.match(/\.codex\/hooks\/([\w.-]+)/);
				const label = m ? m[1] : "(inline)";
				const matcher = g.matcher ? ` ${g.matcher}` : "";
				entries.push(`${event}${matcher} → ${label}`);
			}
		}
	}
	if (entries.length === 0) return [];

	return entries.map((entry) => ({
		status: "pass" as const,
		name: `Codex hook: ${entry}`,
		detail:
			"configured=yes; " +
			"trusted=unverified (Codex records per-hook-hash trust via /hooks — not inspectable here); " +
			"executed=not-observed (no documented Codex execution-log surface); " +
			"enforced=no (command hooks are defense-in-depth + per-hook-trust-gated; the CLI gate is authoritative).",
	}));
}
