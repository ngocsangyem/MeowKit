// No kit instruction may tell a session to CREATE or WRITE a retired state root.
//
// Kit prose is executed verbatim by an agent, so a prose instruction is a write
// path even though no hook computes it. A path rewrite that updated a redirect and
// left its `mkdir` behind broke `--tdd` on a fresh install and recreated the
// project-root pollution the state move removed, and every committed check at the
// time looked at hook code rather than at the prose that drives it. The detector is
// kept pure and carries its own positive control, so the assertion cannot pass by
// scanning nothing.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { REPO, shipSetView } from "./helpers/ship-set-view.js";

/** Retired roots: still READ so a pre-move install keeps working, never written. */
const RETIRED_ROOTS = ["session-state", ".claude/cache/", ".claude/hooks/.logs"];

const ROOTS_ALT = RETIRED_ROOTS.map((root) => root.replace(/[.\\]/g, "\\$&")).join("|");

/**
 * The shell shapes that create or write a path. A redirect must have something
 * before it on the line, so a Markdown blockquote marker is not read as one.
 */
const WRITE_SHAPES = [
	`(?:mkdir|touch|tee)(?:\\s+-\\S+)*\\s+\\S*(?:${ROOTS_ALT})`,
	`\\S\\s*>>?\\s*\\S*(?:${ROOTS_ALT})`,
];

const WRITE_INSTRUCTION = new RegExp(WRITE_SHAPES.join("|"));

/** Every `line:text` in `body` that instructs a write into a retired root. */
function writeInstructions(body: string): string[] {
	return body
		.split("\n")
		.map((line, index) => ({ line, at: index + 1 }))
		.filter(({ line }) => WRITE_INSTRUCTION.test(line))
		.map(({ line, at }) => `${at}: ${line.trim()}`);
}

const TEXT = /\.(md|mdx|txt|ya?ml|toml|json|cjs|mjs|js|ts|sh|py)$/;

describe("retired state roots are never a write target in kit instructions", () => {
	const { tracked, shipped } = shipSetView();

	it("detects the shapes that create or write a path, and only those", () => {
		// Positive controls — each was a live defect or is one rewrite away.
		expect(writeInstructions("mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode")).toHaveLength(1);
		expect(writeInstructions("> mkdir -p .claude/session-state && echo on > .meowkit/state/tdd-mode")).toHaveLength(1);
		expect(writeInstructions("echo on > session-state/tdd-mode")).toHaveLength(1);
		expect(writeInstructions("touch .claude/hooks/.logs/run.log")).toHaveLength(1);
		expect(writeInstructions("curl -s url | tee .claude/cache/web-fetches/index.jsonl")).toHaveLength(1);
		// Negative controls — reading, naming and advising are all still allowed.
		expect(writeInstructions("const LEGACY = ['session-state', '.claude/session-state'];")).toEqual([]);
		expect(writeInstructions('Fix: set session-state/active-plan.json {"path": "…"}.')).toEqual([]);
		expect(writeInstructions("- Progress tracked in `session-state/build-progress.json`")).toEqual([]);
		expect(writeInstructions("mkdir -p .meowkit/state && echo on > .meowkit/state/tdd-mode")).toEqual([]);
	});

	it("finds no such instruction in the published kit, or anywhere under .claude/", () => {
		// The shipped set is the claim; the wider `.claude/` list catches the
		// maintainer-only copies of the same instruction, which drift together.
		const files = [...new Set([...shipped, ...tracked.filter((path) => path.startsWith(".claude/"))])].filter((path) =>
			TEXT.test(path),
		);
		expect(files.length).toBeGreaterThan(900);
		const violations: string[] = [];
		for (const rel of files) {
			for (const hit of writeInstructions(readFileSync(join(REPO, rel), "utf8"))) {
				violations.push(`${rel}:${hit}`);
			}
		}
		expect(violations).toEqual([]);
	});
});
