// The public keys a kit manifest signature is accepted from.
//
// The trust root ships with the ENGINE, not with the content it authenticates.
// A keyring delivered alongside the artifact would let whoever replaced the
// artifact replace the keyring too, and every signature would then verify.
// Living in the CLI source means the key a user checks against arrives through
// the npm package they already chose to install.
//
// This list may legitimately be EMPTY, and an empty list does not mean "trust
// anything": verification still runs and fails, because "no key is configured"
// and "the signature is good" are different answers and only one of them is a
// reason to install. The install side names that case specifically so the user
// is told the CLI has no trusted key rather than that the artifact is bad.
//
// Keys are SPKI PEM, as the generation script prints them. Several may be listed
// at once, which is what makes rotation possible without a flag day: publish
// with the new key while the old one is still accepted, then drop the old one.
export const TRUSTED_KIT_KEYS: readonly string[] = [];
