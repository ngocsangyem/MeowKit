//! Engines that add the kit's entries to user-owned files and take them out again.
//!
//! Each engine is a pure text → text function so it can be property-tested:
//! `strip(merge(user, x)) == user`. Malformed input is an error and the caller
//! leaves the file untouched; writes go through the journal, never from here.
pub mod hook_groups;
pub mod json_entries;
pub mod markdown_block;
pub mod toml_table;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MergeError {
    #[error("cannot parse the file: {0}")]
    Parse(String),
    #[error("{0}")]
    Malformed(String),
}

/// The result of merging named entries into a container (a JSON object or a TOML table).
#[derive(Debug, PartialEq, Eq)]
pub struct EntriesMerged {
    pub text: String,
    /// How many containers along the key path did not exist and were created,
    /// counted from the innermost. Pass it back to `strip` so exactly those
    /// containers are removed once empty, and none the user made.
    pub created: usize,
    /// Names that already existed with a different value and were overwritten.
    pub replaced: Vec<String>,
}
