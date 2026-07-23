import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import type { CheckResult } from "../../commands/validate.js";
import type { TargetProfile } from "./target-profile.js";
import { parseFrontmatter } from "../../migrate/frontmatter-parser.js";
import { scanDeniedTokens } from "../../migrate/denied-token-scan.js";
import { isSecretLikeKey } from "../../migrate/providers/codex/shell-env-policy-emitter.js";

// Post-migration quality gate for a GENERATED Codex project (Phase 6, MK-P0-07). Read-only.
// Validates the target's own artifacts — it does NOT read the source `.claude/`. A fresh,
// correct `mewkit migrate codex` output passes every check; a broken target fails the specific
// check by name.

const SECTION = "Target" as const;
function pass(name: string, detail: string): CheckResult {
	return { name, status: "pass", detail, section: SECTION };
}
function fail(name: string, detail: string): CheckResult {
	return { name, status: "fail", detail, section: SECTION };
}
function warn(name: string, detail: string): CheckResult {
	return { name, status: "warn", detail, section: SECTION };
}

/** `X_OK` bit set for owner/group/other. */
function isExecutable(file: string): boolean {
	try {
		return (fs.statSync(file).mode & 0o111) !== 0;
	} catch {
		return false;
	}
}

function listFiles(dir: string, ext: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith(ext))
		.map((f) => path.join(dir, f));
}

// 1. config.toml parses and its [agents.X] entries point at real agent files.
function checkConfig(dir: string): CheckResult[] {
	const configPath = path.join(dir, ".codex", "config.toml");
	if (!fs.existsSync(configPath)) return [fail("Codex config.toml present", `Missing: ${configPath}`)];
	let parsed: Record<string, unknown>;
	try {
		parsed = TOML.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
	} catch (e) {
		return [fail("Codex config.toml parses", `TOML parse error: ${e instanceof Error ? e.message : String(e)}`)];
	}
	const out: CheckResult[] = [pass("Codex config.toml parses", "valid TOML")];

	// Agents AUTO-LOAD from .codex/agents/*.toml (see checkAgents); config.toml needs no
	// [agents.X] wiring. But if a config DOES declare an optional [agents.X].config_file,
	// a dangling ref is still a defect, so validate any that are present.
	const agents = (parsed.agents as Record<string, { config_file?: string }> | undefined) ?? {};
	const names = Object.keys(agents);
	if (names.length > 0) {
		const dangling = names.filter((n) => {
			const cf = agents[n]?.config_file;
			return cf ? !fs.existsSync(path.join(dir, ".codex", cf)) : false;
		});
		out.push(
			dangling.length === 0
				? pass(
						"Codex config.toml agent refs",
						`${names.length} optional [agents] entr${names.length === 1 ? "y" : "ies"} resolve (auto-load needs no wiring)`,
					)
				: fail("Codex config.toml agent refs", `config_file missing for: ${dangling.join(", ")}`),
		);
	}

	// Secrets: no secret-like key may carry a value in the generated config.
	const leaked: string[] = [];
	const walk = (obj: unknown, prefix: string): void => {
		if (!obj || typeof obj !== "object") return;
		for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
			if (isSecretLikeKey(k) && typeof v === "string" && v.trim().length > 0) leaked.push(`${prefix}${k}`);
			else if (v && typeof v === "object") walk(v, `${prefix}${k}.`);
		}
	};
	walk(parsed, "");
	out.push(
		leaked.length === 0
			? pass("Codex config.toml secret-free", "no secret-like key carries a value")
			: fail("Codex config.toml secret-free", `secret-like keys with values: ${leaked.join(", ")}`),
	);
	return out;
}

