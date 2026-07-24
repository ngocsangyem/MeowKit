import fs from "node:fs";
import path from "node:path";
import type { DiagResult } from "./doctor-checks.js";
import { computeFileChecksum } from "../migrate/reconcile/checksum-utils.js";
import { readCursorLedger } from "../migrate/reconcile/cursor-ledger.js";
import { meowkitStatePaths } from "../state/meowkit-state-paths.js";
import { resolveCursorModuleDir } from "../migrate/modules/cursor-authored-bundle.js";
import { CURSOR_MIN_SUPPORTED_VERSION, detectCursorVersion, isCursorVersionSupported } from "../migrate/providers/cursor/capabilities.js";

// Single-file Cursor doctor (env checks join it in Phase 5). Validates the
// installed `.cursor/hooks.json`, the installed Cursor IDE version against the
// bundle's floor, and re-verifies security-critical installed entries against
// the SHIPPED bundle's checksums — never the project ledger's self-reported
// rows, which are plain committable/forgeable JSON. The kill-switch env var
// name and flag path MUST stay in sync with
// `root/.cursor/hooks/lib/cursor-hook-runtime.cjs` (kept as literals here to
// avoid loading a CJS hook asset into the compiled TS CLI).
const KILL_SWITCH_ENV = "MEWKIT_CURSOR_HOOKS_KILL_SWITCH";
const KILL_SWITCH_FLAG_RELATIVE = ".meowkit/state/cursor-hooks-kill-switch";

// Events this bundle declares security-critical — every configured entry for
// these MUST carry `failClosed: true` (per-matcher for preToolUse).
const SECURITY_CRITICAL_EVENTS = new Set(["beforeReadFile", "beforeShellExecution", "beforeMCPExecution", "preToolUse"]);
// The one deliberately fail-open preToolUse matcher (read-only tools).
const OPEN_PRE_TOOL_USE_MATCHER = "^(?:read|search|grep|glob|list|find|view)";

interface HookEntry {
	matcher?: string;
	command?: string;
	failClosed?: boolean;
}
interface HooksJson {
	version?: number;
	hooks?: Record<string, HookEntry[]>;
}

/** Validate hooks.json schema version, failClosed presence on security-critical
 *  events, and dedupe ((event, matcher) uniqueness — the AgentKit duplicate-
 *  entry anti-pattern). A parse error short-circuits the WHOLE doctor pass
 *  (returns `ok:false`) — an unreadable hooks.json makes every downstream
 *  check meaningless, so `checkCursor` reports ONLY the parse failure. */
function checkHooksJsonShape(hooksJsonPath: string): { ok: boolean; results: DiagResult[] } {
	let parsed: HooksJson;
	try {
		parsed = JSON.parse(fs.readFileSync(hooksJsonPath, "utf-8"));
	} catch (e) {
		return {
			ok: false,
			results: [{ status: "fail", name: "Cursor hooks.json parse", detail: `invalid JSON: ${(e as Error).message}` }],
		};
	}
	const results: DiagResult[] = [
		parsed.version === 1
			? { status: "pass", name: "Cursor hooks.json schema version", detail: "version: 1" }
			: { status: "fail", name: "Cursor hooks.json schema version", detail: `expected version 1, got ${String(parsed.version)}` },
	];

	const seen = new Set<string>();
	for (const [event, entries] of Object.entries(parsed.hooks ?? {})) {
		for (const entry of entries) {
			const key = `${event}::${entry.matcher ?? ""}`;
			if (seen.has(key)) {
				results.push({ status: "fail", name: `Cursor hook dedupe: ${event}`, detail: `duplicate (event, matcher) entry: ${key}` });
			}
			seen.add(key);

			if (SECURITY_CRITICAL_EVENTS.has(event)) {
				const isOpenMatcher = event === "preToolUse" && entry.matcher === OPEN_PRE_TOOL_USE_MATCHER;
				const expected = !isOpenMatcher;
				const ok = entry.failClosed === expected;
				results.push({
					status: ok ? "pass" : "fail",
					name: `Cursor hook failClosed: ${event}${entry.matcher ? ` (${entry.matcher})` : ""}`,
					detail: ok
						? `failClosed=${entry.failClosed} as expected`
						: `expected failClosed=${expected}, got ${String(entry.failClosed)}`,
				});
			}
		}
	}
	return { ok: true, results };
}

/** Feature-detect, never hard-fail: below the operational floor WARNS (the
 *  bundle installs anyway and gated surfaces degrade at runtime, mirroring the
 *  codex warn-and-degrade contract); an undetectable version is skipped
 *  silently — null never means "below minimum". */
