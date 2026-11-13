//! The high-assurance pull-request review pipeline.
//!
//! Six stages, each resumable across sittings through a session id:
//!
//! | stage | what it establishes |
//! | --- | --- |
//! | [`prepare`] | an isolated, SHA-bound capture of ONE diff plus quarantined PR text |
//! | [`read`] | a receipt that an assigned artifact was actually opened |
//! | [`coverage`] | the rebuilt roster against those receipts |
//! | [`compose`] | the deterministic cap table, refused unless coverage is complete |
//! | [`submit`] | the single GitHub write, behind `--reply` and a payload-bound token |
//! | [`cleanup`] | the worktree handed back to its manifest-owned action |
//!
//! ## Two invariants worth stating once
//!
//! **Nothing here approves anything.** The cap table produces a recommendation
//! and a proof bundle; both are evidence a human reads at a gate. `PASS` means
//! "no cap applied", never "approved", and no path writes an approval record.
//!
//! **Pull-request content is DATA.** Title, body, comments, CI text and the
//! code in the worktree are attacker-controlled. They are stored under
//! `untrusted/`, never interpolated into a command (every subprocess takes
//! array argv), and never copied into a derived artifact — the caller search
//! keeps `path:line` citations and drops the matched line for exactly that
//! reason.
pub mod anchors;
pub mod cleanup;
pub mod compose;
mod compose_bundle;
pub mod coverage;
pub mod exec;
pub mod impact_map;
mod impact_scout;
mod patterns;
pub mod pr_target;
pub mod prepare;
pub mod read;
pub mod roster;
pub mod session;
mod sha1;
pub mod submit;
pub mod verdict;

#[cfg(test)]
mod test_session;
