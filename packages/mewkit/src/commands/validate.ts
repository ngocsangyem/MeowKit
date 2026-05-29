import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { checkDocsReferences } from "../core/check-docs-references.js";
import { collectProviderContractDiagnostics } from "../migrate/provider-contract-diagnostics.js";

interface CheckResult {
	name: string;
	passed: boolean;
	detail: string;
}

interface ValidateOptions {
	portable?: boolean;
}

/** Find MeowKit .claude/ in cwd only (no walk-up). */
function findMeowkitDir(startDir: string): string | null {
	const candidate = path.join(startDir, ".claude");
	if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
		return candidate;
	}
	return null;
}

function checkFileExists(meowkitDir: string, relativePath: string): CheckResult {
	const fullPath = path.join(meowkitDir, relativePath);
	const exists = fs.existsSync(fullPath);
	return {
		name: `File exists: ${relativePath}`,
		passed: exists,
		detail: exists ? fullPath : `Missing: ${fullPath}`,
	};
}

function checkDirExists(meowkitDir: string, relativePath: string): CheckResult {
	const fullPath = path.join(meowkitDir, relativePath);
	const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
	return {
		name: `Directory exists: ${relativePath}`,
		passed: exists,
		detail: exists ? fullPath : `Missing: ${fullPath}`,
	};
}

function checkHooksExecutable(meowkitDir: string): CheckResult[] {
	const hooksDir = path.join(meowkitDir, "hooks");
	const results: CheckResult[] = [];

	if (!fs.existsSync(hooksDir)) {
		results.push({
			name: "Hooks directory",
			passed: false,
			detail: `Missing: ${hooksDir}`,
		});
		return results;
	}

	const hookFiles = fs.readdirSync(hooksDir).filter((f) => !f.startsWith("."));

	if (hookFiles.length === 0) {
		results.push({
			name: "Hooks present",
			passed: false,
			detail: "No hook files found in hooks/",
		});
		return results;
	}

	for (const hook of hookFiles) {
		const hookPath = path.join(hooksDir, hook);
		try {
			fs.accessSync(hookPath, fs.constants.X_OK);
			results.push({
				name: `Hook executable: ${hook}`,
				passed: true,
				detail: hookPath,
			});
		} catch {
			results.push({
				name: `Hook executable: ${hook}`,
				passed: false,
				detail: `Not executable: ${hookPath}`,
			});
		}
	}

	return results;
}

function checkConfigJson(meowkitDir: string): CheckResult {
	const configPath = path.join(meowkitDir, "meowkit.config.json");
	if (!fs.existsSync(configPath)) {
		return {
			name: "Config JSON valid",
			passed: false,
			detail: `Missing: ${configPath}`,
		};
	}

	try {
		const content = fs.readFileSync(configPath, "utf-8");
		JSON.parse(content);
		return {
			name: "Config JSON valid",
			passed: true,
			detail: configPath,
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			name: "Config JSON valid",
			passed: false,
			detail: `Invalid JSON: ${message}`,
		};
	}
}

function checkDocsRefsContract(meowkitDir: string): CheckResult[] {
	const results: CheckResult[] = [];
	const contractPath = path.join(meowkitDir, "rules", "docs-reference-contract.md");
	if (!fs.existsSync(contractPath)) {
		results.push({
			name: "Docs-reference contract present",
			passed: false,
			detail: `Missing: ${contractPath}`,
		});
		return results;
	}

	try {
		const { scannedFiles, findings, errorCount, warnCount } = checkDocsReferences(meowkitDir);
		const passed = errorCount === 0;
		const summary = `Scanned ${scannedFiles} files — ${errorCount} error(s), ${warnCount} warning(s)`;
		const detail = passed
			? summary
			: `${summary}\n         ${findings
				.filter((f) => f.level === "ERROR")
				.slice(0, 10)
				.map((f) => `${f.file}:${f.line}: ${f.token}`)
				.join("\n         ")}`;
		results.push({
			name: "Docs references on Type-1 allowlist",
			passed,
			detail,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		results.push({
			name: "Docs references on Type-1 allowlist",
			passed: false,
			detail: `Validator crashed: ${message}`,
		});
	}

	return results;
}

function printResult(result: CheckResult): void {
	const icon = result.passed ? pc.green("PASS") : pc.red("FAIL");
	console.log(`  [${icon}] ${result.name}`);
	if (!result.passed) {
		console.log(`         ${pc.dim(result.detail)}`);
	}
}

export async function validate(args: ValidateOptions = {}): Promise<void> {
	console.log(pc.bold(pc.cyan("Validating .claude/ project structure...")));
	console.log();

	const meowkitDir = findMeowkitDir(process.cwd());

	if (!meowkitDir) {
		console.error(pc.red("Could not find .claude/ directory in current or parent directories."));
		process.exit(1);
	}

	console.log(`${pc.dim("Found:")} ${meowkitDir}`);
	console.log();

	const results: CheckResult[] = [];

	// Required directories
	results.push(checkDirExists(meowkitDir, "agents"));
	results.push(checkDirExists(meowkitDir, "hooks"));

	// CLAUDE.md lives at project root (Claude Code reads it from there)
	const projectRoot = path.dirname(meowkitDir);
	results.push(checkFileExists(projectRoot, "CLAUDE.md"));

	// Hooks executable
	results.push(...checkHooksExecutable(meowkitDir));

	// Config JSON
	results.push(checkConfigJson(meowkitDir));

	// Docs-reference contract (Type-1 allowlist)
	results.push(...checkDocsRefsContract(meowkitDir));

	if (args.portable) {
		for (const diagnostic of collectProviderContractDiagnostics()) {
			if (diagnostic.severity === "pass") continue;
			results.push({
				name: `Provider contract: ${diagnostic.providerDisplayName}/${diagnostic.surface}`,
				passed: diagnostic.severity !== "fail",
				detail: diagnostic.message,
			});
		}
	}

	for (const result of results) {
		printResult(result);
	}

	console.log();

	const passCount = results.filter((r) => r.passed).length;
	const failCount = results.filter((r) => !r.passed).length;

	if (failCount === 0) {
		console.log(pc.green(pc.bold(`All ${passCount} checks passed.`)));
	} else {
		console.log(`${pc.green(`${passCount} passed`)}, ${pc.red(`${failCount} failed`)}`);
		process.exit(1);
	}
}
