// Vendored from claudekit-cli (MIT). Source: src/commands/portable/frontmatter-parser.ts
// Adapted: replaced gray-matter dep with js-yaml + regex fallback (mewkit already ships js-yaml).
import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import type { FrontmatterParseResult, ParsedFrontmatter } from "./types.js";

const FRONTMATTER_LIMITS: Record<string, number> = {
	name: 200,
	description: 500,
	model: 100,
	tools: 1000,
	memory: 50,
	argumentHint: 500,
};

const KNOWN_KEYS: Record<string, keyof ParsedFrontmatter> = {
	name: "name",
	description: "description",
	model: "model",
	tools: "tools",
	memory: "memory",
	"argument-hint": "argumentHint",
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function truncateField(value: string, field: string, warnings: string[]): string {
	const limit = FRONTMATTER_LIMITS[field];
	if (limit && value.length > limit) {
		warnings.push(`Frontmatter field "${field}" truncated to ${limit} characters`);
		return value.slice(0, limit);
	}
	return value;
}

function stripBom(content: string): string {
	return content.replace(/^﻿/, "");
}

function parseFrontmatterFallback(content: string): FrontmatterParseResult | null {
	const fmMatch = content.match(FRONTMATTER_RE);
	if (!fmMatch) return null;

	const fmBlock = fmMatch[1];
	const body = content.slice(fmMatch[0].length);
	const frontmatter: ParsedFrontmatter = {};
	const warnings: string[] = [];

	for (const line of fmBlock.split(/\r?\n/)) {
		const keyMatch = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)/);
		if (!keyMatch) continue;
		const [, rawKey, rawValue] = keyMatch;
		const value = rawValue.replace(/^(['"])(.*)\1$/, "$2").trim();
		if (!value) continue;
		const mapped = KNOWN_KEYS[rawKey];
		if (mapped) {
			frontmatter[mapped] = truncateField(value, String(mapped), warnings);
		} else {
			frontmatter[rawKey] = value;
		}
	}

	return { frontmatter, body: body.trim(), warnings };
}

export function parseFrontmatter(content: string): FrontmatterParseResult {
	const normalized = stripBom(content);
	const match = normalized.match(FRONTMATTER_RE);
	if (!match) return { frontmatter: {}, body: normalized.trim(), warnings: [] };

	const fmBlock = match[1];
	const body = normalized.slice(match[0].length);

	try {
		const data = (yaml.load(fmBlock) ?? {}) as Record<string, unknown>;
		const frontmatter: ParsedFrontmatter = {};
		const warnings: string[] = [];

		const setKnown = (target: keyof ParsedFrontmatter, raw: unknown): void => {
			if (raw === undefined || raw === null) return;
			frontmatter[target] = truncateField(String(raw), String(target), warnings);
		};

		setKnown("name", data.name);
		setKnown("description", data.description);
		setKnown("model", data.model);
		setKnown("tools", data.tools);
		setKnown("memory", data.memory);
		setKnown("argumentHint", data["argument-hint"]);

		for (const [key, value] of Object.entries(data)) {
			if (!(key in frontmatter) && key !== "argument-hint") {
				frontmatter[key] = value;
			}
		}

		return { frontmatter, body: body.trim(), warnings };
	} catch {
		const fallback = parseFrontmatterFallback(normalized);
		if (fallback && Object.keys(fallback.frontmatter).length > 0) return fallback;
		return { frontmatter: {}, body: normalized.trim(), warnings: [] };
	}
}

export async function parseFrontmatterFile(filePath: string): Promise<FrontmatterParseResult> {
	const content = await readFile(filePath, "utf-8");
	return parseFrontmatter(content);
}
