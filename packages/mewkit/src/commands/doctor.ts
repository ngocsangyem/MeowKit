import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
	checkClaudeDir,
	checkConfig,
	checkGit,
	checkHooks,
	checkMcp,
	checkMemory,
	checkNodeVersion,
	checkPipPackages,
	checkPython,
	checkScripts,
	checkSystemDeps,
	checkVenv,
	type DiagResult,
	type Status,
} from "./doctor-checks.js";

function statusIcon(status: Status): string {
	switch (status) {
		case "pass":
			return pc.green("PASS");
		case "fail":
			return pc.red("FAIL");
		case "warn":
			return pc.yellow("WARN");
	}
}

/** Find MeowKit project root — checks cwd only (no walk-up to avoid matching parent projects). */
function findProjectRoot(): string | null {
	const cwd = process.cwd();
	const hasDotClaude = fs.existsSync(path.join(cwd, ".claude"));
	const hasConfig = fs.existsSync(path.join(cwd, ".claude", "meowkit.config.json"));
	const hasManifest = fs.existsSync(path.join(cwd, ".claude", "meowkit.manifest.json"));
	const hasClaude = fs.existsSync(path.join(cwd, "CLAUDE.md"));
	if (hasDotClaude || hasConfig || hasManifest || hasClaude) {
		return cwd;
	}
	return null;
}

export async function doctor(args?: { report?: boolean }): Promise<void> {
	console.log(pc.bold(pc.cyan("MeowKit Doctor")));
	console.log(pc.dim("Diagnosing common issues...\n"));

	const root = findProjectRoot();
	if (root) {
		console.log(`  ${pc.dim("Project:")} ${root}\n`);
	}

	const systemDepResults = await checkSystemDeps(root);

	const results: DiagResult[] = [
		checkNodeVersion(),
		checkPython(),
		checkGit(),
		checkClaudeDir(root),
		checkConfig(root),
		checkHooks(root),
		checkScripts(root),
		checkMemory(root),
		checkMcp(root),
		checkVenv(root),
		checkPipPackages(root),
		...systemDepResults,
	];

	for (const r of results) {
		console.log(`  [${statusIcon(r.status)}] ${r.name}`);
		console.log(`         ${pc.dim(r.detail)}`);
		if (r.fix) {
			console.log(`         ${pc.cyan(`Fix: ${r.fix}`)}`);
		}
	}

	console.log();

	const pass = results.filter((r) => r.status === "pass").length;
	const fail = results.filter((r) => r.status === "fail").length;
	const warn = results.filter((r) => r.status === "warn").length;

	const parts: string[] = [pc.green(`${pass} passed`)];
	if (warn > 0) parts.push(pc.yellow(`${warn} warnings`));
	if (fail > 0) parts.push(pc.red(`${fail} failed`));
	console.log(parts.join(", "));

	if (args?.report) {
		const lines = [
			"# MeowKit Doctor Report",
			`Date: ${new Date().toISOString()}`,
			`Node: ${process.versions.node}`,
			`Platform: ${process.platform} ${process.arch}`,
			`Project: ${root ?? "not found"}`,
			"",
			"## Results",
			...results.map((r) => `- [${r.status.toUpperCase()}] ${r.name}: ${r.detail}${r.fix ? ` (fix: ${r.fix})` : ""}`),
			"",
			`## Summary: ${pass} passed, ${warn} warnings, ${fail} failed`,
		];
		console.log(pc.dim("\n--- Report ---"));
		console.log(lines.join("\n"));
	}

	if (fail > 0) process.exit(1);
}
