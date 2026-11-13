//! The installed kit version a record carries as provenance.
//!
//! Best effort by design: this is PROVENANCE, never a gate. A project with no
//! install baseline, a baseline mid-write, or one this binary cannot parse all
//! answer "unknown" (the empty string), and the record then keeps whatever
//! version it already carried. Failing an update because the kit version could
//! not be read would make a bookkeeping field authoritative.
use std::path::Path;

use serde_json::Value;

use crate::schema::install_metadata_read::classify;

/// The resolved `metadata.json` to READ: canonical first, then the pre-move
/// location, so upgrading the CLI does not orphan an install.
fn metadata_path(project_root: &Path) -> std::path::PathBuf {
    let canonical = project_root.join(".meowkit").join("metadata.json");
    if canonical.exists() {
        return canonical;
    }
    let legacy = project_root.join(".claude").join("metadata.json");
    if legacy.exists() {
        return legacy;
    }
    canonical
}

/// The installed kit version, or an empty string when there is none to read.
pub fn kit_version(project_root: &Path) -> String {
    let Ok(text) = std::fs::read_to_string(metadata_path(project_root)) else {
        return String::new();
    };
    let Ok(payload) = serde_json::from_str::<Value>(&text) else {
        return String::new();
    };
    match classify(Some(&payload)) {
        Ok((_, Some(meta))) => meta.version,
        _ => String::new(),
    }
}