async function checkVersionGate(): Promise<DiagResult> {
	const detected = await detectCursorVersion();
	if (!detected) {
		return { status: "pass", name: "Cursor IDE version", detail: "undetectable (cursor CLI shim not on PATH) — skipped, not treated as below minimum." };
	}
	const ok = isCursorVersionSupported(detected);
	return {
		status: ok ? "pass" : "warn",
		name: "Cursor IDE version",
		detail: ok
			? `${detected} >= floor ${CURSOR_MIN_SUPPORTED_VERSION}`
			: `${detected} is below the ${CURSOR_MIN_SUPPORTED_VERSION} floor — hook-gated surfaces may not all be present.`,
		fix: ok ? undefined : `Upgrade Cursor to >= ${CURSOR_MIN_SUPPORTED_VERSION}.`,
	};
}

/** Re-verify every installed hooks/agents ledger row by recomputing BOTH the
 *  live installed file's checksum and the checksum of what the CURRENT shipped
 *  bundle would install — bypassing the ledger's own (self-reported,
 *  forgeable) checksums entirely. Explicitly calls out when the ledger claims
 *  no drift (sourceChecksum === targetChecksum) while the live file has
 *  actually diverged from what ships today. */
async function checkBundleChecksums(dir: string, moduleDir: string): Promise<DiagResult[]> {
	const ledgerPath = meowkitStatePaths(path.join(dir, ".meowkit")).cursorLedger;
	let ledger;
	try {
		ledger = await readCursorLedger(ledgerPath);
	} catch (e) {
		return [{ status: "fail", name: "Cursor reconciliation ledger", detail: `unreadable/corrupt: ${(e as Error).message}` }];
	}
	const rows = ledger.installations.filter((r) => r.provider === "cursor" && (r.type === "hooks" || r.type === "agent"));
	if (rows.length === 0) {
		return [{ status: "pass", name: "Cursor bundle checksum re-verification", detail: "no hooks/agent rows installed yet — nothing to re-verify." }];
	}

	const results: DiagResult[] = [];
	for (const row of rows) {
		const shippedPath = path.join(moduleDir, row.sourcePath);
		if (!fs.existsSync(row.path) || !fs.existsSync(shippedPath)) {
			results.push({ status: "warn", name: `Cursor checksum: ${row.item}`, detail: `missing live (${row.path}) or shipped (${shippedPath}) file — cannot re-verify.` });
			continue;
		}
		const [liveChecksum, shippedChecksum] = await Promise.all([computeFileChecksum(row.path), computeFileChecksum(shippedPath)]);
		const diverged = liveChecksum !== shippedChecksum;
		const ledgerClaimsNoDrift = row.sourceChecksum === row.targetChecksum;
		results.push({
			status: diverged ? "fail" : "pass",
			name: `Cursor checksum: ${row.item}`,
			detail: diverged
				? `LIVE FILE DIVERGES from the shipped bundle (live=${liveChecksum.slice(0, 12)}, shipped=${shippedChecksum.slice(0, 12)})` +
					(ledgerClaimsNoDrift ? " — the ledger claims no drift; the ledger is not trusted for this check." : "")
				: "live file matches the currently shipped bundle.",
		});
	}
	return results;
}

const KILL_SWITCH_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

/** An ACTIVE kill switch means every security-critical gate is currently
 *  downgraded to warn-and-allow — that is a real degraded-security state, not a
 *  clean bill of health, so this reports `warn` (never `pass`) while active. */
function killSwitchHint(dir: string): DiagResult {
	const flagPath = path.join(dir, KILL_SWITCH_FLAG_RELATIVE);
	const envValue = (process.env[KILL_SWITCH_ENV] ?? "").trim().toLowerCase();
	const active = KILL_SWITCH_TRUE_VALUES.has(envValue) || fs.existsSync(flagPath);
	return {
		status: active ? "warn" : "pass",
		name: "Cursor hooks kill switch",
		detail: active
			? `ACTIVE — every security-critical Cursor hook (privacy/shell/MCP/tool gates) is currently downgraded ` +
				`to warn-and-allow. Unset env ${KILL_SWITCH_ENV} and/or remove ${flagPath} to restore enforcement.`
			: `Inactive. Set env ${KILL_SWITCH_ENV}=1 or create ${flagPath} to downgrade every security-critical ` +
				"Cursor hook to warn-and-allow (schema-drift escape hatch) if ever needed.",
	};
}

/** Full read-only Cursor doctor pass for a generated target directory `dir`.
 *  Empty when there is no `.cursor/hooks.json` (nothing to check). A hooks.json
 *  parse failure short-circuits to JUST that failure — every downstream check
 *  assumes a parseable hooks.json. */
export async function checkCursor(dir: string, moduleDir: string = resolveCursorModuleDir()): Promise<DiagResult[]> {
	const hooksJsonPath = path.join(dir, ".cursor", "hooks.json");
	if (!fs.existsSync(hooksJsonPath)) return [];
	const shape = checkHooksJsonShape(hooksJsonPath);
	if (!shape.ok) return shape.results;
	return [
		...shape.results,
		await checkVersionGate(),
		...(await checkBundleChecksums(dir, moduleDir)),
		killSwitchHint(dir),
	];
}
