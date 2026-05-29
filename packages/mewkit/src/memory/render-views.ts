import fs from "node:fs";
import path from "node:path";
import { CURATED_STORES, type StoreSpec } from "./schemas.js";
import { loadContentValidator, type ContentValidator } from "./validate.js";

// Deterministic JSON→Markdown renderer. Generates human-readable views/*.md from
// the canonical curated JSON stores. Pure transform (no LLM). Output is stable
// (entries sorted by id) for clean diffs, idempotent, and stamped with a banner
// declaring the file generated + non-authoritative. Re-runs validate-content per
// text field (CP-7 defense-in-depth) and annotates flagged entries inline.

const GENERATED_BANNER = (storeFile: string): string =>
	`<!-- GENERATED from ${storeFile} by 'mewkit memory render-views' — do not edit; edits are overwritten. Append new entries to ${storeFile} (the canonical source). -->`;

const LEGACY_MARKER = (storeFile: string, viewFile: string): string =>
	`<!-- NON-AUTHORITATIVE: canonical source is ${storeFile}; generated human view is ${viewFile} (regenerate via 'mewkit memory render-views'). -->`;

function renderScalar(value: unknown): string {
	if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
	return String(value);
}

// Render one entry as a `## ` section. Order fields deterministically: title field
// first, then the remaining keys in a fixed order, then any extra keys sorted.
function renderEntry(entry: Record<string, unknown>, spec: StoreSpec, validator: ContentValidator | null): string {
	const id = String(entry.id ?? "<no-id>");
	const lines: string[] = [`## ${id}`, ""];

	// Inline injection-recheck annotation (audit trail — kept, not dropped).
	if (validator) {
		for (const field of spec.textFields) {
			const text = entry[field];
			if (typeof text === "string" && !validator(text).valid) {
				lines.push(`<!-- WARN: entry ${id} field '${field}' matched an injection pattern — verify manually -->`, "");
			}
		}
	}

	const skip = new Set(["id"]);
	const ordered = Object.keys(entry)
		.filter((k) => !skip.has(k))
		.sort((a, b) => a.localeCompare(b));
	for (const key of ordered) {
		const value = entry[key];
		if (value === undefined || value === null || value === "") continue;
		lines.push(`- **${key}:** ${renderScalar(value)}`);
	}
	lines.push("");
	return lines.join("\n");
}

export function renderStore(data: Record<string, unknown>, spec: StoreSpec, validator: ContentValidator | null): { md: string; flagged: string[] } {
	const items = ((data[spec.itemsKey] as Array<Record<string, unknown>>) ?? [])
		.slice()
		.sort((a, b) => String(a.id).localeCompare(String(b.id)));

	const flagged: string[] = [];
	if (validator) {
		for (const item of items) {
			for (const field of spec.textFields) {
				const text = item[field];
				if (typeof text === "string" && !validator(text).valid) flagged.push(String(item.id));
			}
		}
	}

	const header = [
		GENERATED_BANNER(spec.file),
		"",
		`# ${spec.scope} — generated view`,
		"",
		`> ${items.length} entr${items.length === 1 ? "y" : "ies"} from \`${spec.file}\`. This file is non-authoritative; edit the JSON and re-run \`mewkit memory render-views\`.`,
		"",
	];
	const body = items.map((it) => renderEntry(it, spec, validator)).join("\n");
	return { md: header.join("\n") + "\n" + body, flagged: [...new Set(flagged)] };
}

export interface RenderResult {
	file: string;
	viewPath: string;
	exists: boolean;
	stale: boolean;
	flagged: string[];
	wrote: boolean;
}

// Idempotently prepend a non-authoritative marker to a legacy topic MD file.
function stampLegacyMarker(memoryDir: string, spec: StoreSpec): void {
	const mdName = spec.file.replace(/\.json$/, ".md");
	const mdPath = path.join(memoryDir, mdName);
	if (!fs.existsSync(mdPath)) return;
	const content = fs.readFileSync(mdPath, "utf-8");
	if (content.includes("NON-AUTHORITATIVE:")) return;
	const marker = LEGACY_MARKER(spec.file, `views/${mdName}`);
	fs.writeFileSync(mdPath, `${marker}\n${content}`, "utf-8");
}

export function renderViews(memoryDir: string, opts: { check?: boolean } = {}): RenderResult[] {
	const validator = loadContentValidator(memoryDir);
	const viewsDir = path.join(memoryDir, "views");
	if (!opts.check) fs.mkdirSync(viewsDir, { recursive: true });

	const results: RenderResult[] = [];
	for (const spec of CURATED_STORES) {
		const jsonPath = path.join(memoryDir, spec.file);
		if (!fs.existsSync(jsonPath)) continue;
		let data: Record<string, unknown>;
		try {
			data = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as Record<string, unknown>;
		} catch {
			continue; // invalid JSON is the validator's concern, not the renderer's
		}

		const { md, flagged } = renderStore(data, spec, validator);
		const viewPath = path.join(viewsDir, spec.file.replace(/\.json$/, ".md"));
		const exists = fs.existsSync(viewPath);
		const current = exists ? fs.readFileSync(viewPath, "utf-8") : "";
		const stale = current !== md;

		let wrote = false;
		if (!opts.check && stale) {
			fs.writeFileSync(viewPath, md, "utf-8");
			wrote = true;
		}
		if (!opts.check) stampLegacyMarker(memoryDir, spec);

		results.push({ file: spec.file, viewPath, exists, stale, flagged, wrote });
	}
	return results;
}
