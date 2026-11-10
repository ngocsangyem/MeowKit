// Error paths must name a path the code really reads, a version it really requires, and one
// next action.
//
// Two of these were measured wrong: `budget` told users to look for a cost log in a
// directory this code has never read, and the Node diagnostic named a floor four majors
// below the one the package manager enforces. Both are the same defect — a message
// describing something other than what the code does — so both are asserted against the
// code rather than against prose.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { costLogCandidate } from "../budget-cost-log.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..", "..", "..");
const CLI = path.join(REPO_ROOT, "packages", "mewkit", "dist", "index.js");

function run(args: string[], cwd: string): { status: number; output: string } {
	try {
		const stdout = execFileSync(process.execPath, [CLI, ...args], {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return { status: 0, output: stdout };
	} catch (err) {
		const e = err as { status?: number | null; stdout?: string; stderr?: string };
		return { status: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
	}
}

/** A directory with no project above it, so the cost-log walk is guaranteed to fail. */
function isolated(): string {
	return fs.mkdtempSync(path.join(tmpdir(), "mk-messages-"));
}

describe("the budget cost-log message", () => {
	it("names the path the search looked for, not a different file", () => {
		const cwd = isolated();
		const result = run(["budget"], cwd);
		expect(result.status).not.toBe(0);
		// The message is checked against the resolver, so prose cannot drift from behaviour.
		expect(result.output).toContain(costLogCandidate(fs.realpathSync(cwd)));
		expect(result.output).not.toContain(".claude/memory/cost-log.json");
	});

	it("names one next action", () => {
		const result = run(["budget"], isolated());
		expect(result.output.toLowerCase()).toContain("run a meowkit agent command");
	});
});

describe("the removed version-and-config printer", () => {
	it("is gone from the tree, so its broken output is unreachable", () => {
		const src = path.join(REPO_ROOT, "packages", "mewkit", "src");
		const offenders: string[] = [];
		const walk = (dir: string): void => {
			for (const name of fs.readdirSync(dir)) {
				if (name === "node_modules" || name === "orchviz-web") continue;
				const abs = path.join(dir, name);
				if (fs.statSync(abs).isDirectory()) {
					walk(abs);
					continue;
				}
				if (!abs.endsWith(".ts")) continue;
				if (abs === fileURLToPath(import.meta.url)) continue;
				if (/\bprintStatus\b/.test(fs.readFileSync(abs, "utf-8"))) offenders.push(path.relative(REPO_ROOT, abs));
			}
		};
		walk(src);
		expect(offenders, offenders.join(", ")).toEqual([]);
	});

	it("answers the verb as an unknown command", () => {
		const result = run(["status"], isolated());
		expect(result.status).toBe(2);
		expect(result.output).toContain("Unknown command");
		expect(result.output).not.toContain("[object Object]");
	});
});

describe("every message this surface prints", () => {
	it("carries no stack frame, internal class name or unread path", () => {
		const cwd = isolated();
		const outputs = [
			run(["budget"], cwd).output,
			run(["zzbogus"], cwd).output,
			run(["plan", "zzbogus"], cwd).output,
			run(["plan"], cwd).output,
			run(["status"], cwd).output,
		];
		for (const output of outputs) {
			expect(output).not.toMatch(/\n\s+at\s+\S+\s+\(/); // a stack frame
			expect(output).not.toMatch(/\b(?:TypeError|ReferenceError|ZodError|SyntaxError)\b/);
			expect(output).not.toContain("[object Object]");
			expect(output).not.toContain(".claude/memory/");
		}
	});
});
