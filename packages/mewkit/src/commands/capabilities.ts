// `mewkit capabilities list|explain` — read-only inspection of the model-agnostic
// capability manifest. The manifest is on-disk CLI data; it is NEVER injected into a
// model session and does not constitute agent discovery (that is Phase 3's projection).
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { buildCapabilities } from "../core/build-capabilities.js";
import { validateCapabilities } from "../core/validate-capabilities.js";
import { resolveCapabilities } from "../core/resolve-capabilities.js";
import { renderCapabilityView } from "../core/generate-capability-view.js";
import type { CapabilityEntry } from "../core/capability.js";

function findClaudeDir(): string | null {
	const candidate = path.join(process.cwd(), ".claude");
	return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() ? candidate : null;
}

interface CapabilitiesOptions {
	subcommand?: string;
	target?: string;
	json?: boolean;
	intent?: string;
	provider?: string;
}

export async function capabilities(args: CapabilitiesOptions = {}): Promise<void> {
	const claudeDir = findClaudeDir();
	if (!claudeDir) {
		console.error(pc.red("Could not find .claude/ directory in the current directory."));
		process.exit(1);
	}

	const entries = buildCapabilities(claudeDir);
	const sub = args.subcommand ?? "list";

	if (sub === "explain") {
		explain(entries, args.target, args.json ?? false);
		return;
	}
	if (sub === "resolve") {
		resolve(entries, args.intent ?? args.target, args.provider ?? null, args.json ?? false);
		return;
	}
	if (sub === "view") {
		// Generated compatible portion of the trigger registry (maintainer/CI diffs it in).
		console.log(renderCapabilityView(entries));
		return;
	}
	if (sub !== "list") {
		console.error(pc.red(`Unknown capabilities subcommand "${sub}". Expected list|explain|resolve|view.`));
		process.exit(1);
	}

	if (args.json) {
		console.log(JSON.stringify({ schemaVersion: "1.0", entries }, null, 2));
		return;
	}

	console.log(pc.bold(pc.cyan("MeowKit Capabilities")));
	const issues = validateCapabilities(claudeDir);
	const errors = issues.filter((i) => i.level === "error");
	const warns = issues.filter((i) => i.level === "warn");
	console.log(pc.dim(`${entries.length} capabilities — ${errors.length} error(s), ${warns.length} warning(s)\n`));

	const byKind = new Map<string, CapabilityEntry[]>();
	for (const e of entries) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
	for (const [kind, list] of [...byKind].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
		console.log(pc.bold(kind));
		for (const e of list) console.log(`  ${e.id}${e.description ? pc.dim(` — ${e.description}`) : ""}`);
		console.log();
	}

	for (const i of errors) console.log(`  [${pc.red("ERROR")}] ${i.capabilityId ?? "-"}: ${i.message}`);
	for (const i of warns) console.log(`  [${pc.yellow("WARN")}] ${i.capabilityId ?? "-"}: ${i.message}`);
	if (errors.length > 0) process.exit(1);
}

function explain(entries: CapabilityEntry[], target: string | undefined, json: boolean): void {
	if (!target) {
		console.error(pc.red("`capabilities explain` requires a capability id."));
		process.exit(1);
	}
	const entry = entries.find((e) => e.id === target);
	if (!entry) {
		console.error(pc.red(`No capability with id "${target}".`));
		process.exit(1);
	}
	if (json) {
		console.log(JSON.stringify(entry, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan(`Capability: ${entry.id}`)));
	console.log(`  kind:        ${entry.kind}`);
	console.log(`  description: ${entry.description || pc.dim("(none)")}`);
	console.log(`  source:      ${entry.sourcePath ?? pc.dim("(authored, no disk artifact)")}`);
	console.log(`  owner:       ${entry.owner || pc.dim("(unknown)")} / ${entry.installedState}`);
	console.log(`  invocation:  ${entry.invocation.kind}:${entry.invocation.id}`);
	console.log(`  intents:     ${entry.intents.length ? entry.intents.join(", ") : pc.dim("(none)")}`);
	console.log(`  requires:    ${entry.requirements.length ? entry.requirements.map((r) => `${r.type}:${r.id}`).join(", ") : pc.dim("(none)")}`);
	console.log(`  verify:      ${entry.verification.kind}${entry.verification.id ? `:${entry.verification.id}` : ""}`);
	console.log(`  provenance:  ${Object.entries(entry.provenance).map(([k, v]) => `${k}=${v}`).join(", ") || pc.dim("(none)")}`);
}

function resolve(entries: CapabilityEntry[], intent: string | undefined, provider: string | null, json: boolean): void {
	if (!intent) {
		console.error(pc.red("`capabilities resolve` requires an intent (--intent \"…\" or a positional phrase)."));
		process.exit(1);
	}
	const result = resolveCapabilities(entries, intent, provider);
	if (json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan(`Resolve: "${intent}"${provider ? ` (provider: ${provider})` : ""}`)));
	if (result.candidates.length === 0) {
		console.log(pc.yellow("  No capability matched this intent."));
		return;
	}
	if (result.ambiguous) {
		console.log(pc.yellow("  Ambiguous — candidates returned, none auto-selected:"));
	}
	for (const c of result.candidates) {
		console.log(`  ${c.id} ${pc.dim(`(${c.kind}, score ${c.score})`)} — ${c.reason}`);
		console.log(pc.dim(`      invocable: ${c.invocable}; verify: ${c.verification.kind}`));
	}
}
