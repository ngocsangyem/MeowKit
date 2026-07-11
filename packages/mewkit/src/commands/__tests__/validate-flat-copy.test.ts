// Behavioral proof for req 2/7: an Aspire-shaped flat-copy consumer (a project that
// installed `.claude/` by copy, WITHOUT the source repo's authoring artifacts) must not
// receive authoring-only checks. Those sections assert against source-repo artifacts a
// consumer never has, so in flat-copy mode they would be false failures.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildDefaultChecks, type Section } from "../validate.js";

// Sections produced ONLY by authoring-coherence checks — no consumer check emits these.
const AUTHORING_ONLY_SECTIONS: ReadonlySet<Section> = new Set<Section>([
	"Workflow",
	"Ownership",
	"Substrate",
	"Packs",
	"Rules",
]);

let projectRoot: string;
let meowkitDir: string;

/** An Aspire-shaped flat-copy install: `.claude/` copied in, no CLI source tree. */
beforeEach(() => {
	projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mewkit-flatcopy-"));
	meowkitDir = path.join(projectRoot, ".claude");
	fs.mkdirSync(path.join(meowkitDir, "agents"), { recursive: true });
	fs.mkdirSync(path.join(meowkitDir, "hooks"), { recursive: true });
	fs.mkdirSync(path.join(meowkitDir, "rules"), { recursive: true });
	fs.writeFileSync(path.join(projectRoot, "CLAUDE.md"), "# consumer project\n");
	fs.writeFileSync(path.join(meowkitDir, "meowkit.config.json"), JSON.stringify({ description: "" }));
	const hook = path.join(meowkitDir, "hooks", "gate-enforcement.sh");
	fs.writeFileSync(hook, "#!/bin/bash\nexit 0\n");
	fs.chmodSync(hook, 0o755);
});
afterEach(() => fs.rmSync(projectRoot, { recursive: true, force: true }));

describe("flat-copy consumer validation", () => {
	it("produces NO authoring-only sections in flat-copy mode", async () => {
		const results = await buildDefaultChecks(meowkitDir, projectRoot, "flat-copy", false);
		const authoringResults = results.filter((r) => AUTHORING_ONLY_SECTIONS.has(r.section));
		expect(authoringResults).toEqual([]);
		// And crucially: no authoring-only FALSE failure reaches the consumer.
		expect(results.filter((r) => r.status === "fail" && AUTHORING_ONLY_SECTIONS.has(r.section))).toEqual([]);
	});

	it("DOES include authoring-only sections in authoring mode on the same tree (gate is real)", async () => {
		const results = await buildDefaultChecks(meowkitDir, projectRoot, "authoring", false);
		const authoringResults = results.filter((r) => AUTHORING_ONLY_SECTIONS.has(r.section));
		expect(authoringResults.length).toBeGreaterThan(0);
	});

	it("still runs consumer-actionable structural checks in flat-copy mode", async () => {
		const results = await buildDefaultChecks(meowkitDir, projectRoot, "flat-copy", false);
		// Structure/Hooks checks are present regardless of mode.
		expect(results.some((r) => r.section === "Structure")).toBe(true);
		expect(results.some((r) => r.section === "Hooks")).toBe(true);
	});
});
