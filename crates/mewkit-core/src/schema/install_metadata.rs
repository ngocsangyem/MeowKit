//! Canonical installed-metadata model for a MeowKit install.
//!
//! This is the strict reader for a `schemaVersion`-bearing `metadata.json`: a
//! file that CLAIMS the canonical shape and then fails validation is corrupt,
//! and corrupt is reported rather than fallen through, because falling through
//! would silently downgrade a real install to "nothing installed" and let the
//! next write overwrite per-file ownership that took an upgrade to compute.
//!
//! The lenient adoption reader in [`crate::adopt`] stays as it is: it reads a
//! foreign install opportunistically and must tolerate what it cannot parse.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{Validation, require_non_empty};

pub const INSTALL_METADATA_FILENAME: &str = "metadata.json";
pub const INSTALL_METADATA_SCHEMA_VERSION: &str = "1.0";

/// Who owns an installed file now. `meowkit-modified` is a kit file the user
/// edited — the distinction an upgrade needs to keep those edits.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FileOwner {
    Meowkit,
    User,
    MeowkitModified,
}

/// Which layer the file belongs to. `user` files are never kit-owned.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileLayer {
    Core,
    Skill,
    User,
}

/// How the installed content arrived. A CLOSED set, so an unexpected value is a
/// validation error rather than a free string nothing can assert against. New
/// installs record `release-zip` or `local-release-dir`; the other two stay
/// readable because older CLIs wrote them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallOrigin {
    VerifiedArtifact,
    ReleaseZip,
    LocalReleaseDir,
    LocalCache,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum InstallTarget {
    ClaudeCode,
    Codex,
    Cursor,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InstallDelivery {
    Native,
    Plugin,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallFileEntry {
    pub path: String,
    pub owner: FileOwner,
    pub layer: FileLayer,
    pub checksum: String,
    /// The as-shipped hash this file is compared against on the next upgrade.
    pub base_checksum: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub installed_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_timestamp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub installed_at: Option<String>,
}

/// What produced this install, beside what it produced. Absent on anything
/// installed before the record existed, which reads back as unknown rather than
/// as an error or an invented value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProvenance {
    pub kit_version: String,
    pub cli_version: String,
    pub target: InstallTarget,
    pub delivery: InstallDelivery,
    pub origin: InstallOrigin,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MergedSettings {
    pub merged: Vec<String>,
}

pub(super) fn default_tool() -> String {
    "meowkit".to_string()
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallMetadata {
    pub schema_version: String,
    #[serde(default = "default_tool")]
    pub tool: String,
    /// The installed KIT version. Every reader depends on this name.
    pub version: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    pub installed_at: String,
    pub files: Vec<InstallFileEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings: Option<MergedSettings>,
    /// Installed profile name (`full` for a whole-tree install).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
    /// Resolved pack list for a partial install. Absent is the "full, adopt new
    /// packs on upgrade" sentinel — never a frozen all-packs list.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub packs: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provenance: Option<InstallProvenance>,
}

/// A `metadata.json` that carries `schemaVersion` but does not validate.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("Corrupt install metadata.json: {detail}")]
pub struct CorruptInstallMetadata {
    pub detail: String,
}

impl InstallMetadata {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if self.schema_version != INSTALL_METADATA_SCHEMA_VERSION {
            errors.push(format!(
                "schemaVersion: must be \"{INSTALL_METADATA_SCHEMA_VERSION}\""
            ));
        }
        for (i, file) in self.files.iter().enumerate() {
            require_non_empty(&format!("files.{i}.path"), &file.path, &mut errors);
        }
        Validation::new(errors)
    }

    /// Parse a canonical `metadata.json`. A `schemaVersion`-bearing file that
    /// fails is [`CorruptInstallMetadata`] — never a silent "no install".
    pub fn parse(value: &Value) -> Result<Self, CorruptInstallMetadata> {
        let meta: Self =
            serde_json::from_value(value.clone()).map_err(|e| CorruptInstallMetadata {
                detail: e.to_string(),
            })?;
        let checked = meta.validate();
        if checked.ok {
            Ok(meta)
        } else {
            Err(CorruptInstallMetadata {
                detail: checked.errors.join("; "),
            })
        }
    }

    /// Index this install's file entries by their `.claude/`-relative path.
    pub fn index_by_path(&self) -> std::collections::BTreeMap<&str, &InstallFileEntry> {
        self.files
            .iter()
            .map(|e| (e.path.as_str(), e))
            .collect::<std::collections::BTreeMap<_, _>>()
    }
}

#[cfg(test)]
#[path = "install_metadata_tests.rs"]
mod tests;
