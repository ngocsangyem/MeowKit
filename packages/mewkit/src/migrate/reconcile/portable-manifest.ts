import { access, readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, posix } from "node:path";
import semver from "semver";
import { z } from "zod";
import type { PortableRegistryV3 } from "./portable-registry.js";

const PortableTypeSchema = z.enum(["agent", "command", "skill", "config", "rules", "hooks"]);

function safeRelativePathSchema(label: string): z.ZodType<string> {
	return z.string().min(1, `${label} cannot be empty`).refine((value) => {
		if (isAbsolute(value)) return false;
		const normalized = posix.normalize(value.replace(/\\/g, "/"));
		return normalized !== "." && !normalized.startsWith("../") && normalized !== "..";
	}, `${label} must be a safe relative path`);
}

const RenameEntrySchema = z.object({
	from: safeRelativePathSchema("renames.from"),
	to: safeRelativePathSchema("renames.to"),
	type: PortableTypeSchema,
	since: z.string().min(1),
}).strict();

const ProviderPathMigrationEntrySchema = z.object({
	provider: z.string().min(1),
	type: PortableTypeSchema,
	from: safeRelativePathSchema("providerPathMigrations.from"),
	to: safeRelativePathSchema("providerPathMigrations.to"),
	since: z.string().min(1),
}).strict();

const SectionRenameEntrySchema = z.object({
	type: z.enum(["agent", "config", "rules"]),
	from: z.string().min(1),
	to: z.string().min(1),
	since: z.string().min(1),
}).strict();

const PortableEvolutionManifestSchema = z.object({
	version: z.literal("1.0"),
	mewkitVersion: z.string().min(1),
	renames: z.array(RenameEntrySchema),
	providerPathMigrations: z.array(ProviderPathMigrationEntrySchema),
	sectionRenames: z.array(SectionRenameEntrySchema),
}).strict();

export type PortableEvolutionManifest = z.infer<typeof PortableEvolutionManifestSchema>;
export type RenameEntry = PortableEvolutionManifest["renames"][number];
export type ProviderPathMigrationEntry = PortableEvolutionManifest["providerPathMigrations"][number];
export type SectionRenameEntry = PortableEvolutionManifest["sectionRenames"][number];

function compareVersions(a: string | undefined, b: string): number {
	if (!a) return -1;
	const validA = semver.valid(a);
	const validB = semver.valid(b);
	if (validA && validB) return semver.compare(validA, validB);
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function isEntryApplicable(entrySince: string, manifestVersion: string, appliedVersion?: string): boolean {
	if (compareVersions(entrySince, manifestVersion) > 0) return false;
	return compareVersions(appliedVersion, entrySince) < 0;
}

export function filterApplicableManifestEntries(
	manifest: PortableEvolutionManifest,
	registry: Pick<PortableRegistryV3, "appliedManifestVersion">,
): PortableEvolutionManifest {
	return {
		...manifest,
		renames: manifest.renames.filter((entry) =>
			isEntryApplicable(entry.since, manifest.mewkitVersion, registry.appliedManifestVersion),
		),
		providerPathMigrations: manifest.providerPathMigrations.filter((entry) =>
			isEntryApplicable(entry.since, manifest.mewkitVersion, registry.appliedManifestVersion),
		),
		sectionRenames: manifest.sectionRenames.filter((entry) =>
			isEntryApplicable(entry.since, manifest.mewkitVersion, registry.appliedManifestVersion),
		),
	};
}

export function resolvePortableManifestPath(bundledKitDir: string): string {
	if (basename(bundledKitDir) === ".claude") return join(dirname(bundledKitDir), "portable-manifest.json");
	return join(bundledKitDir, "portable-manifest.json");
}

export async function loadPortableEvolutionManifest(
	bundledKitDir: string,
	registry: Pick<PortableRegistryV3, "appliedManifestVersion">,
): Promise<PortableEvolutionManifest | null> {
	const manifestPath = resolvePortableManifestPath(bundledKitDir);
	try {
		await access(manifestPath);
	} catch (error) {
		if (typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			return null;
		}
		throw error;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(manifestPath, "utf-8"));
	} catch (error) {
		throw new Error(`Invalid portable-manifest.json: ${error instanceof Error ? error.message : String(error)}`);
	}

	const result = PortableEvolutionManifestSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(`portable-manifest.json schema mismatch: ${result.error.message}`);
	}

	return filterApplicableManifestEntries(result.data, registry);
}
