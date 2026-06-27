import { mkdtemp, mkdir, rm, writeFile, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generatePluginPayload } from "../plugin-payload.js";
import {
	ClaudePluginJsonSchema,
	CodexPluginJsonSchema,
} from "../plugin-manifest.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Build a minimal `.claude` source tree mirroring the real layout's relevant bits. */
async function fixtureSource(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mk-src-"));
	tempDirs.push(root);
	const claude = join(root, ".claude");
	await mkdir(join(claude, "agents"), { recursive: true });
	await mkdir(join(claude, "skills", "cook", "references"), { recursive: true });
	await mkdir(join(claude, "skills", "mk-loop"), { recursive: true });
	await mkdir(join(claude, "session-state"), { recursive: true });
	await mkdir(join(claude, "skills", ".venv"), { recursive: true });

	await writeFile(join(claude, "agents", "developer.md"), "---\nname: developer\n---\nd");
	await writeFile(join(claude, "agents", "evaluator.md"), "---\nname: evaluator\n---\ne");
	// Index file in agents/ with no `name:` — must be pruned from the payload.
	await writeFile(join(claude, "agents", "AGENTS_INDEX.md"), "# Agents Index\nno frontmatter");
	// settings.json hook wiring — must become hooks/hooks.json with plugin roots.
	await writeFile(
		join(claude, "settings.json"),
		JSON.stringify({
			hooks: {
				PreToolUse: [
					{
						matcher: "Edit|Write",
						hooks: [
							{ type: "command", command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/gate.sh"' },
						],
					},
				],
			},
		}),
	);
	await writeFile(
		join(claude, "skills", "cook", "references", "patterns.md"),
		'Task(subagent_type="developer")\nAgent(subagent_type="Explore")\n',
	);
	await writeFile(join(claude, "skills", "mk-loop", "SKILL.md"), "---\nname: mk:loop\n---\nloop");
	await writeFile(join(claude, "metadata.json"), '{"secret":"runtime"}');
	await writeFile(join(claude, "session-state", "scratch.json"), "{}");
	await writeFile(join(claude, "skills", ".venv", "bin.txt"), "venv");
	return claude;
}

describe("generatePluginPayload", () => {
	it("transforms refs, renames mk-loop, writes manifests, drops runtime state", async () => {
		const sourceDir = await fixtureSource();
		const outDir = join(sourceDir, "..", "plugin-out");
		const result = generatePluginPayload({
			sourceDir,
			outDir,
			version: "2.12.0",
			description: "MeowKit",
			author: { name: "ngocsangyem" },
		});

		// Refs: developer rewritten, built-in Explore left bare.
		expect(result.refsRewritten).toBe(1);
		const patterns = await readFile(
			join(outDir, "skills", "cook", "references", "patterns.md"),
			"utf-8",
		);
		expect(patterns).toContain('subagent_type="mk:developer"');
		expect(patterns).toContain('subagent_type="Explore"');

		// Skill dir renamed.
		expect(result.loopDirRenamed).toBe(true);
		await expect(stat(join(outDir, "skills", "loop", "SKILL.md"))).resolves.toBeTruthy();
		await expect(stat(join(outDir, "skills", "mk-loop"))).rejects.toThrow();

		// Both manifests present and schema-valid with the release version.
		const claudeManifest = JSON.parse(
			await readFile(join(outDir, ".claude-plugin", "plugin.json"), "utf-8"),
		);
		const codexManifest = JSON.parse(
			await readFile(join(outDir, ".codex-plugin", "plugin.json"), "utf-8"),
		);
		expect(ClaudePluginJsonSchema.parse(claudeManifest).version).toBe("2.12.0");
		expect(CodexPluginJsonSchema.parse(codexManifest).version).toBe("2.12.0");
		expect(claudeManifest.name).toBe("mk");

		// Agent name frontmatter stays BARE (runtime auto-prefixes).
		const dev = await readFile(join(outDir, "agents", "developer.md"), "utf-8");
		expect(dev).toContain("name: developer");

		// Runtime state excluded.
		await expect(stat(join(outDir, "metadata.json"))).rejects.toThrow();
		await expect(stat(join(outDir, "session-state"))).rejects.toThrow();
		await expect(stat(join(outDir, "skills", ".venv"))).rejects.toThrow();

		// Index file pruned from agents/.
		expect(result.nonAgentsPruned).toBe(1);
		await expect(stat(join(outDir, "agents", "AGENTS_INDEX.md"))).rejects.toThrow();
		await expect(stat(join(outDir, "agents", "developer.md"))).resolves.toBeTruthy();

		// Plugin hooks.json generated with plugin-root command paths.
		expect(result.hooksGenerated).toBe(true);
		const hooksJson = JSON.parse(await readFile(join(outDir, "hooks", "hooks.json"), "utf-8"));
		expect(hooksJson.hooks.PreToolUse[0].hooks[0].command).toBe(
			'bash "${CLAUDE_PLUGIN_ROOT}/hooks/gate.sh"',
		);
	});

	it("is idempotent across repeated runs", async () => {
		const sourceDir = await fixtureSource();
		const outDir = join(sourceDir, "..", "plugin-out-2");
		const opts = { sourceDir, outDir, version: "1.0.0", description: "x" };
		const first = generatePluginPayload(opts);
		const second = generatePluginPayload(opts);
		expect(second.refsRewritten).toBe(first.refsRewritten);
		expect(second.loopDirRenamed).toBe(first.loopDirRenamed);
	});
});
