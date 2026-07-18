// Vendored from claudekit-cli (MIT). Source: src/commands/skills/skills-discovery.ts
// MeowKit additions: dirName preserves raw colon, name is sanitized for cross-platform safety.
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../frontmatter-parser.js";
import { ProviderType } from "../types.js";
import type { ContextCost, PortableType, SkillInfo, SkillPortability, SkillPortabilityPolicy } from "../types.js";
import { MEOWKIT_INTERNAL_DIRS } from "./exclusions.js";
import { parseSkillId } from "./skill-id-utils.js";

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

		const frontmatterName = typeof frontmatter.name === "string" ? frontmatter.name : undefined;
		const id = parseSkillId(frontmatterName, dirName);

		return {
			id,
			name: sanitizeSkillName(dirName),
			dirName,
			displayName: frontmatterName,
			description: typeof frontmatter.description === "string" ? frontmatter.description : "",
			version: version != null ? String(version) : undefined,
			author: author != null ? String(author) : undefined,
			license: typeof license === "string" ? license : undefined,
			portability: parsePortabilityPolicy(frontmatter.meowkit),
			sourcePath: skillDir,
		};
	} catch {
		return null;
	}
}

function parsePortabilityPolicy(raw: unknown): SkillPortabilityPolicy | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const data = raw as Record<string, unknown>;
	const portability = parseEnum<SkillPortability>(data.portability, ["generic", "provider-adapted", "provider-only"]);
	if (!portability) return undefined;

	const providers =
		data.providers && typeof data.providers === "object" ? (data.providers as Record<string, unknown>) : undefined;
	const requires =
		data.requires && typeof data.requires === "object" ? (data.requires as Record<string, unknown>) : undefined;
	const contextCost = parseEnum<ContextCost>(data.context_cost ?? data.contextCost, ["low", "medium", "high"]);

	return {
		portability,
		providers: providers
			? {
					include: parseProviders(providers.include),
					exclude: parseProviders(providers.exclude),
				}
			: undefined,
		requires: requires
			? {
					surfaces: parseStringArray(requires.surfaces).filter(isPortableType),
					commands: parseStringArray(requires.commands),
					env: parseStringArray(requires.env),
				}
			: undefined,
		contextCost,
	};
}

function parseEnum<T extends string>(raw: unknown, allowed: readonly T[]): T | undefined {
	return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

function parseProviders(raw: unknown): ProviderType[] | undefined {
	const providers = parseStringArray(raw).filter(
		(value): value is ProviderType => ProviderType.safeParse(value).success,
	);
	return providers.length > 0 ? providers : undefined;
}

function parseStringArray(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter((value): value is string => typeof value === "string");
}

function isPortableType(value: string): value is PortableType {
	return ["agent", "command", "skill", "config", "rules", "hooks"].includes(value);
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
