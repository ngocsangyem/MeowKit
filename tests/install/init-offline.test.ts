// A real `mewkit init`, executed with no network, and what it actually laid down.
//
// The claim being proved is narrow and was previously unprovable: the published
// CLI binary, run in a scratch git repository, installs the kit, writes the
// project config, and leaves git tracking exactly the allowlisted files.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { installFixture, runNode, trackedUnder, type Fixture, type RunResult } from "./install-harness.js";

describe("init, offline, against an injected release", () => {
	let fx: Fixture;
	let run: RunResult;

	beforeAll(() => {
		const installed = installFixture();
		fx = installed.fx;
		run = installed.run;
	});

	it("succeeds without reaching the network", () => {
		expect(run.all).not.toMatch(/ENOTFOUND|ECONNREFUSED|Cannot fetch releases|EOFFLINE/);
		expect(run.status).toBe(0);
		expect(run.all).toContain("MeowKit installed!");
	});

	// The harness asserts a negative — "no subcommand reaches the network" — and a
	// negative is only as good as the mechanism behind it. This runs the mechanism
	// against the two clients a release lookup could use, in the same environment
	// every command above ran in, so the claim is tested rather than stated.
	it("refuses a connection attempt made from inside the harness environment", () => {
		const probe = [
			'const out = [];',
			'fetch("https://github.com").then(() => out.push("fetch REACHED")).catch((e) => out.push(`fetch ${e.cause?.code ?? e.code}`))',
			'  .finally(() => { const s = require("node:net").connect(443, "github.com");',
			'    s.on("connect", () => { out.push("socket REACHED"); console.log(out.join("|")); process.exit(0); });',
			'    s.on("error", (e) => { out.push(`socket ${e.code}`); console.log(out.join("|")); process.exit(0); }); });',
		].join("\n");
		const result = runNode(fx, ["-e", probe]);
		expect(result.all).not.toContain("REACHED");
		expect(result.stdout).toContain("fetch EOFFLINE");
		expect(result.stdout).toContain("socket EOFFLINE");
	});

	it("lays down the kit", () => {
		expect(existsSync(join(fx.root, ".claude", "hooks", "dispatch.cjs"))).toBe(true);
		expect(existsSync(join(fx.root, ".claude", "rules", "security-rules.md"))).toBe(true);
	});

	it("writes the deny-all ignore file and the project config", () => {
		expect(readFileSync(join(fx.root, ".meowkit", ".gitignore"), "utf8").trim().split("\n")).toEqual([
			"*",
			"!.gitignore",
			"!config.yaml",
			"!.env.example",
			"!mcp.json.example",
			"!bin/",
			"!bin/mewkit",
			"!memory/",
			"!memory/*.md",
		]);
		expect(existsSync(join(fx.root, ".meowkit", "config.yaml"))).toBe(true);
	});

	it("leaves git tracking exactly the allowlist under .meowkit/", () => {
		const tracked = trackedUnder(fx, ".meowkit");
		expect(tracked).toEqual(
			[
				".meowkit/.env.example",
				".meowkit/.gitignore",
				".meowkit/config.yaml",
				".meowkit/mcp.json.example",
			].sort(),
		);
	});
});