// 2 + 3. hooks.json parses; referenced wrapper scripts exist + are executable; a wrapper that
// gates a permission event declares the deny contract (static — no live Codex binary needed).
function checkHooks(dir: string): CheckResult[] {
	const hooksJsonPath = path.join(dir, ".codex", "hooks.json");
	if (!fs.existsSync(hooksJsonPath))
		return [warn("Codex hooks.json present", `No hooks.json at ${hooksJsonPath} (target has no hooks)`)];
	let parsed: { hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>> };
	try {
		parsed = JSON.parse(fs.readFileSync(hooksJsonPath, "utf-8"));
	} catch (e) {
		return [fail("Codex hooks.json parses", `JSON parse error: ${e instanceof Error ? e.message : String(e)}`)];
	}
	const out: CheckResult[] = [pass("Codex hooks.json parses", "valid JSON")];

	// Every referenced wrapper file must exist + be executable.
	const commands: string[] = [];
	for (const groups of Object.values(parsed.hooks ?? {})) {
		for (const g of groups) for (const h of g.hooks ?? []) if (h.command) commands.push(h.command);
	}
	const wrapperPaths = commands
		.map((c) => c.match(/"([^"]+\.cjs)"/)?.[1] ?? c.match(/(\S+\.cjs)/)?.[1])
		.filter((p): p is string => Boolean(p))
		// Real Codex hook commands resolve the project root via `$(git rev-parse
		// --show-toplevel)` (Codex exposes no project-dir env var). The target being
		// validated IS that root, so substitute it to resolve the wrapper on disk.
		.map((p) => p.replace(/\$\(git rev-parse --show-toplevel\)/g, dir));
	const missing = wrapperPaths.filter((p) => !fs.existsSync(p));
	const notExec = wrapperPaths.filter((p) => fs.existsSync(p) && !isExecutable(p));
	if (wrapperPaths.length === 0) {
		out.push(warn("Codex hook wrappers", "hooks.json references no wrapper scripts"));
	} else if (missing.length > 0) {
		out.push(fail("Codex hook wrappers exist", `missing: ${missing.map((p) => path.basename(p)).join(", ")}`));
	} else if (notExec.length > 0) {
		out.push(
			fail("Codex hook wrappers executable", `not executable: ${notExec.map((p) => path.basename(p)).join(", ")}`),
		);
	} else {
		out.push(pass("Codex hook wrappers exist + executable", `${wrapperPaths.length} wrapper script(s)`));
	}

	// Deny contract: at least one wrapper must actually gate a permission event — i.e. its
	// embedded `SCRUB_RULES` data (the migrator serializes `const SCRUB_RULES = <json>;`) declares
	// some event whose `allowedPermissionValues` contains "deny". We inspect the DATA, not the
	// wrapper's boilerplate: every wrapper — gating or not — carries an `eventSupportsDeny()`
	// helper that mentions `allowedPermissionValues`/"deny", so grepping the source text would
	// always match and the check would be a tautology. Parsing SCRUB_RULES makes the WARN reachable
	// for a target where no gating hook was migrated.
	const denyCapable = wrapperPaths.filter((p) => {
		try {
			const body = fs.readFileSync(p, "utf-8");
			const m = body.match(/^\s*const SCRUB_RULES\s*=\s*(.+);\s*$/m);
			if (!m) return false;
			const rules = JSON.parse(m[1]) as Record<string, { allowedPermissionValues?: string[] | null }>;
			return Object.values(rules).some(
				(r) => Array.isArray(r?.allowedPermissionValues) && r.allowedPermissionValues.includes("deny"),
			);
		} catch {
			return false;
		}
	});
	if (wrapperPaths.length > 0) {
		out.push(
			denyCapable.length > 0
				? pass(
						"Codex hook deny contract",
						`${denyCapable.length} wrapper(s) carry the PreToolUse/PermissionRequest deny scrub rule`,
					)
				: warn(
						"Codex hook deny contract",
						"no wrapper declares an allowedPermissionValues deny rule (no gating hook migrated?)",
					),
		);
	}
	return out;
}

