import fs from "node:fs";
import path from "node:path";

export type GenericCoreTokenCategory = "provider-tool" | "model-or-tier" | "context-window" | "brand";

export interface GenericCoreTokenFinding {
	file: string;
	line: number;
	token: string;
	category: GenericCoreTokenCategory;
}

interface TokenRule {
	category: GenericCoreTokenCategory;
	pattern: RegExp;
}

const TOKEN_RULES: readonly TokenRule[] = [
	{ category: "provider-tool", pattern: /\bAskUserQuestion\b|\bAgent\s*\(|\bTask\s*\(/g },
	{ category: "model-or-tier", pattern: /\b(?:haiku|sonnet|opus|claude-[a-z0-9.-]+)\b/gi },
	{ category: "context-window", pattern: /\b\d{2,3}K\b|\b(?:[5-9]\d|100)%\s+(?:of\s+)?(?:the\s+)?(?:context|token)\b/gi },
	{ category: "brand", pattern: /\bmeowkit\b/gi },
];

function markdownFiles(root: string, dir = "skills", files: string[] = []): string[] {
	const absolute = path.join(root, dir);
	if (!fs.existsSync(absolute)) return files;
	for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
		const relative = path.join(dir, entry.name);
		if (entry.isDirectory()) markdownFiles(root, relative, files);
		else if (dir !== "skills" && entry.isFile() && entry.name.endsWith(".md")) files.push(relative);
	}
	return files.sort();
}

function bodyLines(content: string): Array<{ text: string; line: number; codeFence: boolean }> {
	const lines = content.split(/\r?\n/);
	const bodyStart = lines[0] === "---" ? lines.indexOf("---", 1) + 1 : 0;
	let codeFence = false;
	return lines.slice(bodyStart).map((text, index) => {
		if (/^\s*```/.test(text)) codeFence = !codeFence;
		return { text, line: bodyStart + index + 1, codeFence };
	});
}

function isCliBrandMention(line: string, index: number, token: string, codeFence: boolean): boolean {
	const before = line.slice(0, index);
	const after = line.slice(index + token.length);
	const lowercaseCommand = token === "mewkit" && /^\s+\S+/.test(after);
	return (
		(lowercaseCommand && /\bnpx\s+$/i.test(before)) ||
		(lowercaseCommand && (before.match(/\`/g)?.length ?? 0) % 2 === 1) ||
		(codeFence && /^\s*(?:[$>]\s*)?(?:npx\s+)?mewkit\b/.test(line))
	);
}

/** Finds provider-specific prose in canonical skill bodies. Initial callers report, not block. */
export function findGenericCoreTokens(root: string, scanDir = "skills"): GenericCoreTokenFinding[] {
	const findings: GenericCoreTokenFinding[] = [];
	for (const file of markdownFiles(root, scanDir)) {
		const lines = bodyLines(fs.readFileSync(path.join(root, file), "utf-8"));
		for (const line of lines) {
			for (const rule of TOKEN_RULES) {
				rule.pattern.lastIndex = 0;
				for (const match of line.text.matchAll(rule.pattern)) {
					if (rule.category === "brand" && isCliBrandMention(line.text, match.index ?? 0, match[0], line.codeFence)) continue;
					findings.push({ file, line: line.line, token: match[0], category: rule.category });
				}
			}
		}
	}
	return findings;
}

/** Compact deterministic baseline for validation output and future cleanup tracking. */
export function summarizeGenericCoreTokens(findings: readonly GenericCoreTokenFinding[]): string {
	const counts = new Map<GenericCoreTokenCategory, number>();
	for (const finding of findings) counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
	return (["provider-tool", "model-or-tier", "context-window", "brand"] as const)
		.map((category) => `${category}=${counts.get(category) ?? 0}`)
		.join(", ");
}
