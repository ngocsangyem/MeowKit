// Schema + catalog resolution for the authored Cursor bundle's MCP profile catalog
// (`catalog/mcp-profiles.json`). Split out of cursor-mcp-profiles.ts (merge/apply/lint logic)
// to keep each file under the project's 200-line guideline — this file owns "what profiles
// exist and which ones does a selection resolve to"; the sibling file owns "how a resolved
// profile gets safely merged into a project".
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const McpServerSchema = z
	.object({
		command: z.string().optional(),
		args: z.array(z.string()).optional(),
		env: z.record(z.string(), z.string()).optional(),
		url: z.string().optional(),
		headers: z.record(z.string(), z.string()).optional(),
	})
	.passthrough();
export type McpServerDef = z.infer<typeof McpServerSchema>;

export const McpProfileSchema = z.object({
	description: z.string().default(""),
	transport: z.enum(["stdio", "remote"]),
	mcpServers: z.record(z.string(), McpServerSchema),
});
export type McpProfile = z.infer<typeof McpProfileSchema>;

export const McpProfileCatalogSchema = z.object({
	profiles: z.record(z.string(), McpProfileSchema),
});
export type McpProfileCatalog = z.infer<typeof McpProfileCatalogSchema>;

/** Selection intent, mirrors codex-skill-packs.ts `PackSelection` — but the ABSENT case means
 *  "select nothing" here (deny-by-default), never a catalog default. */
export type McpProfileSelection = "all" | string[];

export function mcpProfileCatalogPath(moduleDir: string): string {
	return join(moduleDir, "catalog", "mcp-profiles.json");
}

/** Load + validate the catalog, or return null when the bundle ships none (pre-Phase-5). */
export function loadMcpProfileCatalog(moduleDir: string): McpProfileCatalog | null {
	const p = mcpProfileCatalogPath(moduleDir);
	if (!existsSync(p)) return null;
	const parsed = McpProfileCatalogSchema.safeParse(JSON.parse(readFileSync(p, "utf-8")));
	if (!parsed.success) {
		throw new Error(
			`invalid mcp-profiles.json: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
		);
	}
	return parsed.data;
}

/** Resolve a selection against the catalog. Throws on an unknown name so a typo fails loudly
 *  instead of silently applying nothing. Empty selection resolves to an empty list — the
 *  deny-by-default contract, unlike skill packs' `defaultPack` fallback. */
export function resolveMcpProfiles(
	catalog: McpProfileCatalog,
	selection: McpProfileSelection,
): Array<{ name: string; profile: McpProfile }> {
	const names = selection === "all" ? Object.keys(catalog.profiles) : selection;
	return names.map((name) => {
		const profile = catalog.profiles[name];
		if (!profile) {
			throw new Error(
				`unknown MCP profile "${name}" (known: ${Object.keys(catalog.profiles).sort().join(", ") || "(none shipped)"})`,
			);
		}
		return { name, profile };
	});
}
