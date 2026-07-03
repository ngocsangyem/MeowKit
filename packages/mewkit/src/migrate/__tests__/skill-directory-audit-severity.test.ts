import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditSkillDirectory } from "../skill-directory-audit.js";

async function skillDir(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "audit-sev-"));
	for (const [rel, content] of Object.entries(files)) {
		const full = join(root, rel);
		await mkdir(join(full, ".."), { recursive: true });
		await writeFile(full, content, "utf-8");
	}
	return root;
}

describe("skill directory audit — severity-aware verdicts", () => {
	it("returns no errors for claude-code target", async () => {
		const root = await skillDir({ "run.sh": "echo $CLAUDE_PROJECT_DIR\n" });
		const r = await auditSkillDirectory(root, "claude-code", "x");
		expect(r.errors).toEqual([]);
		expect(r.waivers).toEqual([]);
	});

	it("downgrades a Claude env var in reference-grade markdown to a waiver", async () => {
		const root = await skillDir({ "references/guide.md": "Use $CLAUDE_MODEL here.\n" });
		const r = await auditSkillDirectory(root, "codex", "x");
		expect(r.errors).toEqual([]);
		expect(r.waivers).toHaveLength(1);
		expect(r.waivers[0].filePath).toBe("references/guide.md");
		expect(r.waivers[0].annotation).toContain("$CLAUDE_MODEL");
	});

	it("downgrades a Claude env var in a non-state-changing script to a waiver", async () => {
		const root = await skillDir({ "scripts/read.sh": 'cat "$CLAUDE_PLUGIN_DATA/state"\n' });
		const r = await auditSkillDirectory(root, "codex", "x");
		expect(r.errors).toEqual([]);
		expect(r.waivers.some((w) => w.filePath === "scripts/read.sh")).toBe(true);
	});

	it("keeps a state-changing script FAIL-CLOSED with a Claude assumption", async () => {
		const root = await skillDir({ "scripts/wipe.sh": 'rm -rf "$CLAUDE_PROJECT_DIR/x"\n' });
		const r = await auditSkillDirectory(root, "codex", "x");
		expect(r.errors).toHaveLength(1);
		expect(r.errors[0].message).toContain("state-changing");
		expect(r.errors[0].message).toContain("high-risk");
	});

	it("keeps a credential-exporting script FAIL-CLOSED", async () => {
		const root = await skillDir({ "scripts/auth.sh": 'export SECRET_KEY="$ANTHROPIC_API_KEY"\n' });
		const r = await auditSkillDirectory(root, "codex", "x");
		expect(r.errors.length).toBeGreaterThan(0);
		expect(r.errors[0].message).toContain("state-changing");
	});

	it("downgrades a CLI assumption in SKILL.md to a waiver (docs are not runnable)", async () => {
		const root = await skillDir({ "SKILL.md": "Run `claude mcp add linear` to connect.\n" });
		const r = await auditSkillDirectory(root, "codex", "x");
		expect(r.errors).toEqual([]);
		expect(r.waivers.some((w) => w.message.includes("Claude Code command assumption"))).toBe(true);
	});
});
