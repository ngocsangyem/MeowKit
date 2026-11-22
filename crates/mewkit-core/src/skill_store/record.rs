//! The sidecar's shape and how it is read.
use std::collections::BTreeMap;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::fsx::RelPath;

/// The sidecar schema this binary writes and reads.
pub const SCHEMA_VERSION: u32 = 1;
/// Larger than any real sidecar; a bigger file is refused unread.
const MAX_SIDECAR_BYTES: u64 = 16 * 1024 * 1024;

/// Every skill recorded at one scope, by skill directory (`.claude/skills/fix`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Sidecar {
    pub schema_version: u32,
    pub records: BTreeMap<String, SkillRecord>,
}

impl Default for Sidecar {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            records: BTreeMap::new(),
        }
    }
}

/// Who a skill directory belongs to.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum State {
    /// Installed by the kit and owned by a ledger.
    Kit,
    /// Kit files with some of them replaced whole by the user's stored version.
    Overlaid,
    /// A copy of another skill under a user-owned name.
    Forked,
    /// Not installed by mewkit.
    Local,
}

impl State {
    pub fn label(self) -> &'static str {
        match self {
            Self::Kit => "kit",
            Self::Overlaid => "overlaid",
            Self::Forked => "forked",
            Self::Local => "local",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SkillRecord {
    /// The kit's skill name (`fix` for `.agents/skills/mk-fix`).
    pub name: String,
    pub state: State,
    /// Tree digest of the directory when last indexed.
    pub digest: String,
    /// Runtimes whose ledgers own files here, or `user`.
    pub owners: Vec<String>,
    /// The digest of the tree as the kit installed it (as forked, for a fork).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base: Option<String>,
    /// Earlier digests, oldest first.
    #[serde(default)]
    pub history: Vec<String>,
    /// Hash of the ledger rows this record was built from.
    pub ledger_hash: String,
    /// The ledger changed without this record: kept until the user decides.
    #[serde(default, skip_serializing_if = "is_false")]
    pub unverified: bool,
    /// The user made this directory (never installed by the kit).
    #[serde(default, skip_serializing_if = "is_false")]
    pub user_created: bool,
    /// The skill directory a fork was copied from.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fork_of: Option<String>,
    /// Overlaid files, by path inside the skill.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub overlay: BTreeMap<String, OverlayFile>,
}

/// One file replaced whole by the user's version.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OverlayFile {
    /// The kit's hash for the file when the overlay was made.
    pub base: String,
    /// The kit's hash for the file in the newest kit seen; differs from
    /// `base` when upstream changed the file since.
    pub upstream: String,
    /// The hash of the overlay as it was placed in the skill. A file on disk
    /// that no longer matches was edited in place after.
    pub projected: String,
}

fn is_false(b: &bool) -> bool {
    !*b
}

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("cannot read skill store {path}: {source}")]
    Io { path: String, source: io::Error },
    #[error("skill store {path} is not valid: {reason}")]
    Invalid { path: String, reason: String },
    #[error(
        "skill store {path} has schema {found}, newer than this binary's {SCHEMA_VERSION}; \
         run `mewkit self-update`"
    )]
    Newer { path: String, found: u64 },
    #[error("{0}")]
    Refused(String),
}

impl From<io::Error> for StoreError {
    fn from(source: io::Error) -> Self {
        Self::Io {
            path: String::new(),
            source,
        }
    }
}

impl Sidecar {
    /// Read the sidecar; an absent file is an empty store. Refuses an oversized
    /// file, a newer schema, unknown fields and an unsafe record key.
    pub fn load(file: &Path) -> Result<Self, StoreError> {
        let shown = file.display().to_string();
        let bytes = match read_capped(file, MAX_SIDECAR_BYTES) {
            Ok(Some(bytes)) => bytes,
            Ok(None) => return Ok(Self::default()),
            Err(source) => {
                return Err(StoreError::Io {
                    path: shown,
                    source,
                });
            }
        };
        let invalid = |reason: String| StoreError::Invalid {
            path: shown.clone(),
            reason,
        };
        let raw: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|e| invalid(e.to_string()))?;
        let found = raw
            .get("schema_version")
            .and_then(serde_json::Value::as_u64)
            .ok_or_else(|| invalid("missing schema_version".into()))?;
        if found > u64::from(SCHEMA_VERSION) {
            return Err(StoreError::Newer { path: shown, found });
        }
        let sidecar: Self = serde_json::from_value(raw).map_err(|e| invalid(e.to_string()))?;
        for key in sidecar.records.keys() {
            RelPath::new(key).map_err(|e| invalid(e.to_string()))?;
        }
        Ok(sidecar)
    }

    pub fn to_json(&self) -> Vec<u8> {
        let mut out = serde_json::to_vec_pretty(self).expect("sidecar serializes");
        out.push(b'\n');
        out
    }
}

/// A file's bytes, `None` when absent, refused past `cap`.
pub(crate) fn read_capped(file: &Path, cap: u64) -> io::Result<Option<Vec<u8>>> {
    match std::fs::metadata(file) {
        Ok(m) if m.len() > cap => Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!("larger than {cap} bytes"),
        )),
        Ok(_) => std::fs::read(file).map(Some),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}
