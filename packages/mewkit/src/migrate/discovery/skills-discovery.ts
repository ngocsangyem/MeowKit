// Vendored from claudekit-cli (MIT). Source: src/commands/skills/skills-discovery.ts
// MeowKit additions: dirName preserves raw colon, name is sanitized for cross-platform safety.
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../frontmatter-parser.js";
import type { SkillInfo } from "../types.js";
import { MEOWKIT_INTERNAL_DIRS } from "./exclusions.js";

/** Sanitize colon and other illegal-on-Windows characters in skill names */
export function sanitizeSkillName(dirName: string): string {
	return dirName.replace(/[:<>:"/\\|?*]/g, "-");
}

async function hasSkillMd(dir: string): Promise<boolean> {
	try {
		const stats = await stat(join(dir, "SKILL.md"));
		return stats.isFile();
	} catch {
		return false;
	}
}

async function parseSkillMd(skillDir: string, dirName: string): Promise<SkillInfo | null> {
	try {
		const content = await readFile(join(skillDir, "SKILL.md"), "utf-8");
		const { frontmatter } = parseFrontmatter(content);

		const metadata =
			frontmatter.metadata && typeof frontmatter.metadata === "object"
				? (frontmatter.metadata as Record<string, unknown>)
				: undefined;
		const version = metadata?.version ?? frontmatter.version;
		const author = metadata?.author;
		const license = frontmatter.license;

		return {
			name: sanitizeSkillName(dirName),
			dirName,
			displayName: frontmatter.name,
			description: typeof frontmatter.description === "string" ? frontmatter.description : "",
			version: version != null ? String(version) : undefined,
			author: author != null ? String(author) : undefined,
			license: typeof license === "string" ? license : undefined,
			sourcePath: skillDir,
		};
	} catch {
		return null;
	}
}

export async function discoverSkills(sourcePath: string): Promise<SkillInfo[]> {
	const skills: SkillInfo[] = [];
	const seen = new Set<string>();

	let entries: import("node:fs").Dirent[];
	try {
		entries = await readdir(sourcePath, { withFileTypes: true });
	} catch {
		return skills;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (MEOWKIT_INTERNAL_DIRS.has(entry.name)) continue;
		if (entry.name.startsWith(".")) continue;

		const skillDir = join(sourcePath, entry.name);
		if (!(await hasSkillMd(skillDir))) continue;

		const skill = await parseSkillMd(skillDir, entry.name);
		if (skill && !seen.has(skill.name)) {
			skills.push(skill);
			seen.add(skill.name);
		}
	}

	return skills.sort((a, b) => a.name.localeCompare(b.name));
}
