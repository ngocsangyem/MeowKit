// Project-local reconciliation ledger for the authored Codex bundle.
//
// SAME schema + logic as the home-scoped portable registry (reconcile/portable-registry.ts)
// but PER-PROJECT storage: `.meowkit/state/codex-ledger.json`. This is a deliberate
// storage relocation, not a parallel engine — rows are `PortableInstallationV3` and the
// reconcile decision matrix is reused by the caller. Per-project storage makes the
// multi-project cross-match impossible by construction (a project can only read its own
// ledger). The home registry stays the authority for every other provider.
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import {
	PortableRegistrySchemaV3,
	readPortableRegistry,
	type PortableInstallationV3,
	type PortableRegistryV3,
} from "./portable-registry.js";

const EMPTY_LEDGER: PortableRegistryV3 = { version: "3.0", installations: [] };

/** Read + validate the project ledger; a missing file is an empty ledger. */
export async function readCodexLedger(ledgerPath: string): Promise<PortableRegistryV3> {
	try {
		const content = await readFile(ledgerPath, "utf-8");
		const parsed = PortableRegistrySchemaV3.safeParse(JSON.parse(content));
		if (parsed.success) return parsed.data;
		throw new Error(`codex-ledger.json schema mismatch: ${parsed.error.message}`);
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
			return { version: "3.0", installations: [] };
		}
		throw error;
	}
}

/** Atomically persist the project ledger (temp + rename). */
export async function writeCodexLedger(ledgerPath: string, registry: PortableRegistryV3): Promise<void> {
	const dir = dirname(ledgerPath);
	if (!existsSync(dir)) await mkdir(dir, { recursive: true });
	const tempPath = `${ledgerPath}.tmp-${process.pid}-${registry.installations.length}`;
	try {
		await writeFile(tempPath, `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
		await rename(tempPath, ledgerPath);
	} catch (error) {
		try {
			await unlink(tempPath);
		} catch {
			/* best-effort */
		}
		throw error;
	}
}

/** Find the ledger row that installed `targetAbsPath`, or undefined. Path comparison is
 *  resolve-normalized so the same target matches regardless of how the caller spells it. */
export function findCodexLedgerRowByPath(
	registry: PortableRegistryV3,
	targetAbsPath: string,
): PortableInstallationV3 | undefined {
	const wanted = resolve(targetAbsPath);
	return registry.installations.find((i) => resolve(i.path) === wanted);
}

/** Upsert a row by (item, type, provider, global) identity, mutating `registry`. */
export function upsertCodexLedgerRow(registry: PortableRegistryV3, row: PortableInstallationV3): void {
	registry.installations = registry.installations.filter(
		(i) => !(i.item === row.item && i.type === row.type && i.provider === row.provider && i.global === row.global),
	);
	registry.installations.push(row);
}

/** Is `childAbsPath` inside (or equal to) `parentAbsPath`? */
function isInsideProject(parentAbsPath: string, childAbsPath: string): boolean {
	const rel = relative(resolve(parentAbsPath), resolve(childAbsPath));
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * One-time migration: copy codex rows from the HOME registry whose recorded `path`
 * resolves inside `projectRoot` into this project's ledger, so a project installed
 * before the project-local ledger existed keeps its reconcile baseline. Home rows are
 * left untouched (rollback safety). Rows already present in the project ledger (by path)
 * are not duplicated. Returns the number of rows adopted.
 */
export async function adoptHomeRegistryCodexRows(ledgerPath: string, projectRoot: string): Promise<number> {
	const home = await readPortableRegistry();
	const ledger = await readCodexLedger(ledgerPath);
	const existingPaths = new Set(ledger.installations.map((i) => resolve(i.path)));

	let adopted = 0;
	for (const row of home.installations) {
		if (row.provider !== "codex") continue;
		if (!isInsideProject(projectRoot, row.path)) continue;
		if (existingPaths.has(resolve(row.path))) continue;
		ledger.installations.push(row);
		existingPaths.add(resolve(row.path));
		adopted++;
	}

	if (adopted > 0) await writeCodexLedger(ledgerPath, ledger);
	return adopted;
}
