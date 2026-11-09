// Where unverified kit bytes live, and the one thing a refusal is allowed to
// write.
//
// Quarantine sits inside the project-local cache the install already treats as
// derived and untracked. It is NOT a second cache: there is one cache of kit
// bytes per project, and putting the unverified download inside it keeps that
// true while still giving "verify before extract" somewhere to put the bytes it
// has not yet verified. A home-directory location would be shared by every
// project on the machine, so one project's download would sit where another
// project's deletion decisions are checked against.
//
// A refusal writes exactly one file, the verification-failure record, and only
// here. Writing nothing at all would be simpler but leaves `doctor` unable to
// say WHICH version is unusable without fetching again — and fetching outside
// `init` and `upgrade` is not something a diagnostic should do. The record is
// the third option: it carries the version, the failed check and its subject,
// and no artifact bytes and no key material.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { kitCacheDir } from "../core/kit-cache.js";
import type { KitCheck } from "./kit-refusal.js";
import { refusalMessage } from "./kit-refusal.js";

const ARTIFACTS_DIR = "artifacts";
const QUARANTINE_DIR = "quarantine";
export const FAILURE_RECORD_FILENAME = "verification-failure.json";

/** Per-version storage for a VERIFIED artifact and its manifest and signature. */
export const artifactStoreDir = (root: string, version: string): string =>
	join(kitCacheDir(root), ARTIFACTS_DIR, version);

/** Per-version storage for bytes that have not been verified yet. */
export const quarantineDir = (root: string, version: string): string =>
	join(kitCacheDir(root), QUARANTINE_DIR, version);

export interface VerificationFailureRecord {
	version: string;
	check: KitCheck;
	/** The file the check was looking at, when the check is per-file. */
	subject: string | null;
	/** When the refused attempt happened. */
	attemptedAt: string;
	/** The message the refusal printed, so a later report says the same thing. */
	message: string;
}

/**
 * Record a refused attempt inside quarantine. Best effort: a project whose cache
 * cannot be written is still refused, and losing the record costs a later
 * explanation rather than letting an unverified install through.
 */
export function recordVerificationFailure(
	root: string,
	version: string,
	check: KitCheck,
	subject: string | null,
): void {
	const record: VerificationFailureRecord = {
		version,
		check,
		subject,
		attemptedAt: new Date().toISOString(),
		message: refusalMessage(check, version, subject),
	};
	try {
		const dir = quarantineDir(root, version);
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, FAILURE_RECORD_FILENAME), `${JSON.stringify(record, null, 2)}\n`, "utf-8");
	} catch {
		// Nothing to recover: the refusal itself has already been raised.
	}
}

/** The recorded failure for one version, when quarantine holds one. */
export function readVerificationFailure(root: string, version: string): VerificationFailureRecord | null {
	const file = join(quarantineDir(root, version), FAILURE_RECORD_FILENAME);
	if (!existsSync(file)) return null;
	try {
		const parsed = JSON.parse(readFileSync(file, "utf-8")) as Partial<VerificationFailureRecord>;
		if (typeof parsed.version !== "string" || typeof parsed.check !== "string") return null;
		return {
			version: parsed.version,
			check: parsed.check as KitCheck,
			subject: typeof parsed.subject === "string" ? parsed.subject : null,
			attemptedAt: typeof parsed.attemptedAt === "string" ? parsed.attemptedAt : "",
			message: typeof parsed.message === "string" ? parsed.message : "",
		};
	} catch {
		return null;
	}
}

/**
 * Every recorded failure in the project, newest first, read from quarantine with
 * no network access and no second fetch. This is what lets a diagnostic name the
 * version that cannot be installed.
 */
export function listVerificationFailures(root: string): VerificationFailureRecord[] {
	const base = join(kitCacheDir(root), QUARANTINE_DIR);
	if (!existsSync(base)) return [];
	const records: VerificationFailureRecord[] = [];
	for (const version of readdirSync(base)) {
		const record = readVerificationFailure(root, version);
		if (record !== null) records.push(record);
	}
	records.sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1));
	return records;
}
