// Schema for the build-time artifact manifest that the `modules/` projection emits
// per provider. Each entry carries source identity, native target path, checksum,
// file mode, and the ownership/merge/scope metadata the reconciler consumes. It
// EXTENDS the existing ownership vocabulary (reconcile/portable-registry.ts) rather
// than paralleling it — one authority per file.
//
// FAIL-CLOSED INVARIANT: an artifact tagged with a user-owned scope (memory / state
// / user-data) can NEVER carry `managed-replace` ownership. This is enforced at the
// schema level so a mis-tagged entry cannot be written, which is what keeps `--force`
// scoped to managed runtime artifacts and unable to clobber user state.
import { z } from "zod";
import { ProviderType } from "../types.js";

/** How reconcile may treat an installed artifact. */
export const ArtifactOwnership = z.enum(["managed-replace", "managed-merge", "user-owned-never-touch"]);
export type ArtifactOwnership = z.infer<typeof ArtifactOwnership>;

/** Classification tags. The user-owned set is protected from managed replacement. */
export const ArtifactScopeTag = z.enum(["managed-runtime", "memory", "state", "telemetry", "cache", "user-data"]);
export type ArtifactScopeTag = z.infer<typeof ArtifactScopeTag>;

/** Scopes that must never be managed-replaced (fail-closed protection surface). */
export const USER_OWNED_SCOPES: ReadonlySet<ArtifactScopeTag> = new Set(["memory", "state", "user-data"]);

export const ArtifactMergeBehavior = z.enum(["replace", "settings-merge", "never"]);
export type ArtifactMergeBehavior = z.infer<typeof ArtifactMergeBehavior>;

export const ArtifactManifestEntrySchema = z
	.object({
		/** Source path relative to the `modules/` tree. */
		sourcePath: z.string().min(1),
		/** Provider-native install target, relative to the project root. */
		targetPath: z.string().min(1),
		provider: ProviderType,
		/** sha256 of the projected artifact (determinism + reconcile base). */
		checksum: z.string().min(1),
		/** POSIX file mode for the installed artifact (e.g. "0644", "0755" for hooks). */
		mode: z.string().regex(/^0[0-7]{3}$/).default("0644"),
		ownership: ArtifactOwnership,
		mergeBehavior: ArtifactMergeBehavior.default("replace"),
		scopeTags: z.array(ArtifactScopeTag).default([]),
	})
	.superRefine((entry, ctx) => {
		const touchesUserOwned = entry.scopeTags.some((t) => USER_OWNED_SCOPES.has(t));
		if (touchesUserOwned && entry.ownership === "managed-replace") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["ownership"],
				message: `artifact tagged user-owned scope (${entry.scopeTags.filter((t) => USER_OWNED_SCOPES.has(t)).join(", ")}) cannot be managed-replace — this would let --force clobber user state`,
			});
		}
	});
export type ArtifactManifestEntry = z.infer<typeof ArtifactManifestEntrySchema>;

export const ArtifactManifestSchema = z.object({
	version: z.literal("1.0"),
	provider: ProviderType,
	/** Source root the manifest was projected from (for audit/traceability). */
	generatedFrom: z.string(),
	entries: z.array(ArtifactManifestEntrySchema),
});
export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;

/** Parse an artifact manifest, or return null (with issues) when invalid/torn. */
export function parseArtifactManifest(
	raw: unknown,
): { manifest: ArtifactManifest } | { manifest: null; issues: z.ZodIssue[] } {
	const parsed = ArtifactManifestSchema.safeParse(raw);
	return parsed.success ? { manifest: parsed.data } : { manifest: null, issues: parsed.error.issues };
}

/** Deterministic serialization: entries sorted by (provider, targetPath) so two
 *  projections of the same inputs are byte-identical. */
export function serializeArtifactManifest(manifest: ArtifactManifest): string {
	const entries = [...manifest.entries].sort((a, b) =>
		a.provider === b.provider ? a.targetPath.localeCompare(b.targetPath) : a.provider.localeCompare(b.provider),
	);
	return `${JSON.stringify({ ...manifest, entries }, null, 2)}\n`;
}