// 4. Agent TOML files parse and carry the config the config.toml refs expect.
function checkAgents(dir: string): CheckResult[] {
	const agentsDir = path.join(dir, ".codex", "agents");
	const files = listFiles(agentsDir, ".toml");
	if (files.length === 0) return []; // a target with no agents is valid
	const broken: string[] = [];
	const nameless: string[] = [];
	// Codex identifies a custom agent by its `name` field (the filename is only a
	// convention), and it AUTO-LOADS every .codex/agents/*.toml — there is no
	// config.toml wiring. So `name` must be present and unique across the tree, or the
	// agent selector becomes ambiguous.
	const nameToFiles = new Map<string, string[]>();
	for (const f of files) {
		let parsed: Record<string, unknown>;
		try {
			parsed = TOML.parse(fs.readFileSync(f, "utf-8")) as Record<string, unknown>;
		} catch {
			broken.push(path.basename(f));
			continue;
		}
		const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
		if (!name) {
			nameless.push(path.basename(f));
			continue;
		}
		nameToFiles.set(name, [...(nameToFiles.get(name) ?? []), path.basename(f)]);
	}

	const out: CheckResult[] = [
		broken.length === 0
			? pass("Codex agent TOMLs parse", `${files.length} agent file(s) parse`)
			: fail("Codex agent TOMLs parse", `parse errors in: ${broken.join(", ")}`),
	];
	out.push(
		nameless.length === 0
			? pass("Codex agent name field", "every agent declares a name (auto-load identity)")
			: fail("Codex agent name field", `missing name field: ${nameless.join(", ")}`),
	);
	const dupes = [...nameToFiles.entries()].filter(([, fileList]) => fileList.length > 1);
	out.push(
		dupes.length === 0
			? pass(
					"Codex agent name uniqueness",
					`${nameToFiles.size} unique auto-loaded agent name(s); no config.toml wiring needed`,
				)
			: fail(
					"Codex agent name uniqueness",
					`duplicate agent name(s): ${dupes.map(([n, fl]) => `"${n}" in ${fl.join(", ")}`).join("; ")}`,
				),
	);
	return out;
}

