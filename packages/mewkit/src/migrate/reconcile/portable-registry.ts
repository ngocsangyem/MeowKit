// Vendored from claudekit-cli (MIT). Source: src/commands/portable/portable-registry.ts
// Adapted: greenfield in mewkit (no v1/v2 legacy migrations), PID-based lock instead of
// proper-lockfile (avoids new dep), registry path namespaced under ~/.mewkit/.
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { UNKNOWN_CHECKSUM, normalizeChecksum } from "./reconcile-types.js";
import type { PortableType, ProviderType } from "../types.js";

const home = homedir();

export const REGISTRY_PATH = join(home, ".mewkit", "portable-registry.json");
const REGISTRY_LOCK_PATH = join(home, ".mewkit", "portable-registry.lock");
const STALE_LOCK_MS = 60 * 1000;

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
});
export type PortableInstallationV3 = z.infer<typeof PortableInstallationSchemaV3>;

const PortableRegistrySchemaV3 = z.object({
	version: z.literal("3.0"),
	installations: z.array(PortableInstallationSchemaV3),
	lastReconciled: z.string().optional(),
	appliedManifestVersion: z.string().optional(),
});
export type PortableRegistryV3 = z.infer<typeof PortableRegistrySchemaV3>;

function isErrnoCode(error: unknown, code: string): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === code
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
		try { await unlink(tempPath); } catch { /* best-effort */ }
		throw error;
	}
}

/**
 * PID-based file lock. Acquires lock by writing PID; checks staleness via process.kill(pid, 0).
 * Replaces proper-lockfile dependency for mewkit's leaner footprint.
 */
async function acquireRegistryLock(): Promise<void> {
	const lockDir = dirname(REGISTRY_LOCK_PATH);
	if (!existsSync(lockDir)) await mkdir(lockDir, { recursive: true });

	const myPid = process.pid;
	const startTime = Date.now();

	while (true) {
		try {
			const handle = await import("node:fs").then((m) => m.promises.open(REGISTRY_LOCK_PATH, "wx"));
			await handle.writeFile(`${myPid}\n${Date.now()}\n`, "utf-8");
			await handle.close();
			return;
		} catch (err) {
			if (!isErrnoCode(err, "EEXIST")) throw err;
		}

		try {
			const content = await readFile(REGISTRY_LOCK_PATH, "utf-8");
			const [pidStr, tsStr] = content.split("\n");
			const pid = Number.parseInt(pidStr, 10);
			const ts = Number.parseInt(tsStr, 10);

			let alive = false;
			try {
				if (Number.isFinite(pid) && pid > 0) {
					process.kill(pid, 0);
					alive = true;
				}
			} catch {
				alive = false;
			}

			if (!alive || (Number.isFinite(ts) && Date.now() - ts > STALE_LOCK_MS)) {
				try { await unlink(REGISTRY_LOCK_PATH); } catch { /* race */ }
				continue;
			}
		} catch {
			// Lock disappeared or unreadable — retry
		}

		if (Date.now() - startTime > 10_000) {
			throw new Error("Could not acquire portable-registry lock within 10s");
		}
		await new Promise((r) => setTimeout(r, 100));
	}
}

async function releaseRegistryLock(): Promise<void> {
	try {
		await unlink(REGISTRY_LOCK_PATH);
	} catch {
		// Best-effort
	}
}

async function withRegistryLock<T>(operation: () => Promise<T>): Promise<T> {
	await acquireRegistryLock();
	try {
		return await operation();
	} finally {
		await releaseRegistryLock();
	}
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

export function getInstallationsByType(
	registry: PortableRegistryV3,
	type: PortableType,
): PortableInstallationV3[] {
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
