import { execSync } from "node:child_process";
import fs, { chmodSync } from "node:fs";
import path from "node:path";
import { commandExists } from "./setup.js";
import { getRequirementsSource } from "../core/skills-dependencies.js";
import { verifyPackages } from "../core/dependency-installer.js";
import { listDeps, isDepCommandPresent, type DoctorContext } from "../lib/system-deps-registry.js";
import { isHookScript } from "../core/is-hook-script.js";

export type Status = "pass" | "fail" | "warn" | "na";

export interface DiagResult {
	name: string;
	status: Status;
	detail: string;
	fix?: string;
}

export function checkNodeVersion(): DiagResult {
	const major = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
	if (major >= 20) {
		return { name: "Node.js >= 20", status: "pass", detail: `v${process.versions.node}` };
	}
	return { name: "Node.js >= 20", status: "fail", detail: `v${process.versions.node} — need 20+` };
}

export function checkPython(): DiagResult {
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

export function checkGit(): DiagResult {
	try {
		const output = execSync("git --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
		return { name: "Git", status: "pass", detail: output };
	} catch {
		return { name: "Git", status: "fail", detail: "Not found in PATH" };
	}
}

export function checkClaudeDir(root: string | null): DiagResult {
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

export function checkHooks(root: string | null): DiagResult {
	if (!root) return { name: "Hooks", status: "warn", detail: "Skipped — no project" };

	const hooksDir = path.join(root, ".claude", "hooks");
	if (!fs.existsSync(hooksDir)) {
		return { name: "Hooks", status: "warn", detail: "No hooks/ directory" };
	}

	// Only count actual hook scripts — never directories (lib/, handlers/, __tests__/) or
	// sidecars (HOOKS_INDEX.md, handlers.json), which accessSync(X_OK) would falsely accept.
	const hooks = fs
		.readdirSync(hooksDir)
		.filter((f) => !f.startsWith("."))
		.filter((f) => isHookScript(path.join(hooksDir, f)));
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

export function checkScripts(root: string | null): DiagResult {
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

export function checkMemory(root: string | null): DiagResult {
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

export function checkMcp(root: string | null): DiagResult {
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

export function checkVenv(root: string | null): DiagResult {
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

export function checkPipPackages(root: string | null): DiagResult {
	if (!root) return { name: "Pip packages", status: "warn", detail: "Skipped — no project" };
	const venvDir = path.join(root, ".claude", "skills", ".venv");
	if (!fs.existsSync(venvDir)) {
		return { name: "Pip packages", status: "warn", detail: "Skipped — no venv (run mewkit setup --only=venv)" };
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

export function checkConfig(root: string | null): DiagResult {
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
export async function checkSystemDeps(root: string | null): Promise<DiagResult[]> {
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

/**
 * Detect the install mode(s) in effect and warn on coexistence.
 *
 * MeowKit can be installed two ways: flat-copy (`mewkit init` writes
 * `.claude/metadata.json` into the project) or as a native plugin (`mk@meowkit`
 * in the user's Claude Code config). Having BOTH active resolves the same skills
 * and agents twice — ambiguous and confusing — so this surfaces it.
 */
export function checkInstallMode(root: string | null): DiagResult {
	const flatCopy = root !== null && fs.existsSync(path.join(root, ".claude", "metadata.json"));

	let pluginInstalled = false;
	let pluginKnown = true;
	try {
		const out = execSync("claude plugin list", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		pluginInstalled = /\bmk@/.test(out);
	} catch {
		pluginKnown = false; // claude CLI absent or errored — cannot determine
	}

	if (flatCopy && pluginInstalled) {
		return {
			name: "Install mode",
			status: "warn",
			detail: "both flat-copy and the mk plugin are active — duplicate skill/agent resolution",
			fix: "use one mode: uninstall the plugin (claude plugin uninstall mk@meowkit) OR remove the flat-copy .claude/",
		};
	}
	if (pluginInstalled) {
		return { name: "Install mode", status: "pass", detail: "native plugin (mk@meowkit)" };
	}
	if (flatCopy) {
		return {
			name: "Install mode",
			status: "pass",
			detail: pluginKnown
				? "flat-copy (mewkit init)"
				: "flat-copy (mewkit init); plugin status unknown — claude CLI not found",
		};
	}
	return { name: "Install mode", status: "na", detail: "no MeowKit install detected in this project" };
}
