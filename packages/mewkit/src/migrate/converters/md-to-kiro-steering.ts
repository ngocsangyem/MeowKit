// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/md-to-kiro-steering.ts
import type { ConversionResult, PortableItem, ProviderType } from "../types.js";
import { stripClaudeRefs } from "./md-strip.js";

type KiroInclusionMode = "always" | "fileMatch" | "manual" | "auto";

const LANGUAGE_GLOB_MAP: Record<string, string> = {
	typescript: "**/*.{ts,tsx}",
	javascript: "**/*.{js,jsx,mjs,cjs}",
	python: "**/*.py",
	rust: "**/*.rs",
	go: "**/*.go",
	java: "**/*.java",
	kotlin: "**/*.kt",
	swift: "**/*.swift",
	ruby: "**/*.rb",
	php: "**/*.php",
	css: "**/*.{css,scss,sass,less}",
	html: "**/*.{html,htm}",
	markdown: "**/*.md",
	json: "**/*.json",
	yaml: "**/*.{yml,yaml}",
	shell: "**/*.{sh,bash,zsh}",
	react: "**/*.{tsx,jsx}",
	vue: "**/*.vue",
	svelte: "**/*.svelte",
};

const UNSUPPORTED_AGENT_FIELDS = ["model", "tools", "memory", "argumentHint"];

function detectLanguageGlob(itemName: string): string | null {
	const normalized = itemName.toLowerCase();
	const sortedLangs = Object.keys(LANGUAGE_GLOB_MAP).sort((a, b) => b.length - a.length);
	for (const lang of sortedLangs) {
		const patterns = [
			new RegExp(`^${lang}$`),
			new RegExp(`^${lang}[-_]`),
			new RegExp(`[-_]${lang}$`),
			new RegExp(`[-_]${lang}[-_]`),
		];
		if (patterns.some((p) => p.test(normalized))) return LANGUAGE_GLOB_MAP[lang];
	}
	return null;
}

function determineInclusionMode(item: PortableItem): {
	mode: KiroInclusionMode;
	fileMatch?: string;
} {
	const languageGlob = detectLanguageGlob(item.name);
	if (languageGlob) return { mode: "fileMatch", fileMatch: languageGlob };

	const fmDescription = String(item.frontmatter.description || "").toLowerCase();
	const sortedLangs = Object.keys(LANGUAGE_GLOB_MAP).sort((a, b) => b.length - a.length);
	for (const lang of sortedLangs) {
		if (
			fmDescription.includes(` ${lang} `) ||
			fmDescription.startsWith(`${lang} `) ||
			fmDescription.endsWith(` ${lang}`)
		) {
			return { mode: "fileMatch", fileMatch: LANGUAGE_GLOB_MAP[lang] };
		}
	}

	return { mode: "always" };
}

function buildSteeringFrontmatter(mode: KiroInclusionMode, fileMatch?: string): string {
	const lines = ["---"];
	lines.push(`inclusion: ${mode}`);
	if (mode === "fileMatch" && fileMatch) lines.push(`fileMatch: "${fileMatch}"`);
	lines.push("---");
	return lines.join("\n");
}

function checkUnsupportedFields(item: PortableItem): string[] {
	const warnings: string[] = [];
	const present = UNSUPPORTED_AGENT_FIELDS.filter((field) => item.frontmatter[field] !== undefined);
	if (present.length > 0) {
		warnings.push(`Agent metadata not supported by Kiro (dropped): ${present.join(", ")}`);
	}
	return warnings;
}

function bodyStartsWithHeading(body: string): boolean {
	return /^#{1,6}\s+/.test(body.trimStart());
}

export function convertMdToKiroSteering(
	item: PortableItem,
	provider: ProviderType,
): ConversionResult {
	const warnings: string[] = [];

	if (item.type === "agent") warnings.push(...checkUnsupportedFields(item));

	const stripped = stripClaudeRefs(item.body, { provider });
	warnings.push(...stripped.warnings);

	const { mode, fileMatch } = determineInclusionMode(item);
	const frontmatter = buildSteeringFrontmatter(mode, fileMatch);

	const heading = item.frontmatter.name || item.name;
	const hasExistingHeading = bodyStartsWithHeading(stripped.content);

	const content = hasExistingHeading
		? `${frontmatter}\n\n${stripped.content}\n`
		: `${frontmatter}\n\n# ${heading}\n\n${stripped.content}\n`;

	if (mode === "fileMatch" && fileMatch) warnings.push(`Using fileMatch mode with pattern: ${fileMatch}`);

	return { content, filename: `${item.name}.md`, warnings };
}
