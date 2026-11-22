//! The skill store: one record per installed skill, kept beside the ownership
//! ledger rather than inside it.
//!
//! The ledger knows files, one hash each, per runtime and per scope. A user
//! who overlays, forks or rolls back a skill needs a per-skill identity on top
//! of that: a tree digest, who owns the directory, the digest the kit
//! installed and the digests it held before. That record lives in a sidecar
//! with its own schema version, so the ledger keeps the shape older binaries
//! read (it refuses unknown fields), and an older binary simply ignores the
//! sidecar.
//!
//! The sidecar is built by indexing what is installed. Indexing reads skill
//! files and never writes one, so running it twice leaves the same bytes. Each
//! record keeps a hash of the ledger rows it was built from: when those rows
//! changed and the sidecar did not, another binary changed the install, and
//! the skill is marked `unverified` and kept until the user decides, never
//! rebuilt from the ledger.
mod digest;
mod index;
pub mod keep;
mod overlay;
mod persist;
mod record;
mod rows;
mod trees;

pub use digest::{TreeFile, read_tree, tree_digest};
pub use index::{Observed, Survey, build};
pub use overlay::{
    Approvals, OVERLAY_SCHEMA_VERSION, Overlay, OverlayStore, StoredFile, overlay_files,
    overlay_to_json, stored_copy,
};
pub use persist::{Write, apply};
pub use record::{OverlayFile, SCHEMA_VERSION, Sidecar, SkillRecord, State, StoreError};
pub use rows::{Ledgers, Rows, ledger_rows, mark_unverified, no_rows_hash, skill_key_of};
pub use trees::{RestoredFile, capture, load as load_tree, tree_file};

use crate::fsx::RelPath;

/// Where one scope keeps its store, root-relative.
#[derive(Clone, Debug)]
pub struct StorePaths {
    /// The sidecar, beside the ownership ledgers.
    pub sidecar: RelPath,
    /// Machine-local store state (never shared through git): approvals.
    pub dir: RelPath,
    /// Stored overlays, outside every kit-owned tree; a team may commit them.
    pub overlays: RelPath,
    /// The scope's lock, shared with every lifecycle command.
    pub lock: RelPath,
    /// Where pre-change copies of skill files go.
    pub backups: RelPath,
}

/// How many earlier digests a record remembers.
pub const HISTORY_LIMIT: usize = 20;
