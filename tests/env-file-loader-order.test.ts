// env-file-loader-order.test.ts — every env-file loader in the kit resolves keys the same way.
//
// The loaders live in four languages because each skill ships on its own, so the
// contract is held by this test instead of by shared code: one fixture project, one
// fixture home, and each loader must report the same values for the same keys.
//
// Order, highest first: shell export, project `.meowkit/.env`, the pre-move project
// `.claude/.env`, then the user-wide `~/.meowkit/.env`; the first source to set a key wins.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "..");
const KEYS = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "MEOW_JIRA_SITE_URL"];

const EXPECTED = {
	K1: "project",
	K2: "legacy",
	K3: "shell",
	K4: "quoted # hash",
	K5: "value",
	K6: "exported",
	K7: "global",
	MEOW_JIRA_SITE_URL: "https://global.invalid",
};

let tmp: string;
let project: string;
let home: string;
let cwd: string;

function write(file: string, lines: string[]): void {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

/** The environment each loader starts from: no project variable, a fixture home, one shell export. */
function baseEnv(): NodeJS.ProcessEnv {
	return { PATH: process.env.PATH, HOME: home, K3: "shell" };
}

function pick(json: string): Record<string, string | undefined> {
	const all = JSON.parse(json) as Record<string, string>;
	return Object.fromEntries(KEYS.map((key) => [key, all[key]]));
}

const PRINT_ENV = "console.log(JSON.stringify(process.env))";

function runNode(args: string[]): string {
	return execFileSync(process.execPath, args, { cwd, env: baseEnv() }).toString();
}

beforeAll(() => {
	tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "env-order-")));
	project = path.join(tmp, "project");
	home = path.join(tmp, "home");
	cwd = path.join(project, "sub", "deep");
	fs.mkdirSync(cwd, { recursive: true });
	write(path.join(project, ".meowkit", ".env"), [
		"# comment",
		"K1=project",
		'K4="quoted # hash"',
		"K5=value # trailing comment",
		"export K6=exported",
		"PATH=/refused",
		`$(touch ${path.join(tmp, "ran")})`,
	]);
	// CRLF line endings, as an editor on Windows writes them.
	fs.mkdirSync(path.join(project, ".claude"), { recursive: true });
	fs.writeFileSync(path.join(project, ".claude", ".env"), "K1=legacy-loses\r\nK2=legacy\r\n");
	write(path.join(home, ".meowkit", ".env"), [
		"K1=global-loses",
		"K2=global-loses",
		"K3=global-loses",
		"K7=global",
		// The three connection keys sit in one file: the wrapper refuses a credential
		// assembled from two files.
		"MEOW_JIRA_SITE_URL=https://global.invalid",
		"MEOW_JIRA_API_TOKEN=placeholder-not-a-real-token",
		"MEOW_JIRA_EMAIL=corpus@example.invalid",
	]);
	// A stand-in for the issue-tracker binary the wrapper execs: it prints what it was given.
	const bin = path.join(project, ".meowkit", "envs", "jira", "bin", "jira-as");
	write(bin, [`#!${process.execPath}`, PRINT_ENV]);
	fs.chmodSync(bin, 0o755);
});

afterAll(() => {
	fs.rmSync(tmp, { recursive: true, force: true });
});

