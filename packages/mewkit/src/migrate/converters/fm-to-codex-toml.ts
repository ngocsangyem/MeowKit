// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/fm-to-codex-toml.ts
// Locks the typed contract that the Phase 8 codex-toml-installer consumes.
import { createHash } from "node:crypto";
import { resolveModel } from "../model-taxonomy.js";
import type { ConversionResult, PortableItem } from "../types.js";
import { escapeTomlMultiline } from "./md-to-toml.js";

const MAX_CODEX_SLUG_LENGTH = 96;

/**
 * Codex TOML field contract — these are the field names the converter emits.
 * Phase 8 installer must read EXACTLY these fields.
 */
export interface CodexAgentToml {
	model?: string; // top-level: model = "..."
	sandbox_mode?: string; // top-level: sandbox_mode = "..."
	developer_instructions: string; // top-level: developer_instructions = """..."""
}

export interface CodexConfigEntry {
	slug: string;
	description: string;
	configFile: string; // "agents/<slug>.toml"
}

function shortHash(value: string): string {
	return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export function toCodexSlug(name: string): string {
	// biome-ignore lint/suspicious/noMisleadingCharacterClass: combining char range for diacritic stripping
	const normalized = name.normalize("NFKD").replace(/[̀-ͯ]/g, "");

	let slug = normalized
		.replace(/[^a-zA-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.toLowerCase();

	if (!slug) slug = `agent_${shortHash(name)}`;
	if (slug.length > MAX_CODEX_SLUG_LENGTH) {
		slug = slug.slice(0, MAX_CODEX_SLUG_LENGTH).replace(/_+$/g, "");
	}
	if (!slug) return `agent_${shortHash(name)}`;
	return slug;
}

function deriveSandboxMode(tools: unknown): { sandboxMode: string | null; warning?: string } {
	if (tools === undefined || tools === null) return { sandboxMode: null };
	if (typeof tools !== "string") {
		return {
			sandboxMode: null,
			warning: `Ignored non-string tools frontmatter (${typeof tools}) while deriving sandbox_mode`,
		};
	}
	if (!tools.trim()) return { sandboxMode: null };

	const toolList = tools
		.split(/[,;|]/)
		.map((t) => t.trim().toLowerCase().replace(/\(.*\)$/, ""))
		.filter(Boolean);

	const hasWrite = toolList.some((t) =>
		["bash", "write", "edit", "multiedit", "notebookedit", "apply_patch", "task"].includes(t),
	);
	const hasRead = toolList.some((t) => ["read", "grep", "glob", "ls", "search"].includes(t));

	if (hasWrite) return { sandboxMode: "workspace-write" };
	if (hasRead) return { sandboxMode: "read-only" };

	return {
		sandboxMode: null,
		warning: `No known read/write tool found in tools frontmatter: "${tools}"`,
	};
}

export function convertFmToCodexToml(item: PortableItem): ConversionResult {
	const warnings: string[] = [];
	const slug = toCodexSlug(item.name);
	const lines: string[] = [];

	const modelResult = resolveModel(item.frontmatter.model, "codex");
	if (modelResult.warning) warnings.push(modelResult.warning);
	if (modelResult.resolved) {
		lines.push(`model = ${JSON.stringify(modelResult.resolved.model)}`);
		if (modelResult.resolved.effort) {
			lines.push(`# effort = ${JSON.stringify(modelResult.resolved.effort)}`);
		}
	} else if (
		typeof item.frontmatter.model === "string" &&
		item.frontmatter.model.trim().length > 0 &&
		item.frontmatter.model.trim() !== "inherit"
	) {
		lines.push(`# model = ${JSON.stringify(item.frontmatter.model.trim())}`);
	}

	const sandboxResult = deriveSandboxMode(item.frontmatter.tools);
	if (sandboxResult.warning) warnings.push(sandboxResult.warning);
	if (sandboxResult.sandboxMode) lines.push(`sandbox_mode = "${sandboxResult.sandboxMode}"`);

	const body = item.body.trim();
	if (body.length === 0) {
		warnings.push(`Agent "${item.name}" has empty body; writing empty developer_instructions`);
	}
	if (lines.length > 0) lines.push("");
	lines.push(`developer_instructions = """\n${escapeTomlMultiline(body)}\n"""`);

	return { content: lines.join("\n"), filename: `${slug}.toml`, warnings };
}

export function buildCodexConfigEntry(name: string, description?: string): string {
	const slug = toCodexSlug(name);
	const desc = description || name;
	return [
		`[agents.${slug}]`,
		`description = ${JSON.stringify(desc)}`,
		`config_file = "agents/${slug}.toml"`,
	].join("\n");
}
