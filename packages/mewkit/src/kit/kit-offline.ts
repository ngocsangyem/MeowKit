// What `--offline` does when the project cache cannot serve the request.
//
// It refuses, and the refusal names both ways forward. Reaching the network "to
// help" would make `--offline` mean "prefer the cache", which is a different
// promise: a user who passed it because the network is untrusted, metered or
// absent would get a fetch they explicitly ruled out.
//
// A project that has never installed has nothing cached, because the cache is
// project-local by design. That case is served by pointing the release lookup at
// a local directory instead, so the refusal names that environment variable
// rather than leaving the user to discover it.
import { CACHE_REL } from "../core/kit-cache.js";
import type { VerificationFailureRecord } from "./kit-quarantine.js";

/** A refusal that is about the request, not about the artifact's integrity. */
export class OfflineUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "OfflineUnavailableError";
	}
}

/** The cache holds no artifact for this version, and no network may be used. */
export function offlineCacheMissError(version: string): OfflineUnavailableError {
	return new OfflineUnavailableError(
		[
			`Offline install of kit ${version} was stopped: the project cache check found no stored artifact for that version under ${CACHE_REL}.`,
			"No network request was made, because --offline rules one out.",
			"Two ways forward: point MEOWKIT_RELEASE_SOURCE at a directory holding an already-extracted release,",
			"or run `mewkit upgrade` once with network access so this project caches the artifact.",
		].join(" "),
	);
}

/**
 * The cache holds a record of a REFUSED attempt for this version. Reported
 * rather than installed: a verification-failure record is not installable
 * content, and the quarantined bytes beside it are the ones that failed.
 */
export function offlineQuarantinedError(record: VerificationFailureRecord): OfflineUnavailableError {
	return new OfflineUnavailableError(
		[
			`Offline install of kit ${record.version} was stopped: a previous attempt at that version was refused and the project still holds the record of it.`,
			record.message,
			"No network request was made, because --offline rules one out.",
			"Run `mewkit upgrade` once a new release is published.",
		].join(" "),
	);
}
