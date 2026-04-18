import { execSync } from "node:child_process";
import fs, { chmodSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { commandExists } from "./setup.js";
import { getRequirementsSource } from "../core/skills-dependencies.js";
import { verifyPackages } from "../core/dependency-installer.js";
import { listDeps, isDepCommandPresent, type DoctorContext } from "../lib/system-deps-registry.js";

type Status = "pass" | "fail" | "warn";

interface DiagResult {
	name: string;
	status: Status;
	detail: string;
	fix?: string;
}

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

// --- Check functions: each takes projectRoot (may be null) ---

function checkNodeVersion(): DiagResult {
	const major = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
	if (major >= 20) {
		return { name: "Node.js >= 20", status: "pass", detail: `v${process.versions.node}` };
	}
	return { name: "Node.js >= 20", status: "fail", detail: `v${process.versions.node} — need 20+` };
}

function checkPython(): DiagResult {
	for (const cmd of ["python3 --version", "python --version"]) {
		try {
			const output = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
			const match = output.match(/Python (\d+)\.(\d+)/);
			if (match) {
				const major = parseInt(match[1] ?? "0", 10);
				const minor = parseInt(match[2] ?? "0", 10);
				if (major >= 3 && minor >= 9) {
					return { name: "Python 3.9+", status: "pass", detail: output };
				}
				return { name: "Python 3.9+", status: "fail", detail: `${output} — need 3.9+` };
			}
		} catch {
			/* try next */
		}
	}
	return { name: "Python 3.9+", status: "warn", detail: "Not found in PATH" };
}

function checkGit(): DiagResult {
	try {
		const output = execSync("git --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
		return { name: "Git", status: "pass", detail: output };
	} catch {
		return { name: "Git", status: "fail", detail: "Not found in PATH" };
	}
}

function checkClaudeDir(root: string | null): DiagResult {
	if (!root) {
		return {
			name: ".claude/ directory",
			status: "warn",
			detail: "No MeowKit project found — run 'npm create meowkit' to scaffold",
		};
	}
	const claudeDir = path.join(root, ".claude");
	if (fs.existsSync(claudeDir)) {
		return { name: ".claude/ directory", status: "pass", detail: claudeDir };
	}
	return {
		name: ".claude/ directory",
		status: "warn",
		detail: "Project found but .claude/ missing — run 'npm create meowkit' to scaffold",
		fix: "npm create meowkit",
	};
}

function checkHooks(root: string | null): DiagResult {
	if (!root) return { name: "Hooks", status: "warn", detail: "Skipped — no project" };

	const hooksDir = path.join(root, ".claude", "hooks");
	if (!fs.existsSync(hooksDir)) {
		return { name: "Hooks", status: "warn", detail: "No hooks/ directory" };
	}

	const hooks = fs.readdirSync(hooksDir).filter((f) => !f.startsWith("."));
	if (hooks.length === 0) {
		return { name: "Hooks", status: "warn", detail: "No hook files" };
	}

	const nonExec: string[] = [];
	for (const h of hooks) {
		try {
			fs.accessSync(path.join(hooksDir, h), fs.constants.X_OK);
		} catch {
			nonExec.push(h);
		}
	}

	if (nonExec.length === 0) {
		return { name: "Hooks", status: "pass", detail: `${hooks.length} hook(s), all executable` };
	}

	// Auto-fix permissions
	let fixed = 0;
	for (const h of nonExec) {
		try {
			chmodSync(path.join(hooksDir, h), 0o755);
			fixed++;
		} catch {
			/* can't fix */
		}
	}

	if (fixed === nonExec.length) {
		return { name: "Hooks", status: "pass", detail: `${hooks.length} hook(s) — auto-fixed ${fixed} permission(s)` };
	}

	return {
		name: "Hooks",
		status: "fail",
		detail: `${nonExec.length - fixed} not executable: ${nonExec.join(", ")}`,
		fix: "chmod +x .claude/hooks/*",
	};
}

function checkScripts(root: string | null): DiagResult {
	if (!root) return { name: "Scripts", status: "warn", detail: "Skipped — no project" };

	const scriptsDir = path.join(root, ".claude", "scripts");
	if (!fs.existsSync(scriptsDir)) {
		return { name: "Scripts", status: "warn", detail: "No scripts/ directory" };
	}

	const expected = ["validate.py", "security-scan.py", "checklist.py", "injection-audit.py"];
	const missing = expected.filter((s) => !fs.existsSync(path.join(scriptsDir, s)));

	if (missing.length === 0) {
		return { name: "Scripts", status: "pass", detail: `${expected.length} validation scripts found` };
	}
	return { name: "Scripts", status: "warn", detail: `Missing: ${missing.join(", ")}` };
}

function checkMemory(root: string | null): DiagResult {
	if (!root) return { name: "Memory", status: "warn", detail: "Skipped — no project" };

	const memDir = path.join(root, ".claude", "memory");
	if (!fs.existsSync(memDir)) {
		return { name: "Memory", status: "warn", detail: "memory/ not found — will be created on first session" };
	}

	try {
		const test = path.join(memDir, ".doctor-test");
		fs.writeFileSync(test, "test", "utf-8");
		fs.unlinkSync(test);
		return { name: "Memory", status: "pass", detail: "Writable" };
	} catch {
		return { name: "Memory", status: "fail", detail: `${memDir} is not writable` };
	}
}

function checkMcp(root: string | null): DiagResult {
	if (!root) return { name: "MCP config", status: "warn", detail: "Skipped — no project" };

	if (fs.existsSync(path.join(root, ".mcp.json"))) {
		return { name: "MCP config", status: "pass", detail: ".mcp.json found" };
	}
	return {
		name: "MCP config",
		status: "warn",
		detail: "No .mcp.json",
		fix: "meowkit setup --only=mcp",
	};
}

function checkVenv(root: string | null): DiagResult {
	if (!root) return { name: "Skills venv", status: "warn", detail: "Skipped — no project" };

	const venvDir = path.join(root, ".claude", "skills", ".venv");
	if (fs.existsSync(venvDir)) {
		return { name: "Skills venv", status: "pass", detail: venvDir };
	}
	return {
		name: "Skills venv",
		status: "warn",
		detail: "No Python venv for skills",
		fix: "meowkit setup --only=venv",
	};
}

function checkPipPackages(root: string | null): DiagResult {
	if (!root) return { name: "Pip packages", status: "warn", detail: "Skipped — no project" };
	const venvDir = path.join(root, ".claude", "skills", ".venv");
	if (!fs.existsSync(venvDir)) {
		return { name: "Pip packages", status: "warn", detail: "Skipped — no venv (run meowkit setup --only=venv)" };
	}
	const { packages } = getRequirementsSource(root);
	const results = verifyPackages(root, packages);
	const missing = results.filter((r) => !r.installed);
	if (missing.length === 0) {
		return { name: "Pip packages", status: "pass", detail: `${results.length} skill packages verified` };
	}
	return {
		name: "Pip packages",
		status: "warn",
		detail: `Missing: ${missing.map((r) => r.name).join(", ")}`,
		fix: "meowkit setup --only=deps",
	};
}

function checkConfig(root: string | null): DiagResult {
	if (!root) return { name: "Config", status: "warn", detail: "Skipped — no project" };

	const configPath = path.join(root, ".claude", "meowkit.config.json");
	if (!fs.existsSync(configPath)) {
		return { name: "Config", status: "warn", detail: ".claude/meowkit.config.json not found" };
	}

	try {
		JSON.parse(fs.readFileSync(configPath, "utf-8"));
		return { name: "Config", status: "pass", detail: ".claude/meowkit.config.json valid" };
	} catch {
		return { name: "Config", status: "fail", detail: ".claude/meowkit.config.json is invalid JSON" };
	}
}

/**
 * Run system dep checks from the registry.
 * For each entry: if it has a dedicated doctorCheck, call that.
 * Otherwise, run detectCommand and check exit code.
 * Zero behavior change for ffmpeg/imagemagick — same pass/warn/fail semantics.
 * Playwright gets its dedicated two-probe check (locked decision #3).
 */
async function checkSystemDeps(root: string | null): Promise<DiagResult[]> {
	const ctx: DoctorContext = { projectRoot: root ?? process.cwd() };
	const results: DiagResult[] = [];

	for (const dep of listDeps()) {
		if (dep.doctorCheck) {
			// Dedicated check (e.g. Playwright: verifies pip package + chromium binary)
			try {
				const result = await dep.doctorCheck(ctx);
				if (result.status === "OK") {
					results.push({
						name: `${dep.name} (optional)`,
						status: "pass",
						detail: `${dep.name} installed and ready`,
					});
				} else {
					results.push({
						name: `${dep.name} (optional)`,
						status: "warn",
						detail: result.message ?? `${dep.name} not ready — ${result.status}`,
						fix: `npx mewkit setup --system-deps`,
					});
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				results.push({
					name: `${dep.name} (optional)`,
					status: "warn",
					detail: `Check failed: ${msg}`,
					fix: `npx mewkit setup --system-deps`,
				});
			}
		} else {
			// Generic PATH-based check — uses detectCommands (multi-probe) when set,
			// falling back to single detectCommand. No per-dep special-cases needed.
			const present = isDepCommandPresent(dep, commandExists);

			if (!present) {
				results.push({
					name: `${dep.name} (optional)`,
					status: "warn",
					detail: `Not installed — ${dep.name.toLowerCase()} processing unavailable`,
					fix: `npx mewkit setup --system-deps`,
				});
				continue;
			}

			// Attempt to get version string for a nicer pass message.
			// For multi-binary deps (detectCommands), use the first probe that succeeds.
			try {
				const probes = dep.detectCommands ?? [dep.detectCommand];
				const availableCmd = probes.find((cmd) => commandExists(cmd)) ?? dep.detectCommand;
				const versionFlag = dep.key === "imagemagick" ? "--version" : "-version";
				const output = execSync(`${availableCmd} ${versionFlag}`, {
					encoding: "utf-8",
					stdio: ["pipe", "pipe", "pipe"],
				});
				const match = dep.key === "imagemagick" ? output.match(/ImageMagick (\S+)/) : output.match(/version (\S+)/);
				const version = match ? match[1] : "unknown";
				results.push({
					name: `${dep.name} (optional)`,
					status: "pass",
					detail: `v${version} — available`,
				});
			} catch {
				results.push({
					name: `${dep.name} (optional)`,
					status: "pass",
					detail: `Installed — available`,
				});
			}
		}
	}

	return results;
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
