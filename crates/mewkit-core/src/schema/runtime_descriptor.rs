//! The installed-runtime descriptor: how a hook finds a REAL, trusted mewkit
//! executable instead of calling a bare package runner or trusting whatever is
//! on `PATH`.
//!
//! Installation writes it; the SessionStart hook reads it and RE-VALIDATES the
//! executable, because the descriptor is an ordinary file in the project and a
//! tampered one must not be able to point the hook at `/tmp/evil`. The trust
//! gate therefore lives with the schema: a descriptor that parses is not yet a
//! descriptor that may be run.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::context_envelope::is_within_boundary;
use super::{Extra, Validation, parse_with, quote};

pub const RUNTIME_DESCRIPTOR_FILENAME: &str = "runtime.json";
pub const RUNTIME_DESCRIPTOR_SCHEMA_VERSION: &str = "1.0";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeDescriptor {
    pub schema_version: String,
    /// Absolute path to a runnable mewkit entry, validated to stay inside the
    /// project before it is ever executed.
    pub executable: String,
    #[serde(default)]
    pub package_version: String,
    #[serde(default)]
    pub written_at: String,
    #[serde(flatten)]
    pub extra: Extra,
}

impl RuntimeDescriptor {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if self.schema_version != RUNTIME_DESCRIPTOR_SCHEMA_VERSION {
            errors.push(format!(
                "schemaVersion: must be {}",
                quote(RUNTIME_DESCRIPTOR_SCHEMA_VERSION)
            ));
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |d: &Self| d.validate())
    }
}

/// `.claude/runtime.json` — the descriptor path for a project's `.claude` state.
pub fn descriptor_path(claude_dir: &Path) -> std::path::PathBuf {
    claude_dir.join(RUNTIME_DESCRIPTOR_FILENAME)
}

/// Why a descriptor may not be used. Each variant is a FALLBACK signal, never a
/// crash: a missing or hostile descriptor means "use the checkpoint cache", and
/// a hook that threw here would take the session down with it.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum DescriptorRefusal {
    #[error("no runtime descriptor")]
    Absent,
    #[error("invalid runtime descriptor: {0}")]
    Invalid(String),
    #[error("runtime executable missing or outside the project boundary")]
    Untrusted,
}

/// A descriptor's executable is TRUSTED only when it is absolute, exists as a
/// file, and its REAL path resolves inside the project's REAL root.
///
/// Both sides are resolved: a symlink at an in-project path pointing OUT of the
/// tree is an escape to be rejected, not followed, and a symlinked project root
/// (macOS `/var` → `/private/var`) must not read as an escape either. A global
/// executable outside the project is conservatively refused rather than run.
pub fn executable_is_trusted(executable: &str, project_root: &Path) -> bool {
    let candidate = Path::new(executable);
    if executable.is_empty() || !candidate.is_absolute() {
        return false;
    }
    let (Ok(real_exe), Ok(real_root)) = (candidate.canonicalize(), project_root.canonicalize())
    else {
        return false;
    };
    if !is_within_boundary(&real_root, &real_exe) {
        return false;
    }
    std::fs::symlink_metadata(&real_exe).is_ok_and(|m| m.is_file())
}

/// Validate a descriptor payload the way the read side must: shape FIRST, then
/// the trust gate. `project_root` is the consumer project (the parent of
/// `.claude`).
pub fn accept(
    payload: &Value,
    project_root: &Path,
) -> Result<RuntimeDescriptor, DescriptorRefusal> {
    let descriptor = RuntimeDescriptor::parse(payload)
        .map_err(|errors| DescriptorRefusal::Invalid(errors.join("; ")))?;
    if !executable_is_trusted(&descriptor.executable, project_root) {
        return Err(DescriptorRefusal::Untrusted);
    }
    Ok(descriptor)
}

/// The descriptor a fresh install should record for `executable`, or a refusal
/// when that executable would not pass the read-side gate. An honest "no
/// runtime" beats a descriptor the hook will always reject.
pub fn describe(
    executable: &str,
    package_version: &str,
    now: &str,
    project_root: &Path,
) -> Result<RuntimeDescriptor, String> {
    if !executable_is_trusted(executable, project_root) {
        return Err(format!(
            "refusing to write runtime descriptor: executable {} is not an existing file inside the project",
            quote(executable)
        ));
    }
    Ok(RuntimeDescriptor {
        schema_version: RUNTIME_DESCRIPTOR_SCHEMA_VERSION.to_string(),
        executable: executable.to_string(),
        package_version: package_version.to_string(),
        written_at: now.to_string(),
        extra: Extra::new(),
    })
}

#[cfg(test)]
#[path = "runtime_descriptor_tests.rs"]
mod tests;
