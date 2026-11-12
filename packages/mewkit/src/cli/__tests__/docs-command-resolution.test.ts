// Every `mewkit` command and flag the install documentation shows resolves
// against the catalogue.
//
// Resolution, never execution. Running install commands lifted from
// documentation would perform real installs and real network fetches, so the
// check reads what the docs claim and asks the catalogue whether it exists. The
// property is "nothing documented is undeclared", and that is a question about
// the catalogue rather than about a running CLI.
//
// Extraction is anchored to COMMAND position — the start of a snippet, or after a
// shell prompt, pipe or `&&`. Interactive CLI output quoted in a fenced block
// contains sentences like "mewkit updated source since last install", and a
// looser match would read those as invocations of a verb called `updated`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CLI_CATALOGUE } from "../command-catalogue.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..", "..");
const DOCS = join(REPO, "packages", "docs", "content", "docs");

/** Pages that describe how an install is performed today. */
const UPDATED = [
	"installation.mdx",
	"quick-start.mdx",
	"cli/index.mdx",
	"cli/project-setup.mdx",
	"reference/configuration.mdx",
	"workflows/new-project.mdx",
];
/**
 * Names the install only to draw a CLI-versus-skill boundary; nothing it says
 * about the install changes, and it still describes the current surface.
 */
const UNCHANGED_CURRENT = ["reference/skills/bootstrap.mdx"];
/**
 * A record of what PAST releases did. These name verbs that were real then and
 * are retired now, so they are accounted for by being unchanged rather than by
 * resolving — a changelog that only mentioned surviving verbs would be a false
 * history.
 */
const CHANGELOG = ["changelog/index.mdx", "changelog/archive.mdx"];

const COMMANDS = new Set(CLI_CATALOGUE.commands.map((command) => command.name));
const PASS_THROUGH = new Set(
	CLI_CATALOGUE.commands.filter((command) => command.passThrough === true).map((command) => command.name),
);
// One flag name can be declared for several commands in separate entries, so the
// sets are unioned. Keyed by name alone, the last entry would win and every
// earlier command would look as if the flag were not declared for it.
const FLAGS = new Map<string, Set<string>>();
for (const flag of CLI_CATALOGUE.flags) {
	const existing = FLAGS.get(flag.name);
	if (existing === undefined) FLAGS.set(flag.name, new Set(flag.commands));
	else for (const command of flag.commands) existing.add(command);
}

interface Invocation {
	verb: string;
	flags: string[];
	page: string;
	text: string;
}

/** Inline code spans and fenced-block lines — the only places a command appears. */
function codeSnippets(text: string): string[] {
	const out: string[] = [];
	for (const match of text.matchAll(/`([^`\n]+)`/g)) out.push(match[1]);
	let inFence = false;
	for (const line of text.split("\n")) {
		if (/^\s*```/.test(line)) {
			inFence = !inFence;
			continue;
		}
		// Only unindented fenced lines. A fenced block that quotes the CLI's own
		// interactive OUTPUT indents it, and that prose contains sentences like
		// "mewkit updated source since last install" which are not invocations.
		if (inFence && !/^\s/.test(line)) out.push(line);
	}
	return out;
}

function invocations(page: string, text: string): Invocation[] {
	const found: Invocation[] = [];
	for (const snippet of codeSnippets(text)) {
		for (const match of snippet.matchAll(
			/(?:^|\$ |&& |\| |; |\()\s*(?:npx\s+)?mewkit\s+([a-z][a-z-]*)((?:\s+[^\s#]+)*)/g,
		)) {
			found.push({
				verb: match[1],
				flags: (match[2] ?? "")
					.split(/\s+/)
					.filter((token) => token.startsWith("--"))
					.map((token) => token.slice(2).split("=")[0]),
				page,
				text: match[0].trim(),
			});
		}
	}
	return found;
}

/** The reason an invocation does not resolve, or null when it does. */
function unresolved(invocation: Invocation): string | null {
	if (!COMMANDS.has(invocation.verb)) {
		return `${invocation.page}: "${invocation.text}" names no declared command`;
	}
	if (PASS_THROUGH.has(invocation.verb)) return null;
	for (const flag of invocation.flags) {
		// `--no-x` is the negation of a declared `x` unless `no-x` is itself a
		// declared name, which a few flags are.
		const owners = FLAGS.get(flag) ?? (flag.startsWith("no-") ? FLAGS.get(flag.slice(3)) : undefined);
		if (owners === undefined) {
			return `${invocation.page}: "${invocation.text}" uses --${flag}, which is declared for no command`;
		}
		if (owners.size > 0 && !owners.has(invocation.verb)) {
			return `${invocation.page}: "${invocation.text}" uses --${flag}, which is not declared for \`${invocation.verb}\``;
		}
	}
	return null;
}

const CURRENT_SURFACE = [...UPDATED, ...UNCHANGED_CURRENT];

describe("documented commands resolve against the catalogue", () => {
	it("accounts for every page that names the install", () => {
		const all = [...CURRENT_SURFACE, ...CHANGELOG];
		expect(new Set(all).size).toBe(all.length);
		for (const page of all) expect(readFileSync(join(DOCS, page), "utf8").length).toBeGreaterThan(0);
	});

	it("resolves every verb and flag on every page that describes the current surface", () => {
		const failures: string[] = [];
		for (const page of CURRENT_SURFACE) {
			for (const invocation of invocations(page, readFileSync(join(DOCS, page), "utf8"))) {
				const failure = unresolved(invocation);
				if (failure !== null) failures.push(failure);
			}
		}
		expect(failures).toEqual([]);
	});

	it("fails on a planted bad flag, so the check has teeth", () => {
		const planted = invocations("planted.mdx", "Run `npx mewkit init --no-such-flag` to start.");
		expect(planted).toHaveLength(1);
		expect(unresolved(planted[0])).toMatch(/--no-such-flag, which is declared for no command/);
	});

	it("never rewrites a released changelog entry", () => {
		const diff = execFileSync(
			"git",
			[
				"diff",
				"56488bc520f6a042472c8b4e6259d9ff0bdae863",
				"--",
				...CHANGELOG.map((page) => join("packages/docs/content/docs", page)),
			],
			{ cwd: REPO, encoding: "utf8" },
		);
		// New entries may be added above the released ones; a released entry is
		// never edited or removed, so the diff carries no removed line.
		const removed = diff.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---"));
		expect(removed).toEqual([]);
	});

	it("documents the new surface, with no bypass and no second cache location", () => {
		const updatedText = UPDATED.map((page) => readFileSync(join(DOCS, page), "utf8")).join("\n");
		for (const claim of ["--delivery", "mewkit versions", ".meowkit/cache"]) {
			expect(updatedText).toContain(claim);
		}
		// No documented way to skip verification, because none exists; and no
		// home-directory cache path, because there is one project-local cache.
		// The suffix is spelled without its prefix on purpose: the committed
		// environment-name universe scans this tree, and a full name written here
		// would be read as a variable this file consumes.
		expect(updatedText).not.toMatch(/--skip-verif|--no-verify|_SKIP_VERIFICATION|~\/\.meowkit/);
		// The plugin delivery describes what this ships, not a marketplace.
		expect(updatedText).not.toMatch(/build-plugin|marketplace\.json|plugin marketplace add/);
	});

	it("declares the verbs and flags the install documentation now shows", () => {
		expect(COMMANDS.has("versions")).toBe(true);
		expect([...(FLAGS.get("delivery") ?? [])]).toEqual(["init"]);
		expect(FLAGS.has("offline")).toBe(false);
	});
});
