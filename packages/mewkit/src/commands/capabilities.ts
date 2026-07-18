// `mewkit capabilities list|explain` — read-only inspection of the model-agnostic
// capability manifest. The manifest is on-disk CLI data; it is NEVER injected into a
// model session and does not constitute agent discovery (that is Phase 3's projection).
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { buildCapabilities } from "../core/build-capabilities.js";
import { validateCapabilities } from "../core/validate-capabilities.js";
import { resolveWithHost } from "../core/resolve-capabilities.js";
import { renderCapabilityView } from "../core/generate-capability-view.js";
import { renderBootstrap, BOOTSTRAP_FILENAME, type BootstrapProvider } from "../core/bootstrap.js";
import { PROVIDER_PROJECTIONS, isProjectedProvider } from "../core/provider-projection.js";
import { findCapabilitySource } from "../core/capability-snapshot.js";
import type { AvailabilityProbes } from "../core/availability.js";
import { commandExists } from "./setup.js";
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
	write?: boolean;
}

export async function capabilities(args: CapabilitiesOptions = {}): Promise<void> {
	const sub = args.subcommand ?? "list";

	// `projections` reports how the capability surface reaches each provider — static.
	if (sub === "projections") {
		projections(args.json ?? false);
		return;
	}

	// `bootstrap` is a static trusted constant — no `.claude/` scan required.
	if (sub === "bootstrap") {
		const provider = args.provider ?? "claude-code";
		if (!isProjectedProvider(provider)) {
			console.error(
				pc.red(
					`No bootstrap projection for provider "${provider}" (report-only). Projected: ${Object.keys(PROVIDER_PROJECTIONS).join(", ")}.`,
				),
			);
			process.exit(1);
		}
		const text = renderBootstrap(provider as BootstrapProvider);
		if (args.write) {
			// Regenerate the committed file the SessionStart hook emits. Requires .claude/.
			const dir = findClaudeDir();
			if (!dir) {
				console.error(pc.red("Could not find .claude/ directory to write the bootstrap file."));
				process.exit(1);
			}
			const dest = path.join(dir, BOOTSTRAP_FILENAME);
			fs.writeFileSync(dest, text + "\n", "utf-8");
			console.log(pc.green(`Wrote ${path.relative(process.cwd(), dest)}`));
			return;
		}
		console.log(text);
		return;
	}

	const source = findCapabilitySource();
	if (!source) {
		console.error(
			pc.red(
				"Could not find a capability source. Expected .claude/ or a Codex projection at .codex/capabilities.json. Run `npx mewkit init` or `npx mewkit migrate codex`.",
			),
		);
		process.exit(1);
	}

	const entries = source.entries;

	if (sub === "explain") {
		explain(entries, args.target, args.json ?? false);
		return;
	}
	if (sub === "resolve") {
		resolve(entries, args.intent ?? args.target, args.provider ?? null, process.cwd(), args.json ?? false);
		return;
	}
	if (sub === "view") {
		// Generated compatible portion of the trigger registry (maintainer/CI diffs it in).
		console.log(renderCapabilityView(entries));
		return;
	}
	if (sub !== "list") {
		console.error(
			pc.red(`Unknown capabilities subcommand "${sub}". Expected list|explain|resolve|view|bootstrap|projections.`),
		);
		process.exit(1);
	}

	if (args.json) {
		console.log(JSON.stringify({ schemaVersion: "1.0", entries }, null, 2));
		return;
	}

	console.log(pc.bold(pc.cyan("MeowKit Capabilities")));
	const issues = source.kind === "claude-directory" ? validateCapabilities(source.path) : [];
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
	console.log(
		`  requires:    ${entry.requirements.length ? entry.requirements.map((r) => `${r.type}:${r.id}`).join(", ") : pc.dim("(none)")}`,
	);
	console.log(`  verify:      ${entry.verification.kind}${entry.verification.id ? `:${entry.verification.id}` : ""}`);
	console.log(
		`  provenance:  ${
			Object.entries(entry.provenance)
				.map(([k, v]) => `${k}=${v}`)
				.join(", ") || pc.dim("(none)")
		}`,
	);
}

/**
 * Real host-availability probes for the CLI. External binaries via PATH; MCP/apps via
 * `.mcp.json` presence (no secrets read); files via a containment-checked existence probe
 * that returns `null` for a bare, absent id (a logical name we can't resolve to a path),
 * so it surfaces as `unknown` rather than a false `unavailable`.
 */
