// The registered lifecycle hooks, derived from `.claude/settings.json`.
//
// The hand-written hooks page omitted several registered hooks entirely, which is the failure
// mode a generated inventory removes: settings.json is the registration, so anything registered
// appears here whether or not anyone remembered to document it.
//
// What gets published is a deliberate subset (user decision): lifecycle event, purpose, and
// whether the hook can block. Script paths, timeouts, and matcher chains stay in source with a
// link. Publishing those turns an inventory into an enforcement map — a reader learns which
// script to disable to get past a gate, which is recon detail rather than documentation. The
// repo is public, so this is a matter of not making it convenient rather than of secrecy.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface HookEntry {
	event: string;
	purpose: string;
	/** True when the hook can veto the action rather than only observing it. */
	blocking: boolean;
}

export interface HooksInventory {
	entries: HookEntry[];
	/** Events registered with no hooks, kept so the page shows the full lifecycle surface. */
	emptyEvents: string[];
}

interface SettingsHook {
	command?: string;
	statusMessage?: string;
}

/** `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/gate-enforcement.sh"` → `gate-enforcement.sh`. */
function scriptName(command: string): string | null {
	const match = /\.claude\/hooks\/([A-Za-z0-9._-]+)/.exec(command);
	return match ? match[1] : null;
}

/**
 * Whether a hook can veto rather than only observe.
 *
 * Read from the script, not assumed from the event. Claude Code treats exit code 2 as the block
 * signal, and the JSON forms are the structured equivalent — a hook using any of them can stop
 * the action. Guessing from the event name would have called `pre-completion-check.sh` advisory
 * because it runs on Stop, when it is one of the gates that actually blocks.
 */
function isBlocking(hooksDir: string, command: string): boolean {
	const name = scriptName(command);
	if (!name) return false;
	const abs = join(hooksDir, name);
	if (!existsSync(abs)) return false;
	const body = readFileSync(abs, "utf-8");
	return (
		/\bexit 2\b/.test(body) || /"decision"\s*:\s*"block"/.test(body) || /"permissionDecision"\s*:\s*"deny"/.test(body)
	);
}

/** Turn `ensure-skills-venv.sh` into a readable phrase when no statusMessage is declared. */
function purposeFrom(hook: SettingsHook): string {
	if (hook.statusMessage) return hook.statusMessage.replace(/\.{3}$/, "").trim();
	const name = hook.command ? scriptName(hook.command) : null;
	if (!name) return "Unnamed hook";
	return name
		.replace(/\.(sh|cjs|js|mjs|py)$/, "")
		.split(/[-_]/)
		.join(" ")
		.replace(/^./, (c) => c.toUpperCase());
}

export function buildHooksInventory(claudeDir: string): HooksInventory {
	const settingsPath = join(claudeDir, "settings.json");
	if (!existsSync(settingsPath)) return { entries: [], emptyEvents: [] };

	const settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as {
		hooks?: Record<string, { hooks?: SettingsHook[] }[]>;
	};
	const hooksDir = join(claudeDir, "hooks");

	const entries: HookEntry[] = [];
	const emptyEvents: string[] = [];

	for (const [event, matchers] of Object.entries(settings.hooks ?? {})) {
		const flat = (matchers ?? []).flatMap((m) => m.hooks ?? []);
		if (flat.length === 0) {
			emptyEvents.push(event);
			continue;
		}
		for (const hook of flat) {
			entries.push({
				event,
				purpose: purposeFrom(hook),
				blocking: hook.command ? isBlocking(hooksDir, hook.command) : false,
			});
		}
	}

	// One row per distinct published fact. A script registered under several matchers is several
	// registrations but one thing a reader needs to know, and since matcher chains are the detail
	// deliberately withheld, repeating the row would look like a bug rather than a nuance.
	const seen = new Set<string>();
	const deduped = entries.filter((e) => {
		const key = `${e.event}\u0000${e.purpose}\u0000${e.blocking}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	entries.length = 0;
	entries.push(...deduped);

	// Grouped by event, then by purpose, so the rendered table is stable across runs.
	entries.sort((a, b) => (a.event === b.event ? a.purpose.localeCompare(b.purpose) : a.event.localeCompare(b.event)));
	emptyEvents.sort();
	return { entries, emptyEvents };
}
