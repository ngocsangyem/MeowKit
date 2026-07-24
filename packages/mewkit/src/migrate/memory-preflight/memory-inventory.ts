// Build the validated inventory + reconciliation plan from discovered legacy files.
// Per file: checksum (streamed sha256), size, taxonomy class, curated-JSON schema
// state, and the action derived by comparing against any existing `.meowkit/` target:
//   missing-target → stage · same-checksum → noop · both-differ → conflict ·
//   invalid curated JSON → quarantine (redirected to memory/legacy/).
// Never overwrites or merges; pure planning.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyMemoryFile } from "./memory-classification-rules.js";
import { looksBinary, scanTextForSecrets, MAX_SCAN_BYTES, type SecretFinding } from "./secret-scan.js";
import type { DiscoveredFile } from "./legacy-memory-discovery.js";
import type { InventoryEntry, PreflightAction, ValidationState } from "./preflight-types.js";
import type { StoreSpec } from "../../memory/schemas.js";

/** Streamed sha256 so a huge legacy dir is never loaded whole into memory. */
export function sha256File(absPath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = createHash("sha256");
		const stream = createReadStream(absPath);
		stream.on("error", reject);
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
	});
}

/** True when the file parses as JSON and satisfies its curated-store schema. */
function isValidCurated(absPath: string, spec: StoreSpec): boolean {
	try {
		return spec.schema.safeParse(JSON.parse(readFileSync(absPath, "utf-8"))).success;
	} catch {
		return false;
	}
}

/** Read + scan a text file for secret-like content. Binary/oversized files return [].
 *  Guards the size cap BEFORE the read so an oversized blob is never materialized in memory. */
function scanFileForSecrets(absPath: string, byteSize: number): SecretFinding[] {
	if (byteSize > MAX_SCAN_BYTES) return []; // too large — skip without reading
	let content: string;
	try {
		content = readFileSync(absPath, "utf-8");
	} catch {
		return []; // unreadable — nothing to scan, checksum/reconcile still runs
	}
	if (looksBinary(content)) return [];
	return scanTextForSecrets(content);
}

/** Redirect a file to `memory/legacy/` (quarantine): preserved, never published as canonical.
 *  Shared by the invalid-curated-JSON and secret-detected paths so both behave identically. */
async function buildQuarantineEntry(
	file: DiscoveredFile,
	meowkitRoot: string,
	checksum: string,
	extra: { validationState: ValidationState; note: string; secretFindings?: SecretFinding[] },
): Promise<InventoryEntry> {
	const legacyRel = join("memory", "legacy", file.relPath).split("\\").join("/");
	const targetAbs = join(meowkitRoot, legacyRel);
	const base = await reconcile(targetAbs, checksum);
	return {
		relPath: file.relPath,
		sourcePath: file.absPath,
		targetClass: "legacy",
		targetRelPath: legacyRel,
		size: file.size,
		checksum,
		validationState: extra.validationState,
		action: base === "stage" ? "quarantine" : base,
		note: extra.note,
		...(extra.secretFindings ? { secretFindings: extra.secretFindings } : {}),
	};
}

/** Compare a staged source checksum against an existing target on disk. */
async function reconcile(targetAbs: string, sourceChecksum: string): Promise<PreflightAction> {
	if (!existsSync(targetAbs)) return "stage";
	try {
		return (await sha256File(targetAbs)) === sourceChecksum ? "noop" : "conflict";
	} catch {
		return "conflict"; // unreadable target — surface, never silently overwrite
	}
}

/** Build one inventory entry (checksum, validation, action) for a discovered file. */
export async function buildEntry(file: DiscoveredFile, meowkitRoot: string): Promise<InventoryEntry> {
	const cls = classifyMemoryFile(file.relPath);

	// Symlinks are recorded but never staged (symlink-escape safety).
	if (file.isSymlink) {
		return {
			relPath: file.relPath,
			sourcePath: file.absPath,
			targetClass: cls.targetClass,
			targetRelPath: cls.targetRelPath,
			size: 0,
			checksum: null,
			validationState: "symlink",
			action: "skip",
			note: "symlink — recorded, not followed or staged",
		};
	}

	// Tracked `.gitkeep` marker stays in `.claude/memory/`.
	if (cls.targetClass === "retain") {
		return {
			relPath: file.relPath,
			sourcePath: file.absPath,
			targetClass: "retain",
			targetRelPath: "",
			size: file.size,
			checksum: null,
			validationState: "skipped",
			action: "skip",
			note: "tracked marker retained in place",
		};
	}

	const checksum = await sha256File(file.absPath);

	// Secret scan (text files only; binary caches skipped). A hit quarantines the file to
	// memory/legacy/ and reports it — never deletes, never publishes it as a canonical store.
	if (cls.targetClass !== "cache") {
		const secretFindings = scanFileForSecrets(file.absPath, file.size);
		if (secretFindings.length > 0) {
			// The scan short-circuits BEFORE schema validation, so a curated store quarantined for
			// a secret was never schema-checked — report "unchecked", never a fabricated "valid".
			return buildQuarantineEntry(file, meowkitRoot, checksum, {
				validationState: "unchecked",
				note: `secret-like content detected (${secretFindings.length}) — quarantined, not published`,
				secretFindings,
			});
		}
	}

	// Curated JSON: invalid content is quarantined into memory/legacy/, never
	// published as a canonical store.
	if (cls.curatedStore) {
		if (!isValidCurated(file.absPath, cls.curatedStore)) {
			return buildQuarantineEntry(file, meowkitRoot, checksum, {
				validationState: "invalid",
				note: "curated JSON failed schema — quarantined, not published",
			});
		}
	}

	const targetAbs = join(meowkitRoot, cls.targetRelPath);
	const action = await reconcile(targetAbs, checksum);
	return {
		relPath: file.relPath,
		sourcePath: file.absPath,
		targetClass: cls.targetClass,
		targetRelPath: cls.targetRelPath,
		size: file.size,
		checksum,
		validationState: cls.curatedStore ? "valid" : "unchecked",
		action,
	};
}
