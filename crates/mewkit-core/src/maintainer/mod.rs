//! Generators for the artifacts this repository commits but never hand-edits.
//!
//! The harness substrate view, the count tokens in READMEs and indexes, the docs
//! reference manifest and the generated blocks on the reference pages are all
//! derived from the live `.claude/` tree. Each generator here returns the bytes
//! the committed file must hold; the `bless_*` integration tests compare them
//! byte-for-byte and, under `MEWKIT_BLESS=1`, rewrite the file instead. Keeping
//! the generators in the library (not in a test) lets the same code back both
//! the check and the rewrite, so they cannot disagree.
//!
//! None of this ships to a user's project: it describes the kit source repo.
pub mod docs_manifest;
pub mod generated;
pub mod hooks_inventory;
pub mod line_endings;
pub mod locale_order;
pub mod reference_pages;
pub mod reference_render;
pub mod table_cell;

pub use generated::{GeneratedFile, counts_files, docs_files, substrate_file};