const LOADERS: Record<string, () => string> = {
	"jira wrapper (bash)": () =>
		execFileSync("bash", [path.join(REPO, ".claude/skills/jira/scripts/jira-as.sh")], { cwd, env: baseEnv() }).toString(),
	"hook dotenv lib (node)": () =>
		runNode([
			"-e",
			`require(${JSON.stringify(path.join(REPO, ".claude/hooks/lib/load-dotenv.cjs"))}).loadDotenv({ root: ${JSON.stringify(project)} }); ${PRINT_ENV}`,
		]),
	"docs-finder (node)": () =>
		runNode([
			"-e",
			`console.log(JSON.stringify(require(${JSON.stringify(path.join(REPO, ".claude/skills/docs-finder/scripts/utils/env-loader.js"))}).loadEnv()))`,
		]),
	"stitch (typescript)": () =>
		runNode([
			"--input-type=module",
			"-e",
			`await import(${JSON.stringify(path.join(REPO, ".claude/skills/stitch/scripts/load-env-files.ts"))}); ${PRINT_ENV}`,
		]),
	"multimodal (python)": () =>
		execFileSync(
			"python3",
			[
				"-I",
				"-c",
				`import sys, json, os; sys.path.insert(0, ${JSON.stringify(path.join(REPO, ".claude/skills/multimodal/scripts"))}); import env_utils; env_utils.load_env_files(); print(json.dumps(dict(os.environ)))`,
			],
			{ cwd, env: baseEnv() },
		).toString(),
};

describe("env-file loaders share one order", () => {
	for (const [name, run] of Object.entries(LOADERS)) {
		it(`${name} resolves the fixture keys in the shared order`, () => {
			const out = run();
			expect(pick(out)).toEqual(EXPECTED);
			expect(JSON.parse(out).PATH).not.toBe("/refused");
			expect(fs.existsSync(path.join(tmp, "ran")), "an env file line was executed").toBe(false);
		});
	}

	it("the two issue-tracker wrappers carry the same loader", () => {
		const block = (rel: string): string => {
			const text = fs.readFileSync(path.join(REPO, rel), "utf8");
			const between = (from: string, to: string): string => text.slice(text.indexOf(from), text.indexOf(to));
			return between("find_root() {", 'ROOT="') + between("# Env files,", 'for ENV_FILE in "${ENV_FILES[@]}"');
		};
		const jira = block(".claude/skills/jira/scripts/jira-as.sh");
		expect(jira).toContain("load_env_file()");
		// The loaders differ only in the names of the keys each wrapper treats as its credential.
		const confluence = block(".claude/skills/confluence/scripts/confluence-as.sh").replaceAll("MEOW_CONFLUENCE_", "MEOW_JIRA_");
		expect(confluence).toBe(jira);
	});

	it("the jira wrapper refuses a site URL from the project file when the token comes from the user-wide file", () => {
		const hostile = fs.mkdtempSync(path.join(tmp, "split-"));
		write(path.join(hostile, ".meowkit", ".env"), ["MEOW_JIRA_SITE_URL=https://other.invalid"]);
		const bin = path.join(hostile, ".meowkit", "envs", "jira", "bin", "jira-as");
		write(bin, [`#!${process.execPath}`, PRINT_ENV]);
		fs.chmodSync(bin, 0o755);
		let status: number | null = 0;
		let stderr = "";
		try {
			execFileSync("bash", [path.join(REPO, ".claude/skills/jira/scripts/jira-as.sh")], { cwd: hostile, env: baseEnv(), stdio: "pipe" });
		} catch (err) {
			const failure = err as { status: number | null; stderr: Buffer };
			status = failure.status;
			stderr = failure.stderr.toString();
		}
		expect(status).toBe(78);
		expect(stderr).toContain("MEOW_JIRA_SITE_URL comes from");
	});

	it("the session hook accepts credentials split between the shell and the user-wide file", () => {
		const isolated = fs.mkdtempSync(path.join(tmp, "only-global-"));
		const handler = path.join(REPO, ".claude/hooks/handlers/jira-env-loader.cjs");
		const out = execFileSync(
			process.execPath,
			["-e", `process.stdout.write(require(${JSON.stringify(handler)})({ root: ${JSON.stringify(isolated)} }))`],
			{ env: { PATH: process.env.PATH, HOME: home, MEOW_JIRA_API_TOKEN: "x", MEOW_JIRA_EMAIL: "y" } },
		).toString();
		expect(out).toBe("[mk:jira] env OK\n");
	});
});
