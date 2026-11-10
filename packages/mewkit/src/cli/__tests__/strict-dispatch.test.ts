// One meaning per exit code, asserted over the WHOLE catalogue rather than a sample.
//
// Sampling is what let the surface drift in the first place: a mistyped sub-verb exited 0
// on two commands, 1 on eleven and 2 on one, and every individual command looked defensible
// on its own. These tests enumerate the catalogue, so a command added later cannot
// reintroduce the silent accept without failing here.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CLI_CATALOGUE } from "../command-catalogue.js";
import { classifyInvocation, renderInvocationError, renderSubcommandHelp } from "../strict-dispatch.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "..", "..", "..", "dist", "index.js");

const WITH_SUBCOMMANDS = CLI_CATALOGUE.commands.filter((c) => (c.subcommands ?? []).length > 0);

interface Run {
	status: number;
	stdout: string;
	stderr: string;
}

function run(args: string[], cwd: string): Run {
	try {
		const stdout = execFileSync(process.execPath, [CLI, ...args], {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return { status: 0, stdout, stderr: "" };
	} catch (err) {
		const e = err as { status?: number | null; stdout?: string; stderr?: string };
		return { status: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
	}
}

function scratch(): string {
	return mkdtempSync(path.join(tmpdir(), "mk-dispatch-"));
}

describe("invocation classification", () => {
	it("declares a subcommand requirement for every command that has one, in the catalogue", () => {
		// The declaration is the source the probes below read. A command with sub-verbs and
		// no declaration either way is the ambiguity this field exists to remove.
		for (const command of WITH_SUBCOMMANDS) {
			expect(typeof (command.requiresSubcommand ?? false)).toBe("boolean");
		}
		// Commands whose bare form does real work must not be marked as requiring one.
		for (const name of ["doctor", "budget", "backups"]) {
			const command = CLI_CATALOGUE.commands.find((c) => c.name === name);
			expect(command, `${name} should still exist`).toBeDefined();
			expect(command?.requiresSubcommand ?? false).toBe(false);
		}
	});

	it("treats a flag in the subcommand slot as a flag", () => {
		const result = classifyInvocation(CLI_CATALOGUE, ["trace", "--friction"], false);
		expect(result.kind).toBe("run");
	});

	it("names the valid subcommands in every invocation error", () => {
		for (const command of WITH_SUBCOMMANDS) {
			const unknown = classifyInvocation(CLI_CATALOGUE, [command.name, "zzbogus"], false);
			expect(unknown.kind).toBe("unknown-subcommand");
			const message = renderInvocationError(unknown).join("\n");
			for (const sub of command.subcommands ?? []) expect(message).toContain(sub);
		}
	});
});

describe("exit codes", () => {
	it("answers an unknown subcommand with 2 for every command that takes one", () => {
		const cwd = scratch();
		for (const command of WITH_SUBCOMMANDS) {
			const result = run([command.name, "zzbogus"], cwd);
			expect(result.status, `${command.name} zzbogus`).toBe(2);
			const output = result.stdout + result.stderr;
			for (const sub of command.subcommands ?? []) expect(output).toContain(sub);
			// A usage error is a message, never a crash report.
			expect(output).not.toMatch(/\n\s+at\s/);
		}
	});

	it("answers an unknown command with 2", () => {
		expect(run(["zzbogus"], scratch()).status).toBe(2);
	});

	it("answers a missing subcommand with 2 only where the catalogue requires one", () => {
		const cwd = scratch();
		for (const command of WITH_SUBCOMMANDS.filter((c) => c.requiresSubcommand === true)) {
			const result = run([command.name], cwd);
			expect(result.status, `bare ${command.name}`).toBe(2);
			expect(result.stdout + result.stderr).toContain("needs a subcommand");
		}
	});

	it("leaves the bare form of a command that does its own work alone", () => {
		const cwd = scratch();
		for (const name of ["budget", "backups"]) {
			const result = run([name], cwd);
			expect(result.status, `bare ${name}`).not.toBe(2);
			expect(result.stdout + result.stderr).not.toContain("needs a subcommand");
		}
	});
});

describe("per-subcommand help", () => {
	it("prints the subcommand's own usage, exits 0 and touches nothing", () => {
		const cwd = scratch();
		const before = readdirSync(cwd);
		for (const command of WITH_SUBCOMMANDS) {
			for (const sub of command.subcommands ?? []) {
				const result = run([command.name, sub, "--help"], cwd);
				expect(result.status, `${command.name} ${sub} --help`).toBe(0);
				expect(result.stdout).toContain(sub);
				expect(result.stdout).toContain(command.name);
			}
		}
		// Asking for help must not create, remove or rewrite anything in the directory it
		// was asked from — including the `.claude/` tree it does not need.
		expect(readdirSync(cwd)).toEqual(before);
	});

	it("renders help from the catalogue rather than from the command", () => {
		const command = CLI_CATALOGUE.commands.find((c) => c.name === "plan");
		const rendered = renderSubcommandHelp(CLI_CATALOGUE, command!, "status").join("\n");
		expect(rendered).toContain(command?.subcommandUsage?.status ?? "plan status");
	});

	it("answers a command-level --help without running the command", () => {
		const cwd = scratch();
		const result = run(["review", "--help"], cwd);
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("prepare");
		expect(result.stdout).not.toContain("Unknown review subcommand");
	});
});

describe("the removed surface", () => {
	it("answers every removed verb as an unknown command", () => {
		const cwd = scratch();
		for (const name of ["status", "context", "explain-support", "docs-manifest", "inventory"]) {
			const result = run([name], cwd);
			expect(result.status, name).toBe(2);
			expect(result.stdout + result.stderr).toContain("Unknown command");
			expect(CLI_CATALOGUE.commands.some((c) => c.name === name)).toBe(false);
		}
	});

	it("keeps the neighbours the removals could have caught", () => {
		for (const name of ["providers", "budget", "orient", "versions", "validate"]) {
			expect(
				CLI_CATALOGUE.commands.some((c) => c.name === name),
				name,
			).toBe(true);
		}
		const budget = CLI_CATALOGUE.commands.find((c) => c.name === "budget");
		expect(budget?.subcommands).toContain("context");
	});

	it("still runs a command that fails, and reports it as a failure rather than a usage error", () => {
		const cwd = scratch();
		writeFileSync(path.join(cwd, "not-a-plan.md"), "placeholder\n", "utf-8");
		const result = run(["plan", "check", path.join(cwd, "not-a-plan.md")], cwd);
		expect(result.status).toBe(1);
	});
});
