// Source path resolver: project .claude/ takes priority, falls back to bundled mewkit kit.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const home = homedir();

export interface SourcePaths {
	root: string;
	agents: string;
	commands: string;
	skills: string;
	rules: string;
	hooks: string;
	configFile: string;
	origin: "project" | "bundled" | "global" | "explicit";
}

function firstExisting(candidates: string[]): string | null {
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

export function resolveSourcePaths(
	explicitSource: string | undefined,
	bundledKitDir: string,
): SourcePaths {
	const projectClaude = join(process.cwd(), ".claude");
	const globalClaude = join(home, ".claude");

	let root: string;
	let origin: SourcePaths["origin"];

	if (explicitSource) {
		root = explicitSource;
		origin = "explicit";
	} else if (existsSync(projectClaude)) {
		root = projectClaude;
		origin = "project";
	} else if (existsSync(bundledKitDir)) {
		root = bundledKitDir;
		origin = "bundled";
	} else if (existsSync(globalClaude)) {
		root = globalClaude;
		origin = "global";
	} else {
		root = projectClaude;
		origin = "project";
	}

	const agents = join(root, "agents");
	const commandsBase = join(root, "commands");
	const meowCommands = join(commandsBase, "meow");
	const commands = existsSync(meowCommands) ? meowCommands : commandsBase;
	const skills = join(root, "skills");
	const rules = join(root, "rules");
	const hooks = join(root, "hooks");

	const projectConfig = join(process.cwd(), "CLAUDE.md");
	const claudeMdInRoot = join(root, "CLAUDE.md");
	const configFile =
		firstExisting([projectConfig, claudeMdInRoot, join(home, ".claude", "CLAUDE.md")]) ??
		claudeMdInRoot;

	return { root, agents, commands, skills, rules, hooks, configFile, origin };
}

export function readKitVersion(rootPath: string): string | null {
	const configPath = join(rootPath, "meowkit.config.json");
	if (!existsSync(configPath)) return null;
	try {
		const data = JSON.parse(readFileSync(configPath, "utf-8")) as { kitVersion?: string };
		return data.kitVersion ?? null;
	} catch {
		return null;
	}
}