/** Report how the capability surface projects into each provider + the four support levels. */
function projections(json: boolean): void {
	const all = Object.values(PROVIDER_PROJECTIONS);
	if (json) {
		console.log(JSON.stringify(all, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan("Capability provider projections")));
	console.log(pc.dim("Four independent levels; `enforceable` is claimed only where a real gating hook exists.\n"));
	for (const p of all) {
		console.log(`${pc.bold(p.provider)} ${pc.dim(`(${p.status}, placement: ${p.bootstrapPlacement})`)}`);
		const l = p.levels;
		console.log(
			`  discoverable=${l.discoverable}  selectable=${l.selectable}  invocable=${l.invocable}  enforceable=${l.enforceable}`,
		);
		console.log(pc.dim(`  ${p.evidence}\n`));
	}
	console.log(pc.dim("Providers not listed are report-only — no capability behavior is claimed for them."));
}

export function hostProbes(projectRoot: string): AvailabilityProbes {
	return {
		// NOTE: PATH-only binary detection under-reports package-local CLIs (e.g. a `mewkit`
		// runnable via `npx`/workspace bin but not on global PATH reads as not-found). The
		// per-requirement evidence stays truthful ("PATH lookup: not found").
		commandExists: (cmd) => commandExists(cmd),
		containedFileExists: (id) => {
			if (!id || id === ".") return null; // not a concrete requirement path
			const abs = path.resolve(projectRoot, id);
			const escapes = (from: string, to: string): boolean => {
				const rel = path.relative(from, to);
				return rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel);
			};
			if (escapes(projectRoot, abs)) return false; // lexical escape
			if (fs.existsSync(abs)) {
				// True containment: resolve symlinks so an in-root link pointing outside the
				// tree is rejected, not followed (a lexical check alone would pass it).
				try {
					if (escapes(fs.realpathSync(projectRoot), fs.realpathSync(abs))) return false;
				} catch {
					return false;
				}
				return true;
			}
			// Absent: a path-shaped id is definitively absent; a bare logical id is undetermined
			// (→ unknown). Extensionless real-file names (Makefile, .gitignore) also read as bare
			// here — an accepted bias toward `unknown` over a false `unavailable`.
			const looksLikePath = id.includes("/") || id.includes("\\") || path.extname(id) !== "";
			return looksLikePath ? false : null;
		},
		mcpServerConfigured: (id) => {
			const mcpPath = path.join(projectRoot, ".mcp.json");
			if (!fs.existsSync(mcpPath)) return null;
			try {
				const parsed = JSON.parse(fs.readFileSync(mcpPath, "utf-8")) as {
					mcpServers?: Record<string, unknown>;
					servers?: Record<string, unknown>;
				};
				const servers = parsed.mcpServers ?? parsed.servers ?? {};
				return Object.prototype.hasOwnProperty.call(servers, id);
			} catch {
				return null;
			}
		},
	};
}

function resolve(
	entries: CapabilityEntry[],
	intent: string | undefined,
	provider: string | null,
	projectRoot: string,
	json: boolean,
): void {
	if (!intent) {
		console.error(pc.red('`capabilities resolve` requires an intent (--intent "…" or a positional phrase).'));
		process.exit(1);
	}
	const ctx = {
		provider: provider ?? "claude-code",
		checkedAt: new Date().toISOString(),
		probes: hostProbes(projectRoot),
	};
	const result = resolveWithHost(entries, intent, ctx);
	if (json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(pc.bold(pc.cyan(`Resolve: "${intent}" (host: ${ctx.provider}) — status: ${result.status}`)));
	if (result.candidates.length === 0) {
		console.log(pc.yellow("  No capability matched this intent."));
		return;
	}
	for (const c of result.candidates) {
		console.log(`  ${c.id} ${pc.dim(`(${c.kind}, score ${c.score})`)} — ${c.reason}`);
		console.log(pc.dim(`      invocable: ${c.invocable}; verify: ${c.verification.kind}`));
		for (const a of c.availability) {
			console.log(pc.dim(`      • ${a.requirementType}:${a.id} → ${a.status}`));
		}
	}
	// When the selected candidate needs task-scoped repo context, show HOW this provider acquires
	// it (Phase 5). The agent runs these host-native tools, then records via `context record`.
	const top = result.candidates[0];
	if (top?.contextRequirement) {
		const acq = result.acquisition;
		console.log(
			pc.bold(`  needs repo context (${top.contextRequirement.reason}) — acquire via ${acq.provider} [${acq.status}]:`),
		);
		console.log(
			pc.dim(
				`      read:   ${acq.read ? `${acq.read.tool} — ${acq.read.note}` : "(no read surface — host-provided paths only)"}`,
			),
		);
		console.log(
			pc.dim(
				`      search: ${acq.search ? `${acq.search.tool} — ${acq.search.note}` : "(no search surface — report-only)"}`,
			),
		);
	}
	// Self-auditing: cite the adapter + evidence behind this result's provider claims (Phase 6).
	const cite = result.adapterCitation;
	console.log(pc.dim(`  adapter: ${cite.provider} [${cite.projectionStatus}] — ${cite.projectionEvidence}`));
	console.log(
		pc.dim(`  can gate on: ${cite.gatingEvents.length ? cite.gatingEvents.join(", ") : "no events (advisory host)"}`),
	);
}
