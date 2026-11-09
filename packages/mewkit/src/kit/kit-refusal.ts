// What a refused kit artifact says, and the vocabulary it says it in.
//
// "Verification failed" is not an actionable message: an absent signature, a
// signature from a key this CLI does not list, and a flipped bit in one inner
// file have three different remedies, and a user told only that something failed
// has to guess which. So the failing check is a closed set of named values, each
// paired with the file it was checking and one concrete next action.
//
// What these messages deliberately do NOT carry: a stack frame, an internal
// class name, a temp path, or a raw crypto error string. Those name the CLI's
// own internals rather than the user's situation, and a crypto library's error
// text can quote key bytes.

/** The checks an artifact can fail. Closed, so a message cannot be vague. */
export type KitCheck =
	| "signature-absent"
	| "signature-malformed"
	| "signature-untrusted-key"
	| "no-trusted-key"
	| "manifest-malformed"
	| "artifact-digest"
	| "artifact-unreadable"
	| "file-digest"
	| "file-missing"
	| "file-unexpected"
	| "member-path-unsafe";

const WHAT_FAILED: Record<KitCheck, string> = {
	"signature-absent": "the kit manifest carries no signature",
	"signature-malformed": "the kit manifest signature is not a readable ed25519 signature",
	"signature-untrusted-key": "the kit manifest signature is from a key this CLI does not trust",
	"no-trusted-key": "this CLI lists no trusted kit signing key, so no signature can be accepted",
	"manifest-malformed": "the kit manifest is not a readable manifest",
	"artifact-digest": "the kit artifact does not match the digest its manifest records",
	"artifact-unreadable": "the kit artifact could not be read as an archive",
	"file-digest": "a file inside the kit artifact does not match the digest its manifest records",
	"file-missing": "a file the kit manifest records is absent from the artifact",
	"file-unexpected": "the kit artifact carries a file its manifest does not record",
	"member-path-unsafe": "a file inside the kit artifact would be written outside the install directory",
};

const NEXT_ACTION: Record<KitCheck, string> = {
	"signature-absent": "Re-run once a signed release is published; this one cannot be verified.",
	"signature-malformed": "Re-run once a correctly signed release is published.",
	"signature-untrusted-key": "Upgrade the mewkit CLI, which ships the trusted keys, then re-run.",
	"no-trusted-key": "Upgrade the mewkit CLI to a version that ships a trusted kit key, then re-run.",
	"manifest-malformed": "Re-run once a new release is published.",
	"artifact-digest": "Re-run once a new release is published; the download cannot be trusted as it stands.",
	"artifact-unreadable": "Re-run once a new release is published.",
	"file-digest": "Re-run once a new release is published.",
	"file-missing": "Re-run once a new release is published.",
	"file-unexpected": "Re-run once a new release is published.",
	"member-path-unsafe": "Re-run once a new release is published; report the version to the maintainers.",
};

/**
 * A terminal refusal. The install stops, writes nothing outside quarantine, and
 * does not fall back to another source — a fallback to the unverified path would
 * mean a tampered artifact silently downgrades the user to the very path the
 * artifact exists to replace.
 */
export class KitVerificationError extends Error {
	constructor(
		readonly check: KitCheck,
		/** The version the attempt was for. */
		readonly version: string,
		/** The file the check was looking at, when the check is per-file. */
		readonly subject: string | null,
	) {
		super(refusalMessage(check, version, subject));
		this.name = "KitVerificationError";
	}
}

/** One sentence naming the failed check, its subject, and the next action. */
export function refusalMessage(check: KitCheck, version: string, subject: string | null): string {
	const where = subject === null ? "" : ` (${subject})`;
	return [
		`Kit ${version} was not installed: ${WHAT_FAILED[check]}${where}.`,
		"The install was stopped rather than downgraded to an unverified source, so nothing was written.",
		NEXT_ACTION[check],
	].join(" ");
}
