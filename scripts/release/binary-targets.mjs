// The binary release stream's fixed names, shared by the manifest builder and
// the installer renderer. `crates/mewkit-core/src/update/manifest.rs` holds the
// same target triples and download prefix; the installer and manifest tests
// fail when the two disagree.

/** The six published targets: Linux is static musl, the rest native. */
export const TARGETS = [
	"x86_64-unknown-linux-musl",
	"aarch64-unknown-linux-musl",
	"x86_64-apple-darwin",
	"aarch64-apple-darwin",
	"x86_64-pc-windows-msvc",
	"aarch64-pc-windows-msvc",
];

/** Binary tags; kit tags are `v*` and must never look like these. */
export const TAG_PREFIX = "mewkit-v";

/** Every archive a manifest or an installer pin names lives under this prefix. */
export const DOWNLOAD_PREFIX = "https://github.com/ngocsangyem/MeowKit/releases/download/";

// SemVer 2.0: numeric parts without leading zeros, dot-separated prerelease identifiers.
const NUM = "(0|[1-9]\\d*)";
const PRE_ID = "(0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)";
const VERSION = new RegExp(`^${NUM}\\.${NUM}\\.${NUM}(-${PRE_ID}(\\.${PRE_ID})*)?$`);

/** `version` as given, without a leading `v`, or a thrown error. */
export function checkVersion(version) {
	const v = String(version ?? "").replace(/^v/, "");
	if (!VERSION.test(v)) throw new Error(`${JSON.stringify(version)} is not a version (X.Y.Z or X.Y.Z-pre.N)`);
	return v;
}

/** A prerelease version publishes to the beta channel; anything else to stable. */
export function channelOf(version) {
	return checkVersion(version).includes("-") ? "beta" : "stable";
}

/** The archive asset name for one target: prefixed so no kit selector can match it. */
export function assetName(version, target) {
	return `mewkit-${checkVersion(version)}-${target}.tar.gz`;
}

/** The download URL of one archive of the release tagged `mewkit-v<version>`. */
export function assetUrl(version, target) {
	const v = checkVersion(version);
	return `${DOWNLOAD_PREFIX}${TAG_PREFIX}${v}/${assetName(v, target)}`;
}
