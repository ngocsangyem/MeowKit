// The machine record of every runtime fact the reference docs restate.
//
// The point is drift detection, not a second inventory. Each entry carries the source path and
// a hash of the file it came from, so editing a SKILL.md changes the manifest, and a manifest
// that no longer matches its committed copy means the docs were not regenerated. That is the
// whole contract; everything else here exists to make an entry stable enough to diff.
//
// `visibility` deliberately has no default. The audit's red team asked for fail-closed
// classification, and the coverage gate already provides it — an artifact with no reference
// page fails CI. So this field records the resolved answer rather than inventing a taxonomy:
// `internal` when the artifact declares it, `public` when a reference page documents it, and
// `unclassified` when neither holds, which the coverage gate then rejects.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildInventory, readFrontmatter, type InventoryEntry } from "./build-inventory.js";
import { hashFile } from "./compute-checksums.js";

export type Visibility = "public" | "internal" | "unclassified";

export interface DocsReferenceEntry {
	id: string;
	kind: "skill" | "agent";
	title: string;
	description: string;
	sourcePath: string;
	sourceHash: string;
	aliases: string[];
	owner: string;
	/**
	 * Workflow phase anchor, only when the artifact declares one. Null means undeclared, NOT
	 * "not phase-anchored" — 40 agent pages document a real phase that no frontmatter carries,
	 * so defaulting to `on-demand` here would assert the opposite of the truth for most agents.
	 */
	phase: string | null;
	runtime: string;
	visibility: Visibility;
	/** `criticality` in the inventory; named for what it measures. */
	risk: string;
	dependencies: string[];
	/** Paths or patterns the artifact declares it writes. */
	output: string[];
	/** Only ever a declared value. A generated timestamp would assert a check nobody ran. */
	lastVerified: string | null;
}

export interface DocsReferenceManifest {
	schemaVersion: "1.0";
	entries: DocsReferenceEntry[];
}

/** Turn `plan-creator` into `Plan Creator` when nothing declares a title. */
function humanize(id: string): string {
	return id
		.split("-")
		.map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
		.join(" ");
}

/**
 * The reference page's filename for an artifact.
 *
 * Derived from the source path rather than the id, because the id carries a namespace prefix
 * (`mk:cook`) that the page filename does not (`cook.mdx`) — and because this is exactly how the
 * coverage gate maps the two. Deriving it any other way means the manifest and the gate can
 * disagree about whether the same artifact is documented.
 */
function pageSlug(inv: InventoryEntry, kind: "skill" | "agent"): string {
	const parts = inv.path.split(/[\\/]/);
	// `skills/cook/SKILL.md` → the directory; `agents/planner.md` → the basename.
	return kind === "skill" ? (parts[parts.length - 2] ?? "") : (parts[parts.length - 1] ?? "").replace(/\.md$/, "");
}

function stringField(meta: Record<string, unknown>, key: string): string | null {
	const value = meta[key];
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * A scalar that may legitimately be written unquoted in YAML.
 *
 * `phase: 3` parses as a number, and a string-only reader drops it — recording "undeclared" for
 * an artifact that declared it plainly. That is precisely the silent loss this manifest exists
 * to prevent, so scalars are read as scalars and normalized to text.
 */
function scalarField(meta: Record<string, unknown>, key: string): string | null {
	const value = meta[key];
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	return stringField(meta, key);
}

function stringList(meta: Record<string, unknown>, key: string): string[] {
	const value = meta[key];
	if (!Array.isArray(value)) return [];
	return value.filter((v): v is string => typeof v === "string");
}

/**
 * Keep only values from the inventory's ownership parse that are actually paths.
 *
 * That parser reads an agent's prose ownership declaration, and on several agents it captures
 * whole fenced code blocks and example commands alongside the real paths. Recording those as
 * "artifacts this writes" would publish a parse failure as a fact — and rendering one broke the
 * MDX build outright, because a captured block contained `<args>`.
 *
 * The filter is deliberately strict: a real owned path here has no whitespace, no backticks, and
 * no angle brackets. Anything else is dropped rather than cleaned, because guessing at what a
 * mangled capture meant is how a wrong fact gets a confident presentation.
 */
function ownedPaths(values: string[]): string[] {
	const kept = values.filter((v) => v.length <= 120 && /^[^\s`<>\n]+$/.test(v) && /[/.]/.test(v));
	return [...new Set(kept)].sort();
}

/**
 * Resolve visibility without inventing a taxonomy.
 *
 * An explicit `visibility:` in frontmatter wins, because an author saying "internal" is the only
 * signal that means it. Otherwise a reference page is the evidence: documented means public.
 * Neither is `unclassified`, which the coverage gate fails on — the fail-closed property the red
 * team asked for, kept in the one place that already enforces it.
 *
 * `user-invocable: false` is NOT read as internal. All nine skills declaring it carry public
 * pages today: not directly invocable means auto-invoked, not secret.
 */
function resolveVisibility(meta: Record<string, unknown>, hasReferencePage: boolean): Visibility {
	const declared = stringField(meta, "visibility");
	if (declared === "internal" || declared === "public") return declared;
	return hasReferencePage ? "public" : "unclassified";
}

function entryFor(
	inv: InventoryEntry,
	kind: "skill" | "agent",
	claudeDir: string,
	docsReferenceDir: string | null,
): DocsReferenceEntry {
	const abs = join(claudeDir, inv.path);
	const meta = readFrontmatter(abs);
	const pagePath = docsReferenceDir ? join(docsReferenceDir, `${kind}s`, `${pageSlug(inv, kind)}.mdx`) : null;

	return {
		id: inv.id,
		kind,
		title: stringField(meta, "title") ?? stringField(meta, "name") ?? humanize(inv.id),
		description: stringField(meta, "description") ?? "",
		sourcePath: inv.path,
		sourceHash: existsSync(abs) ? hashFile(abs) : "",
		aliases: stringList(meta, "aliases"),
		owner: inv.owner,
		phase: scalarField(meta, "phase"),
		runtime: inv.runtime,
		visibility: resolveVisibility(meta, pagePath !== null && existsSync(pagePath)),
		risk: inv.criticality,
		dependencies: [...(inv.dependsOn ?? [])].sort(),
		output: ownedPaths(inv.ownedArtifacts ?? []),
		lastVerified: stringField(meta, "last_verified"),
	};
}

/**
 * Build the manifest for an installed `.claude/`.
 *
 * `docsReferenceDir` points at `content/docs/reference` when the docs package is present; pass
 * null in a consumer checkout, where every artifact then resolves `unclassified` rather than
 * silently claiming to be public.
 */
export function buildDocsReferenceManifest(claudeDir: string, docsReferenceDir: string | null): DocsReferenceManifest {
	const { entries: inventory } = buildInventory(claudeDir);
	const entries: DocsReferenceEntry[] = [];

	for (const inv of inventory) {
		if (inv.type !== "skill" && inv.type !== "agent") continue;
		entries.push(entryFor(inv, inv.type, claudeDir, docsReferenceDir));
	}

	entries.sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind)));
	return { schemaVersion: "1.0", entries };
}

/** Stable serialization: the committed copy is diffed byte-for-byte, so formatting is a contract. */
export function serializeDocsReferenceManifest(manifest: DocsReferenceManifest): string {
	return JSON.stringify(manifest, null, 2) + "\n";
}
