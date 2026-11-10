// The portability check that keeps `.claude/skills` projectable to other runtimes, and the
// rewrite that moves a skill's references to its own files off `.claude/`.
//
// Each violation kind gets a fixture kit that carries exactly that defect, so a check that
// stopped biting would fail here rather than pass the real tree for the wrong reason.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

// The scripts the release gate and CI run, not copies of their rules.
import { checkSkillsPortable } from "../../../../../scripts/check-skills-portable.cjs";
import { ANCHOR, rewriteOwnSkillPaths, rewriteText } from "../../../../../scripts/rewrite-own-skill-paths.cjs";

const roots: string[] = [];
afterAll(() => {
	for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const CLEAN_SKILL = [
	"---",
	"name: mk:demo",
	"description: .claude/skills/demo/ in frontmatter is not scanned",
	"---",
	"Read `references/guide.md`, then run:",
	"```bash",
	"bash ${CLAUDE_SKILL_DIR}/scripts/run.sh",
	"```",
	"Follow `.claude/rules/safety.md` and hand off to `.claude/skills/other/SKILL.md`.",
	"Logs go to `.claude/logs/workflows/`. Use the `Read` tool.",
	"",
].join("\n");

/** A kit with one skill; `files` overrides or adds repo-relative files. */
function kit(files: Record<string, string> = {}, exclude: string[] = []): string {
	const root = mkdtempSync(join(tmpdir(), "mewkit-portable-"));
	roots.push(root);
	const all: Record<string, string> = {
		".meowkit/pack-manifest.json": JSON.stringify({ base: { exclude } }),
		".claude/kit-capabilities.json": JSON.stringify({
			tools: { Read: { codex: "read the file", cursor: "Read files" } },
		}),
		".claude/rules/safety.md": "rule\n",
		".claude/skills/other/SKILL.md": "---\nname: mk:other\n---\nbody\n",
		".claude/skills/demo/references/guide.md": "guide\n",
		".claude/skills/demo/scripts/run.sh": "echo ok\n",
		".claude/skills/demo/SKILL.md": CLEAN_SKILL,
		...files,
	};
	for (const [rel, body] of Object.entries(all)) {
		mkdirSync(dirname(join(root, rel)), { recursive: true });
		writeFileSync(join(root, rel), body);
	}
	return root;
}

const kinds = (root: string, options = {}) => checkSkillsPortable(root, options).violations.map((v) => v.kind);
const withLine = (line: string) => ({ ".claude/skills/demo/SKILL.md": `${CLEAN_SKILL}${line}\n` });

describe("checkSkillsPortable", () => {
	it("passes a skill that reaches its files relatively and every other surface by class", () => {
		expect(kinds(kit())).toEqual([]);
	});

	it("reports a skill naming its own directory", () => {
		expect(kinds(kit(withLine("See `.claude/skills/demo/references/guide.md`.")))).toEqual(["own-path"]);
	});

	it("reports an own path spelled from the project root", () => {
		for (const prefix of ["./", "${CLAUDE_PROJECT_DIR}/", "$CLAUDE_PROJECT_DIR/"]) {
			expect(kinds(kit(withLine(`Run \`bash ${prefix}.claude/skills/demo/scripts/run.sh\`.`))), prefix).toEqual([
				"own-path",
			]);
		}
	});

	it("still skips a home-directory kit path", () => {
		expect(kinds(kit(withLine("Global copy: `~/.claude/skills/demo/x.md` and `$HOME/.claude/rules/y.md`.")))).toEqual(
			[],
		);
	});

	it("reports a .claude surface outside the declared classes", () => {
		expect(kinds(kit(withLine("Edit `.claude/mystery/thing.json`.")))).toEqual(["unknown-class"]);
	});

	it("reports skill-relative, variable and kit paths that do not exist", () => {
		const root = kit(
			withLine(
				"Read `references/absent.md`, run `${CLAUDE_SKILL_DIR}/scripts/absent.sh`, see `.claude/rules/absent.md`.",
			),
		);
		expect(kinds(root)).toEqual(["missing", "missing", "missing"]);
	});

	it("reports ${CLAUDE_SKILL_DIR} outside SKILL.md, where Claude Code leaves it literal", () => {
		const root = kit({ ".claude/skills/demo/references/guide.md": "Run `${CLAUDE_SKILL_DIR}/scripts/run.sh`.\n" });
		expect(kinds(root)).toEqual(["skill-dir-var"]);
	});

	it("accepts a reference file that runs a script relative to the skill root under an anchored SKILL.md", () => {
		const root = kit({ ".claude/skills/demo/references/guide.md": "```bash\nbash scripts/run.sh\n```\n" });
		expect(kinds(root)).toEqual([]);
	});

	it("reports a relative script run from another file when SKILL.md never names the variable", () => {
		const root = kit({
			".claude/skills/demo/SKILL.md": "---\nname: mk:demo\n---\nRead `references/guide.md`.\n",
			".claude/skills/demo/references/guide.md": "```bash\nbash scripts/run.sh\n```\n",
		});
		expect(kinds(root)).toEqual(["no-anchor"]);
	});

	it("reports a relative script run that does not exist", () => {
		const root = kit({ ".claude/skills/demo/references/guide.md": "node scripts/absent.cjs --json\n" });
		expect(kinds(root)).toEqual(["missing"]);
	});

	it("reports a target that exists but is excluded from the ship set", () => {
		expect(kinds(kit({}, [".claude/skills/demo/references/*"]))).toEqual(["missing"]);
	});

	it("reports a Claude Code tool name missing from the capability table", () => {
		expect(kinds(kit(withLine("Ask with `AskUserQuestion`.")))).toEqual(["unlisted-tool"]);
	});

	it("skips lines marked portable-ignore", () => {
		expect(kinds(kit(withLine("Other project: `.claude/skills/demo/x.md` <!-- portable-ignore -->")))).toEqual([]);
	});

	it("tolerates a baselined missing reference by file and target", () => {
		const root = kit(withLine("Read `references/absent.md`."));
		const baselineFile = join(root, "baseline.json");
		writeFileSync(
			baselineFile,
			JSON.stringify({
				missing: [{ file: ".claude/skills/demo/SKILL.md", target: ".claude/skills/demo/references/absent.md" }],
			}),
		);
		expect(kinds(root, { baselineFile })).toEqual([]);
	});
});

describe("rewriteText", () => {
	it("turns a shell command's own path into ${CLAUDE_SKILL_DIR}", () => {
		expect(rewriteText("Run `node .claude/skills/demo/scripts/a.cjs --json`.", "demo")).toBe(
			"Run `node ${CLAUDE_SKILL_DIR}/scripts/a.cjs --json`.",
		);
	});

	it("uses ${CLAUDE_SKILL_DIR} for every own path inside a fenced block", () => {
		expect(rewriteText("```bash\n.claude/skills/demo/scripts/a.sh | tee out\n```", "demo")).toBe(
			"```bash\n${CLAUDE_SKILL_DIR}/scripts/a.sh | tee out\n```",
		);
	});

	it("makes a document reference relative to the skill root", () => {
		expect(rewriteText("See [guide](.claude/skills/demo/references/guide.md).", "demo")).toBe(
			"See [guide](references/guide.md).",
		);
	});

	it("absorbs a project-dir prefix", () => {
		expect(rewriteText('bash "${CLAUDE_PROJECT_DIR}/.claude/skills/demo/scripts/a.sh"', "demo")).toBe(
			'bash "${CLAUDE_SKILL_DIR}/scripts/a.sh"',
		);
	});

	it("leaves frontmatter, other skills and portable-ignore lines alone, and is idempotent", () => {
		const text = [
			"---",
			"args: [.claude/skills/demo/bin/x.cjs]",
			"---",
			"Use `.claude/skills/other/SKILL.md`.",
			"Example `.claude/skills/demo/x` portable-ignore",
		].join("\n");
		expect(rewriteText(text, "demo")).toBe(text);
		const once = rewriteText("node .claude/skills/demo/a.cjs and `.claude/skills/demo/b.md`", "demo");
		expect(rewriteText(once, "demo")).toBe(once);
	});

	it("makes every own path relative outside SKILL.md, including an existing ${CLAUDE_SKILL_DIR}", () => {
		const text = "```bash\nnode .claude/skills/demo/scripts/a.cjs\nnode ${CLAUDE_SKILL_DIR}/scripts/b.cjs\n```";
		expect(rewriteText(text, "demo", { skillMd: false })).toBe("```bash\nnode scripts/a.cjs\nnode scripts/b.cjs\n```");
	});
});

describe("rewriteOwnSkillPaths", () => {
	it("anchors SKILL.md when another file ran an own script, and is a no-op on the second run", () => {
		const root = kit({
			".claude/skills/demo/SKILL.md": "---\nname: mk:demo\n---\n# Demo\n\nBody.\n",
			".claude/skills/demo/references/guide.md": "Run `node ${CLAUDE_SKILL_DIR}/scripts/run.sh`.\n",
		});
		expect(rewriteOwnSkillPaths(root, { write: true }).sort()).toEqual([
			".claude/skills/demo/SKILL.md",
			".claude/skills/demo/references/guide.md",
		]);
		expect(readFileSync(join(root, ".claude/skills/demo/references/guide.md"), "utf8")).toBe(
			"Run `node scripts/run.sh`.\n",
		);
		expect(readFileSync(join(root, ".claude/skills/demo/SKILL.md"), "utf8")).toBe(
			`---\nname: mk:demo\n---\n# Demo\n\n${ANCHOR}\n\nBody.\n`,
		);
		expect(rewriteOwnSkillPaths(root, { write: false })).toEqual([]);
		expect(kinds(root)).toEqual([]);
	});
});
