// Migration manifest: the recovery source of truth for a memory-migration run.
// Records per-file source/target/checksum/action/outcome so an interrupted run can
// be resumed or safely abandoned. Written atomically (temp + rename) and re-written
// after each publish so progress is durable. Because the manifest IS the recovery
// authority, its OWN torn/unparsable write must fail closed: `readManifest` returns
// null for anything that does not parse against the schema, and the caller then
// treats the run as ABORT (legacy stays authoritative) rather than partial-resuming.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import * as fsp from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";

export const ManifestEntryOutcome = z.enum(["staged", "published", "quarantined", "aborted", "skipped"]);
export type ManifestEntryOutcome = z.infer<typeof ManifestEntryOutcome>;

export const ManifestEntrySchema = z.object({
	relPath: z.string(),
	sourcePath: z.string(),
	targetClass: z.string(),
	targetRelPath: z.string(),
	checksum: z.string(),
	action: z.string(),
	outcome: ManifestEntryOutcome,
	archived: z.boolean().optional(),
	note: z.string().optional(),
});
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;

export const MigrationManifestSchema = z.object({
	runId: z.string().min(1),
	createdAt: z.string(),
	legacyRoot: z.string(),
	meowkitRoot: z.string(),
	status: z.enum(["in-progress", "complete", "aborted"]),
	entries: z.array(ManifestEntrySchema),
});
export type MigrationManifest = z.infer<typeof MigrationManifestSchema>;

/** Atomic manifest write (temp + rename). Deterministic key order for stable diffs. */
export async function writeManifest(manifestPath: string, manifest: MigrationManifest): Promise<void> {
	await fsp.mkdir(dirname(manifestPath), { recursive: true });
	const body = `${JSON.stringify(manifest, null, 2)}\n`;
	const tmp = `${manifestPath}.tmp.${process.pid}.${createHash("sha1").update(body).digest("hex").slice(0, 8)}`;
	await fsp.writeFile(tmp, body, "utf-8");
	try {
		await fsp.rename(tmp, manifestPath);
	} catch (err) {
		await fsp.rm(tmp, { force: true });
		throw err;
	}
}

/** Fail-closed read: returns null on missing/unreadable/truncated/schema-invalid
 *  manifests. A null result MUST be treated as ABORT by the recovery routine —
 *  never as an empty or resumable run. */
export async function readManifest(manifestPath: string): Promise<MigrationManifest | null> {
	if (!existsSync(manifestPath)) return null;
	try {
		const parsed = MigrationManifestSchema.safeParse(JSON.parse(await fsp.readFile(manifestPath, "utf-8")));
		return parsed.success ? parsed.data : null;
	} catch {
		return null; // truncated / non-JSON — torn write, fail closed
	}
}
