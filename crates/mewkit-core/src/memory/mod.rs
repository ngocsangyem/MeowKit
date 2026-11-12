//! The committed team-memory store: content scan, obfuscation passes and lint.
//!
//! Rust port of the TypeScript state layer that owns the ONE content gate every
//! memory writer shares (`state/memory-content-scan.ts`,
//! `state/injection-scanner.ts`, `state/obfuscation-passes.ts`,
//! `core/check-memory-store.ts`, `core/walk-memory-store.ts`). Finding kinds,
//! detail strings and verdicts are identical: the CLI and CI print them, and the
//! installed hooks must reject exactly what the lint rejects.
//!
//! ## Regex semantics
//!
//! `\b`, `\w`, `\d` and `\s` do NOT mean the same thing in the two engines, and
//! the difference is not a safe one in either direction: Unicode `\b` is not a
//! boundary next to `é`, so `éjailbreak` matched in JavaScript and not here,
//! while `\p{White_Space}` omits the U+FEFF that a JS `\s` matches. Every
//! pattern in this module is therefore compiled through [`crate::js_regex`],
//! which restores the ECMAScript meanings. The claim this comment used to make
//! — that Rust flags a strict superset, so the divergence was fail-closed — was
//! FALSE for `\b` and for `\s`. `tests/injection_parity.rs` now pins the
//! pattern tables against the TypeScript source, and
//! `tests/injection_differential.rs` pins the verdicts against Node, so the
//! property is proved rather than asserted in prose.
//!
//! ## Remaining differences from the TypeScript original
//!
//! * `(?i)` folds case per Unicode here and per ASCII in a non-`u` `RegExp`, so
//!   `(?i)[A-Za-z]` additionally matches U+212A and U+017F. That direction flags
//!   MORE, never less.
//! * Sizes in bytes are identical (UTF-8 both sides). Sizes in CHARACTERS use
//!   UTF-16 code units, which is what JS `String.length` counts, so the flood
//!   floor and the shared-field width do not move for a non-ASCII store.
//! * `walk_store` orders entries case-folded-then-raw instead of by ICU
//!   `localeCompare`. Finding ORDER can differ from the TS output for exotic
//!   filenames; no verdict depends on it.
//! * NFKC comes from `unicode-normalization`, so an exotic character added in a
//!   newer Unicode version than the crate's table could fold differently than in
//!   Node's ICU.
mod check_result;
mod check_store;
mod content_scan;
mod errno;
mod finding;
mod flood;
mod injection_patterns;
mod normalize;
mod obfuscation_passes;
mod scrub_patterns;
mod walk_store;

pub use check_result::{CheckStatus, MemoryCheckResult, check_memory_store};
pub use check_store::{
    MEMORY_FILE_MAX_BYTES, MEMORY_FILE_MAX_LINES, MemoryFinding, find_memory_store_findings,
};
pub use content_scan::{count_lines, scan_memory_content, scan_memory_content_capped, split_lines};
pub use errno::errno_of;
pub use finding::{ContentFinding, MemoryFindingKind};
pub use flood::{is_flood, measured_lines};
pub use injection_patterns::{
    INJECTION_PATTERN_SOURCES, InjectionHit, pattern_count as injection_pattern_count,
    validate_content,
};
pub use normalize::{normalize_for_scan, utf16_len};
pub use obfuscation_passes::{
    MAX_CONTENT_BYTES, MAX_SCAN_LINE_BYTES, decode_base64_blocks, decode_passes,
    extract_html_comments, percent_decode, rot13,
};
pub use scrub_patterns::{
    SCRUB_PATTERN_SOURCES, has_secret, pattern_count as scrub_pattern_count, scrub_secrets,
};
pub use walk_store::{ReadForScan, StoreWalk, UnreadablePath, read_for_scan, walk_store};

#[cfg(test)]
#[path = "content_scan_tests.rs"]
mod content_scan_tests;

#[cfg(test)]
#[path = "content_scan_bounds_tests.rs"]
mod content_scan_bounds_tests;

#[cfg(test)]
#[path = "obfuscation_tests.rs"]
mod obfuscation_tests;

#[cfg(test)]
#[path = "injection_scanner_tests.rs"]
mod injection_scanner_tests;
