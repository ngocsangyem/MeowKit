import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkPluginManifests, checkPluginNamespace } from "../check-plugin-manifests.js";

const tempDirs: string[] = [];
afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function scaffold(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "mk-guard-"));
	tempDirs.push(root);
	const claude = join(root, ".claude");
	await mkdir(join(claude, "agents"), { recursive: true });
	await mkdir(join(claude, "skills", "cook"), { recursive: true });
	await writeFile(join(root, "package.json"), JSON.stringify({ version: "2.12.0" }));
	await writeFile(join(claude, "agents", "developer.md"), "---\nname: developer\n---\nd");
	await writeFile(
		join(claude, "skills", "cook", "SKILL.md"),
		'---\nname: mk:cook\n---\nTask(subagent_type="developer")',
	);
	return root;
}

const status = (results: { name: string; status: string }[], name: string) =>
	results.find((r) => r.name === name)?.status;

describe("checkPluginNamespace", () => {
	it("passes a clean source tree", async () => {
		const root = await scaffold();
		const r = checkPluginNamespace(join(root, ".claude"));
		expect(status(r, "Agent names are bare")).toBe("pass");
		expect(status(r, "Skill names are mk:-scoped")).toBe("pass");
		expect(status(r, "subagent_type refs resolve")).toBe("pass");
	});

	it("FAILS when an agent name is already namespaced (double-prefix risk)", async () => {
		const root = await scaffold();
		await writeFile(join(root, ".claude", "agents", "evaluator.md"), "---\nname: mk:evaluator\n---\ne");
		expect(status(checkPluginNamespace(join(root, ".claude")), "Agent names are bare")).toBe("fail");
	});

	it("FAILS on a non-mk: skill namespace leak", async () => {
		const root = await scaffold();
		await mkdir(join(root, ".claude", "skills", "design"), { recursive: true });
		await writeFile(join(root, ".claude", "skills", "design", "SKILL.md"), "---\nname: ckm:design\n---\nx");
		expect(status(checkPluginNamespace(join(root, ".claude")), "Skill names are mk:-scoped")).toBe("fail");
	});

	it("WARNs on a subagent_type ref to an unknown agent", async () => {
		const root = await scaffold();
		await writeFile(join(root, ".claude", "skills", "cook", "extra.md"), 'Task(subagent_type="ghost")');
		expect(status(checkPluginNamespace(join(root, ".claude")), "subagent_type refs resolve")).toBe("warn");
	});
});

describe("checkPluginManifests", () => {
	it("is N/A before the plugin payload is generated", async () => {
		const root = await scaffold();
		const r = checkPluginManifests(root);
		expect(r[0].status).toBe("na");
	});

	it("FAILS on a version-misaligned generated manifest", async () => {
		const root = await scaffold();
		await mkdir(join(root, "plugin", ".claude-plugin"), { recursive: true });
		await mkdir(join(root, "plugin", ".codex-plugin"), { recursive: true });
		await mkdir(join(root, ".claude-plugin"), { recursive: true });
		await mkdir(join(root, ".agents", "plugins"), { recursive: true });
		await writeFile(
			join(root, "plugin", ".claude-plugin", "plugin.json"),
			JSON.stringify({ name: "mk", version: "9.9.9", description: "x", skills: ["./skills"] }),
		);
		await writeFile(
			join(root, "plugin", ".codex-plugin", "plugin.json"),
			JSON.stringify({
				name: "mk",
				version: "2.12.0",
				description: "x",
				skills: "./skills/",
				interface: {
					displayName: "MeowKit",
					shortDescription: "s",
					longDescription: "l",
					developerName: "d",
					category: "Productivity",
					capabilities: [],
					defaultPrompt: "p",
				},
			}),
		);
		await writeFile(
			join(root, ".claude-plugin", "marketplace.json"),
			JSON.stringify({ name: "meowkit", owner: { name: "x" }, plugins: [{ name: "mk", source: "./plugin" }] }),
		);
		await writeFile(
			join(root, ".agents", "plugins", "marketplace.json"),
			JSON.stringify({
				name: "meowkit",
				interface: { displayName: "meowkit" },
				plugins: [{ name: "mk", source: { source: "local", path: "./plugin" } }],
			}),
		);
		const r = checkPluginManifests(root);
		// Claude plugin.json version is misaligned (9.9.9 vs 2.12.0).
		expect(status(r, "Claude plugin.json")).toBe("fail");
		// Codex plugin.json is aligned.
		expect(status(r, "Codex plugin.json")).toBe("pass");
	});
});
