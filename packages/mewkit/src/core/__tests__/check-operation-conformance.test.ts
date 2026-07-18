import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	TOOL_TO_OPERATION,
	findOperationConformance,
	isBlockingGap,
	summarizeOperationConformance,
} from "../check-operation-conformance.js";
import { LOGICAL_OPERATIONS } from "../provider-operations.js";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Build a temp `.claude` with one skill whose frontmatter declares `allowed-tools`. */
async function skillTree(name: string, allowedTools: string): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "operation-conformance-"));
	tempDirs.push(root);
	const dir = join(root, "skills", name);
	await mkdir(dir, { recursive: true });
	const body = `---\nname: mk:${name}\ndescription: fixture\nallowed-tools:${allowedTools}\n---\n\n# ${name}\n`;
	await writeFile(join(dir, "SKILL.md"), body, "utf-8");
	return root;
}

describe("TOOL_TO_OPERATION", () => {
	it("maps every declared tool to a real logical operation (no drift)", () => {
		for (const operation of Object.values(TOOL_TO_OPERATION)) {
			expect(LOGICAL_OPERATIONS).toContain(operation);
		}
	});
});

describe("findOperationConformance", () => {
	it("reports nothing when a skill's operations are all supported on claude-code but flags codex", async () => {
		const root = await skillTree("uses-agent", "\n  - Agent");
		const findings = findOperationConformance(root);
		// delegate_agent is supported on claude-code + claude-plugin, unsupported on codex.
		expect(findings.filter((f) => f.provider === "claude-code")).toEqual([]);
		expect(findings.filter((f) => f.provider === "claude-plugin")).toEqual([]);
		expect(findings).toContainEqual({
			skill: "mk:uses-agent",
			operation: "delegate_agent",
			provider: "codex",
			support: "unsupported",
		});
	});

	it("classifies codex support states: ask_user local-fallback, run_shell unknown, delegate_agent unsupported", async () => {
		const root = await skillTree("full", "\n  - AskUserQuestion\n  - Bash\n  - Agent");
		const codex = findOperationConformance(root).filter((f) => f.provider === "codex");
		const byOp = new Map(codex.map((f) => [f.operation, f.support]));
		expect(byOp.get("ask_user")).toBe("local-fallback");
		expect(byOp.get("run_shell")).toBe("unknown");
		expect(byOp.get("delegate_agent")).toBe("unsupported");
	});

	it("normalizes scoped tool forms (Bash(git:*), Task(Explore))", async () => {
		const root = await skillTree("scoped", "\n  - Bash(git:*)\n  - Task(Explore)");
		const ops = new Set(findOperationConformance(root).map((f) => f.operation));
		expect(ops).toContain("run_shell"); // Bash(git:*) -> run_shell
		expect(ops).toContain("delegate_agent"); // Task(Explore) -> delegate_agent
	});

	it("accepts a comma-scalar allowed-tools value", async () => {
		const root = await skillTree("scalar", " AskUserQuestion, Bash");
		const ops = new Set(findOperationConformance(root).map((f) => f.operation));
		expect(ops).toContain("ask_user");
		expect(ops).toContain("run_shell");
	});

	it("finds nothing for a skill that declares no operation-bearing tools", async () => {
		const root = await skillTree("readonly", "\n  - Read\n  - Grep");
		expect(findOperationConformance(root)).toEqual([]);
	});
});

describe("isBlockingGap", () => {
	it("treats unsupported/unknown as blocking and local-fallback as disclosed", () => {
		expect(isBlockingGap({ skill: "s", operation: "delegate_agent", provider: "codex", support: "unsupported" })).toBe(
			true,
		);
		expect(isBlockingGap({ skill: "s", operation: "run_shell", provider: "codex", support: "unknown" })).toBe(true);
		expect(isBlockingGap({ skill: "s", operation: "ask_user", provider: "codex", support: "local-fallback" })).toBe(
			false,
		);
	});
});

describe("summarizeOperationConformance", () => {
	it("renders a deterministic per-provider count", () => {
		expect(
			summarizeOperationConformance([
				{ skill: "a", operation: "delegate_agent", provider: "codex", support: "unsupported" },
				{ skill: "b", operation: "ask_user", provider: "codex", support: "local-fallback" },
			]),
		).toBe("codex=2");
	});
});

describe("real installed tree", () => {
	it("never reports a non-supported operation on claude-code / claude-plugin (they support all four)", () => {
		const findings = findOperationConformance(join(process.cwd(), ".claude"));
		expect(findings.filter((f) => f.provider === "claude-code")).toEqual([]);
		expect(findings.filter((f) => f.provider === "claude-plugin")).toEqual([]);
	});
});
