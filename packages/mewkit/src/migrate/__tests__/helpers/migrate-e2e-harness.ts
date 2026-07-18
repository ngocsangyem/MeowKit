// Shared harness for CLI-level migrate tests: isolates HOME (portable registry,
// locks) and the project directory in tmp, copies the fixture corpus in, and
// dynamically imports the orchestrator AFTER the env redirect so module-load
// path resolution picks up the isolated HOME.

import { mkdtempSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MigrateOptions } from "../../types.js";

const fixtureSource = fileURLToPath(new URL("../fixtures/codex-full-surface/.claude", import.meta.url));

export interface MigrateE2eEnv {
	projectDir: string;
	sourceDir: string;
	tempHome: string;
	run(options: Partial<MigrateOptions>): Promise<number>;
	cleanup(): Promise<void>;
}

type CodexCompatibilityMode = "strict" | "optimistic";

export async function setupMigrateE2e(
	prefix: string,
	compatibility: CodexCompatibilityMode = "strict",
): Promise<MigrateE2eEnv> {
	const originalHome = process.env.HOME;
	const originalCwd = process.cwd();
	const originalCompat = process.env.MEWKIT_CODEX_COMPAT;
	const tempHome = mkdtempSync(join(tmpdir(), `${prefix}-home-`));
	const projectDir = mkdtempSync(join(tmpdir(), `${prefix}-project-`));
	const sourceDir = join(projectDir, ".claude");
	await cp(fixtureSource, sourceDir, { recursive: true });
	await mkdir(join(tempHome, ".mewkit"), { recursive: true });

	process.env.HOME = tempHome;
	// Tests select a capability tier explicitly so a locally installed Codex CLI
	// cannot make the fixture slow or change its converted hook surface.
	process.env.MEWKIT_CODEX_COMPAT = compatibility;
	process.chdir(projectDir);
	const { runMigrate } = await import("../../migrate-orchestrator.js");

	return {
		projectDir,
		sourceDir,
		tempHome,
		async run(options: Partial<MigrateOptions>): Promise<number> {
			const logSpy = console.log;
			const errSpy = console.error;
			// Keep e2e output quiet; failures surface through exit codes and asserts.
			console.log = () => {};
			console.error = () => {};
			try {
				return await runMigrate(
					{ tool: "codex", yes: true, source: sourceDir, ...options },
					{ bundledKitDir: join(projectDir, "no-bundled-kit"), argv: [] },
				);
			} finally {
				console.log = logSpy;
				console.error = errSpy;
			}
		},
		async cleanup(): Promise<void> {
			process.chdir(originalCwd);
			process.env.HOME = originalHome;
			if (originalCompat === undefined) delete process.env.MEWKIT_CODEX_COMPAT;
			else process.env.MEWKIT_CODEX_COMPAT = originalCompat;
			await rm(tempHome, { recursive: true, force: true });
			await rm(projectDir, { recursive: true, force: true });
		},
	};
}

export async function setupKitInstallMigrateE2e(
	prefix: string,
	compatibility: CodexCompatibilityMode = "strict",
): Promise<MigrateE2eEnv> {
	const env = await setupMigrateE2e(prefix, compatibility);
	await writeFile(
		join(env.projectDir, ".mcp.json"),
		JSON.stringify({ mcpServers: { context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"] } } }),
		"utf-8",
	);
	await writeFile(
		join(env.projectDir, ".meowkit.config.json"),
		JSON.stringify({
			modelRouting: {
				providers: {
					codex: {
						tiers: {
							heavy: { model: "codex-heavy" },
							balanced: { model: "codex-balanced" },
							light: { model: "codex-light" },
						},
					},
				},
			},
		}),
		"utf-8",
	);
	await writeFile(join(env.sourceDir, ".env"), "MY_REGION=eu-west-1\nJIRA_API_TOKEN=sk-do-not-leak-phase7\n", "utf-8");
	await writeFile(
		join(env.sourceDir, "rules", "large-budget-rules.md"),
		`# Large budget rule\n\n${"Keep this migrated instruction content intact.\n".repeat(950)}`,
		"utf-8",
	);

	const hooksDir = join(env.sourceDir, "hooks");
	await mkdir(hooksDir, { recursive: true });
	const registrations = buildKitInstallHookRegistrations();
	for (const entry of registrations.flatMap((group) => group.hooks)) {
		const name = entry.command.split("/").pop() ?? entry.command;
		if (name.endsWith(".sh")) {
			await writeFile(join(hooksDir, name), "#!/bin/sh\nexit 0\n", "utf-8");
		} else {
			await writeFile(join(hooksDir, name), "process.exit(0);\n", "utf-8");
		}
	}
	await writeFile(
		join(env.sourceDir, "settings.json"),
		JSON.stringify({ hooks: groupHooksByEvent(registrations) }, null, 2),
		"utf-8",
	);
	return env;
}

interface HookRegistration {
	event: string;
	matcher?: string;
	hooks: Array<{ type: "command"; command: string }>;
}

function hook(event: string, name: string, matcher?: string): HookRegistration {
	const commandPrefix = name.endsWith(".sh") ? "$CLAUDE_PROJECT_DIR/.claude/hooks/" : "node .claude/hooks/";
	return { event, matcher, hooks: [{ type: "command", command: `${commandPrefix}${name}` }] };
}

function buildKitInstallHookRegistrations(): HookRegistration[] {
	return [
		hook("SessionStart", "session-startup.cjs", "startup"),
		hook("SessionStart", "session-resume.sh", "resume"),
		hook("UserPromptSubmit", "prompt-capture.cjs"),
		hook("UserPromptSubmit", "prompt-audit.sh"),
		hook("PreToolUse", "pretooluse-bash-a.cjs", "Bash"),
		hook("PreToolUse", "pretooluse-bash-b.sh", "Bash"),
		hook("PreToolUse", "gate-enforcement.sh", "Bash"),
		hook("PreToolUse", "privacy-block.sh", "Bash"),
		hook("PostToolUse", "posttooluse-bash-a.cjs", "Bash"),
		hook("PostToolUse", "posttooluse-bash-b.sh", "Bash"),
		hook("PermissionRequest", "permission-a.cjs", "Bash"),
		hook("PermissionRequest", "permission-b.sh", "Bash"),
		hook("PreCompact", "precompact-a.cjs"),
		hook("PreCompact", "precompact-b.sh"),
		hook("PostCompact", "postcompact-a.cjs"),
		hook("PostCompact", "postcompact-b.sh"),
		hook("SubagentStart", "subagent-start-a.cjs"),
		hook("SubagentStart", "subagent-start-b.sh"),
		hook("SubagentStop", "subagent-stop-a.cjs"),
		hook("SubagentStop", "subagent-stop-b.sh"),
		hook("Stop", "stop-a.cjs"),
		hook("Stop", "validate-docs.cjs"),
	];
}

function groupHooksByEvent(registrations: HookRegistration[]): Record<string, Array<Omit<HookRegistration, "event">>> {
	const grouped: Record<string, Array<Omit<HookRegistration, "event">>> = {};
	for (const { event, ...group } of registrations) {
		grouped[event] = [...(grouped[event] ?? []), group];
	}
	return grouped;
}
