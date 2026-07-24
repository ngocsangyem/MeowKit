// Adapted: greenfield in mewkit (no v1/v2 legacy migrations), PID-based lock (extracted to
// portable-registry-lock.ts), registry path namespaced under ~/.mewkit/.
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { UNKNOWN_CHECKSUM, normalizeChecksum } from "./reconcile-types.js";
import { withRegistryLock } from "./portable-registry-lock.js";
import type { PortableType, ProviderType } from "../types.js";

export const REGISTRY_PATH = join(homedir(), ".mewkit", "portable-registry.json");

const PortableInstallationSchemaV3 = z.object({
	item: z.string(),
	type: z.enum(["agent", "command", "skill", "config", "rules", "hooks"]),
	provider: z.string(),
	global: z.boolean(),
	path: z.string(),
	installedAt: z.string(),
	sourcePath: z.string(),
	cliVersion: z.string().optional(),
	sourceChecksum: z.string(),
	targetChecksum: z.string(),
	installSource: z.enum(["kit", "manual"]),
	ownedSections: z.array(z.string()).optional(),
	// Optional back-reference to the installed MeowKit metadata this asset was
	// exported from. Additive-optional: registries written before these fields
	// existed still validate, so no schema version bump is required.
	installedVersion: z.string().optional(),
	installedChecksum: z.string().optional(),
});
export type PortableInstallationV3 = z.infer<typeof PortableInstallationSchemaV3>;

export const PortableRegistrySchemaV3 = z.object({
	version: z.literal("3.0"),
	installations: z.array(PortableInstallationSchemaV3),
	lastReconciled: z.string().optional(),
	appliedManifestVersion: z.string().optional(),
});
export type PortableRegistryV3 = z.infer<typeof PortableRegistrySchemaV3>;

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === code
	);
}

function normalizeInstallationChecksums(i: PortableInstallationV3): PortableInstallationV3 {
	return {
		...i,
		sourceChecksum: normalizeChecksum(i.sourceChecksum),
		targetChecksum: normalizeChecksum(i.targetChecksum),
	};
}

function normalizePortableRegistryChecksums(registry: PortableRegistryV3): PortableRegistryV3 {
	return {
		...registry,
		installations: registry.installations.map(normalizeInstallationChecksums),
	};
}

function getCliVersion(): string {
	return process.env.npm_package_version ?? "unknown";
}

export async function readPortableRegistry(): Promise<PortableRegistryV3> {
	try {
		const content = await readFile(REGISTRY_PATH, "utf-8");
		const data = JSON.parse(content);
		const result = PortableRegistrySchemaV3.safeParse(data);
		if (result.success) return normalizePortableRegistryChecksums(result.data);
		throw new Error(`portable-registry.json schema mismatch: ${result.error.message}`);
	} catch (error) {
		if (isErrnoCode(error, "ENOENT")) {
			return { version: "3.0", installations: [] };
		}
		throw error;
	}
}

export async function writePortableRegistry(registry: PortableRegistryV3): Promise<void> {
	const dir = dirname(REGISTRY_PATH);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });

	const normalized = normalizePortableRegistryChecksums(registry);
	const tempPath = `${REGISTRY_PATH}.tmp-${process.pid}-${Date.now()}`;
	try {
		await writeFile(tempPath, JSON.stringify(normalized, null, 2), "utf-8");
		await rename(tempPath, REGISTRY_PATH);
	} catch (error) {
		try {
			await unlink(tempPath);
		} catch {
			/* best-effort */
		}
		throw error;
	}
}

export async function updateAppliedManifestVersion(mewkitVersion: string): Promise<void> {
	await withRegistryLock(async () => {
		const registry = await readPortableRegistry();
		registry.appliedManifestVersion = mewkitVersion;
		await writePortableRegistry(registry);
	});
}

export async function addPortableInstallation(
	item: string,
	type: PortableType,
	provider: ProviderType,
	global: boolean,
	path: string,
	sourcePath: string,
	options?: {
		sourceChecksum?: string;
		targetChecksum?: string;
		ownedSections?: string[];
		installSource?: "kit" | "manual";
		installedVersion?: string;
		installedChecksum?: string;
	},
): Promise<void> {
	await withRegistryLock(async () => {
		const registry = await readPortableRegistry();
		registry.installations = registry.installations.filter(
			(i) => !(i.item === item && i.type === type && i.provider === provider && i.global === global),
		);

		registry.installations.push({
			item,
			type,
			provider,
			global,
			path,
			installedAt: new Date().toISOString(),
			sourcePath,
			cliVersion: getCliVersion(),
			sourceChecksum: normalizeChecksum(options?.sourceChecksum) || UNKNOWN_CHECKSUM,
			targetChecksum: normalizeChecksum(options?.targetChecksum) || UNKNOWN_CHECKSUM,
			installSource: options?.installSource ?? "kit",
			ownedSections: options?.ownedSections,
			installedVersion: options?.installedVersion,
			installedChecksum: options?.installedChecksum,
		});

		await writePortableRegistry(registry);
	});
}

export async function removePortableInstallation(
	item: string,
	type: PortableType,
	provider: ProviderType,
	global: boolean,
): Promise<PortableInstallationV3 | null> {
	return withRegistryLock(async () => {
		const registry = await readPortableRegistry();
		const index = registry.installations.findIndex(
			(i) => i.item === item && i.type === type && i.provider === provider && i.global === global,
		);
		if (index === -1) return null;
		const [removed] = registry.installations.splice(index, 1);
		await writePortableRegistry(registry);
		return removed;
	});
}

export function findPortableInstallations(
	registry: PortableRegistryV3,
	item: string,
	type?: PortableType,
	provider?: ProviderType,
	global?: boolean,
): PortableInstallationV3[] {
	return registry.installations.filter((i) => {
		if (i.item.toLowerCase() !== item.toLowerCase()) return false;
		if (type && i.type !== type) return false;
		if (provider && i.provider !== provider) return false;
		if (global !== undefined && i.global !== global) return false;
		return true;
	});
}

export function getInstallationsByType(registry: PortableRegistryV3, type: PortableType): PortableInstallationV3[] {
	return registry.installations.filter((i) => i.type === type);
}

export async function syncPortableRegistry(): Promise<{ removed: PortableInstallationV3[] }> {
	return withRegistryLock(async () => {
		const registry = await readPortableRegistry();
		const removed: PortableInstallationV3[] = [];
		registry.installations = registry.installations.filter((i) => {
			if (!existsSync(i.path)) {
				removed.push(i);
				return false;
			}
			return true;
		});
		if (removed.length > 0) await writePortableRegistry(registry);
		return { removed };
	});
}