// 5 + 6. Installed skills: frontmatter parses, runtime is provider-supported (portable), and the
// body carries no denied tokens (dangling /mk:, .claude/, AskUserQuestion, subagent, …).
function checkSkills(dir: string): CheckResult[] {
	const skillsDir = path.join(dir, ".agents", "skills");
	if (!fs.existsSync(skillsDir)) return [];
	const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
	// Path-class denied tokens (a `.claude/` / CLAUDE.md ref) can be a genuinely out-of-set reference
	// the migration deliberately PRESERVES verbatim rather than fabricate a Codex path — those are a
	// WARN (surfaced, not fatal). Tool/invocation tokens (/mk:, AskUserQuestion, subagent, …) have no
	// Codex primitive and no preserve case → FAIL.
	const PATH_CLASS = new Set([".claude path", "CLAUDE.md reference"]);
	const badFm: string[] = [];
	const badRuntime: string[] = [];
	const toolLeaks: string[] = [];
	const pathLeaks: string[] = [];
	for (const d of skillDirs) {
		const md = path.join(skillsDir, d.name, "SKILL.md");
		if (!fs.existsSync(md)) {
			badFm.push(`${d.name} (no SKILL.md)`);
			continue;
		}
		const content = fs.readFileSync(md, "utf-8");
		const fm = parseFrontmatter(content);
		// parseFrontmatter never throws; an unparseable/absent block yields empty frontmatter.
		// A valid SKILL.md always declares `name`, so its absence signals a broken/missing block.
		if (!fm.frontmatter || fm.frontmatter.name === undefined) {
			badFm.push(d.name);
			continue;
		}
		// Codex installs only portable/adapted skills — a claude-code runtime should never reach here.
		const runtime = (fm.frontmatter as Record<string, unknown>).runtime;
		if (runtime === "claude-code") badRuntime.push(d.name);
		const hits = scanDeniedTokens(content);
		const tool = hits.filter((h) => !PATH_CLASS.has(h.label));
		const paths = hits.filter((h) => PATH_CLASS.has(h.label));
		if (tool.length > 0) toolLeaks.push(`${d.name} [${tool.map((h) => h.label).join(", ")}]`);
		if (paths.length > 0) pathLeaks.push(`${d.name} [${paths.map((h) => h.label).join(", ")}]`);
	}
	const out: CheckResult[] = [];
	out.push(
		badFm.length === 0
			? pass("Codex installed skills parse", `${skillDirs.length} skill(s), frontmatter parses`)
			: fail("Codex installed skills parse", `invalid/absent frontmatter: ${badFm.join(", ")}`),
	);
	out.push(
		badRuntime.length === 0
			? pass("Codex installed skills runtime-supported", "no runtime: claude-code among installed skills")
			: fail(
					"Codex installed skills runtime-supported",
					`runtime: claude-code installed (default-deny breach): ${badRuntime.join(", ")}`,
				),
	);
	out.push(
		toolLeaks.length === 0
			? pass("Codex installed skills tool-token clean", "no Claude tool/invocation tokens in installed skill bodies")
			: fail(
					"Codex installed skills tool-token clean",
					`host-bound tool tokens present: ${toolLeaks.slice(0, 5).join("; ")}${toolLeaks.length > 5 ? ` (+${toolLeaks.length - 5} more)` : ""}`,
				),
	);
	if (pathLeaks.length > 0) {
		out.push(
			warn(
				"Codex installed skills path refs",
				`preserved out-of-set path ref(s) — verify they resolve on Codex: ${pathLeaks.slice(0, 5).join("; ")}${pathLeaks.length > 5 ? ` (+${pathLeaks.length - 5} more)` : ""}`,
			),
		);
	}
	return out;
}

// 7. Reject legacy / disallowed Codex surfaces. MeowKit never writes native Codex
// memory (`.codex/memory` — memory lives in the runtime-neutral `.meowkit/` store,
// and native memories stay opt-in/user-local), and it represents deprecated custom
// prompts as Agent Skills rather than emitting a `.codex/prompts` surface. A generated
// target that contains either is a defect, not a valid output.
function checkLegacySurfaces(dir: string): CheckResult[] {
	const out: CheckResult[] = [];
	const memoryDir = path.join(dir, ".codex", "memory");
	out.push(
		fs.existsSync(memoryDir)
			? fail("Codex no native memory surface", "`.codex/memory` present — MeowKit must never write native Codex memory")
			: pass("Codex no native memory surface", "no `.codex/memory` (memory stays in `.meowkit/`)"),
	);
	const promptsDir = path.join(dir, ".codex", "prompts");
	out.push(
		fs.existsSync(promptsDir)
			? fail("Codex no legacy prompts surface", "`.codex/prompts` present — deprecated custom prompts must be Agent Skills")
			: pass("Codex no legacy prompts surface", "no deprecated `.codex/prompts` surface"),
	);
	return out;
}

export const codexTargetProfile: TargetProfile = {
	name: "codex",
	detect(dir: string): boolean {
		return fs.existsSync(path.join(dir, ".codex")) || fs.existsSync(path.join(dir, ".agents", "skills"));
	},
	async check(dir: string): Promise<CheckResult[]> {
		const results: CheckResult[] = [];
		results.push(
			fs.existsSync(path.join(dir, "AGENTS.md"))
				? pass("Codex AGENTS.md present", "instruction surface exists")
				: fail("Codex AGENTS.md present", `Missing: ${path.join(dir, "AGENTS.md")}`),
		);
		results.push(...checkConfig(dir));
		results.push(...checkHooks(dir));
		results.push(...checkAgents(dir));
		results.push(...checkSkills(dir));
		results.push(...checkLegacySurfaces(dir));
		return results;
	},
};
