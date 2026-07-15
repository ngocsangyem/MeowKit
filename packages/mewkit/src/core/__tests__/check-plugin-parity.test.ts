import { mkdtemp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkPluginParity, diffPluginParity } from "../check-plugin-parity.js";
import { generatePluginPayload } from "../plugin-payload.js";
import { AUTHOR, DESCRIPTION } from "../../commands/build-plugin.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A project root with a canonical `.claude` and a freshly generated `plugin/`. */
async function projectWithGeneratedPlugin(extra: Record<string, string> = {}): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "parity-"));
	tempDirs.push(root);

	const files: Record<string, string> = {
		"package.json": JSON.stringify({ name: "meowkit", version: "9.9.9" }),
		".claude/agents/dev.md": "---\nname: developer\n---\n\nDeveloper agent.\n",
		".claude/skills/demo/SKILL.md": "---\nname: mk:demo\n---\n\nA skill.\n",
		".claude/settings.json": JSON.stringify({ hooks: {} }),
		...extra,
	};
	for (const [rel, body] of Object.entries(files)) {
		const abs = join(root, rel);
		await mkdir(join(abs, ".."), { recursive: true });
		await writeFile(abs, body, "utf-8");
	}

	generatePluginPayload({
		sourceDir: join(root, ".claude"),
		outDir: join(root, "plugin"),
		version: "9.9.9",
		description: DESCRIPTION,
		author: AUTHOR,
	});
	return root;
}

describe("plugin parity", () => {
	it("passes when plugin/ is a faithful regeneration", async () => {
		const root = await projectWithGeneratedPlugin();
		expect(diffPluginParity(root)).toEqual([]);
		expect(checkPluginParity(root)[0].status).toBe("pass");
	});

	// Mutation test #1 — the "forgot to regenerate" case. The repo shows new
	// prose while the plugin ships the old behavior, and every reviewer reads the
	// version that isn't shipping.
	it("FAILS when .claude changed but plugin/ was not regenerated", async () => {
		const root = await projectWithGeneratedPlugin();
		await writeFile(join(root, ".claude/skills/demo/SKILL.md"), "---\nname: mk:demo\n---\n\nCHANGED.\n");

		const divergences = diffPluginParity(root);
		expect(divergences).toContainEqual({ file: "skills/demo/SKILL.md", kind: "stale-in-plugin" });
		expect(checkPluginParity(root)[0].status).toBe("fail");
	});

	// Mutation test #2 — the criterion: a hand-edited plugin/ file fails CI. The
	// edit would otherwise survive only until the next build silently discards it.
	it("FAILS when plugin/ is hand-edited", async () => {
		const root = await projectWithGeneratedPlugin();
		const shipped = join(root, "plugin/skills/demo/SKILL.md");
		await writeFile(shipped, (await readFile(shipped, "utf-8")) + "\nhand-edited line\n");

		const divergences = diffPluginParity(root);
		expect(divergences).toContainEqual({ file: "skills/demo/SKILL.md", kind: "stale-in-plugin" });

		const [result] = checkPluginParity(root);
		expect(result.status).toBe("fail");
		expect(result.detail).toMatch(/Never hand-edit/);
	});

	it("FAILS when a generated file is deleted from plugin/", async () => {
		const root = await projectWithGeneratedPlugin();
		await rm(join(root, "plugin/skills/demo/SKILL.md"));
		expect(diffPluginParity(root)).toContainEqual({ file: "skills/demo/SKILL.md", kind: "missing-in-plugin" });
	});

	it("FAILS on an orphan file that regeneration does not produce", async () => {
		const root = await projectWithGeneratedPlugin();
		await writeFile(join(root, "plugin/skills/demo/orphan.md"), "not generated from anything\n");
		expect(diffPluginParity(root)).toContainEqual({ file: "skills/demo/orphan.md", kind: "extra-in-plugin" });
	});

	it("names the offending file and the remedy", async () => {
		const root = await projectWithGeneratedPlugin();
		await writeFile(join(root, ".claude/skills/demo/SKILL.md"), "---\nname: mk:demo\n---\n\nDRIFT.\n");
		const [result] = checkPluginParity(root);
		expect(result.detail).toContain("skills/demo/SKILL.md");
		expect(result.detail).toMatch(/mewkit build-plugin/);
	});

	it("warns rather than fails when there is no plugin/ tree yet", async () => {
		const root = await mkdtemp(join(tmpdir(), "parity-none-"));
		tempDirs.push(root);
		await mkdir(join(root, ".claude"), { recursive: true });
		expect(checkPluginParity(root)[0].status).toBe("warn");
	});

	it("the live repo's plugin/ matches canonical", () => {
		// Guards the plan's "canonical vs plugin drift = 0" criterion in this repo.
		expect(checkPluginParity(process.cwd())[0].status).toBe("pass");
	});
});
