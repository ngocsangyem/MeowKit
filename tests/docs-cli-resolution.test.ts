// Every command and flag the docs site shows must exist in the CLI it documents.
//
// Resolution, never execution: the pages that describe the install show install commands,
// and running those would perform real installs and real network fetches from documentation
// text. Resolving them against the catalogue catches the same class of defect — a verb that
// was removed, a flag that was renamed, a subcommand that never existed — without doing
// anything.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CLI_CATALOGUE } from "../packages/mewkit/src/cli/command-catalogue.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(REPO_ROOT, "packages", "docs", "content", "docs");

/** The pages that named a removed or moved verb before this change. */
const UPDATED_PAGES = [
	"cli/commands.mdx",
	"cli/index.mdx",
	"cli/knowledge.mdx",
	"cli/portability.mdx",
	"cli/project-setup.mdx",
	"cli/telemetry.mdx",
];


const REMOVED = ["status", "context", "explain-support", "docs-manifest", "inventory"];

/**
 * Words that follow `mewkit` in prose rather than naming a command. Each is a real
 * occurrence, listed so an exception stays visible instead of being swallowed by a pattern
 * that would also hide a genuinely removed verb:
 *   "Update mewkit to the latest version"            → `to`
 *   "mewkit tracks every installation in …"          → `tracks`
 *   "The mewkit command line, grouped by …"          → `command`
 */
const PROSE_AFTER_MEWKIT = new Set(["to", "tracks", "command"]);

const COMMANDS = new Map(CLI_CATALOGUE.commands.map((c) => [c.name, c]));
const FLAGS_BY_COMMAND = new Map<string, Set<string>>();
for (const command of CLI_CATALOGUE.commands) FLAGS_BY_COMMAND.set(command.name, new Set());
const GLOBAL_FLAGS = new Set<string>();
for (const flag of CLI_CATALOGUE.flags) {
	if (flag.commands.length === 0) GLOBAL_FLAGS.add(flag.name);
	for (const command of flag.commands) FLAGS_BY_COMMAND.get(command)?.add(flag.name);
}

interface Problem {
	page: string;
	line: number;
	detail: string;
}

/**
 * Resolve every `mewkit …` invocation on a page. Placeholders (`<provider>`, `…`) are values,
 * not names, so only real tokens are resolved.
 */
export function resolvePage(page: string, text: string): Problem[] {
	const problems: Problem[] = [];
	text.split("\n").forEach((line, index) => {
		for (const match of line.matchAll(/\b(?:npx\s+)?mewkit\s+([a-z][a-z0-9-]*)((?:\s+[^\s|#`]+)*)/g)) {
			const verb = match[1];
			if (PROSE_AFTER_MEWKIT.has(verb)) continue;
			const command = COMMANDS.get(verb);
			if (command === undefined) {
				problems.push({ page, line: index + 1, detail: `unknown command \`${verb}\`` });
				continue;
			}
			const rest = (match[2] ?? "").trim().split(/\s+/).filter(Boolean);
			const subs = command.subcommands ?? [];
			let expectSub = subs.length > 0;
			for (const token of rest) {
				if (token.startsWith("--")) {
					const name = token.slice(2).split("=")[0];
					if (!FLAGS_BY_COMMAND.get(verb)?.has(name) && !GLOBAL_FLAGS.has(name)) {
						problems.push({ page, line: index + 1, detail: `\`--${name}\` is not declared for \`${verb}\`` });
					}
					expectSub = false;
					continue;
				}
				if (!expectSub) continue;
				expectSub = false;
				// A placeholder or a shell value is an argument, not a subcommand name.
				if (/^[<[$"']/.test(token) || !/^[a-z][a-z0-9-]*$/.test(token)) continue;
				if (!subs.includes(token)) {
					problems.push({ page, line: index + 1, detail: `\`${token}\` is not a subcommand of \`${verb}\`` });
				}
			}
		}
	});
	return problems;
}

const read = (page: string): string => fs.readFileSync(path.join(DOCS, page), "utf-8");

describe("the documented CLI", () => {
	it("resolves every command and flag on the updated pages", () => {
		const problems = UPDATED_PAGES.flatMap((page) => resolvePage(page, read(page)));
		expect(problems.map((p) => `${p.page}:${p.line}: ${p.detail}`), "unresolved").toEqual([]);
	});

	it("fails on a planted bad flag, so the check has teeth", () => {
		const planted = resolvePage("scratch.mdx", "```bash\nmewkit doctor --no-such-flag\n```");
		expect(planted).toHaveLength(1);
		expect(planted[0]?.detail).toContain("--no-such-flag");

		const plantedSub = resolvePage("scratch.mdx", "```bash\nmewkit plan capture tasks/plans/x\n```");
		expect(plantedSub[0]?.detail).toContain("not a subcommand");
	});

	it("documents no removed verb as available", () => {
		for (const page of UPDATED_PAGES) {
			const text = read(page);
			for (const verb of REMOVED) {
				expect(text, `${page} still names ${verb}`).not.toContain(`mewkit ${verb}`);
			}
		}
	});

	it("documents the call path, the floor, the exit codes and the help, without promising a global install", () => {
		const index = read("cli/index.mdx");
		expect(index).toContain(".meowkit/bin/mewkit");
		expect(index).toContain("runtime.json");
		expect(index).toContain("never reaches the network");
		expect(index).toContain("Node.js 24+");
		expect(index).toContain("the invocation was wrong");
		expect(index).toContain("--help");
		// The bare form comes from the launcher, not from installing the package globally.
		expect(index).not.toMatch(/npm\s+(?:install|i)\s+-g/);
	});

});
