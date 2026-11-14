//! Which of the kit's `.claude/` files a Claude Code install lays down.
//!
//! No packs and nothing disabled means the whole tree. Named packs install
//! base plus those packs (a profile is flattened to its packs by the caller),
//! and a disabled skill leaves its directory out.
use std::collections::BTreeSet;
use std::path::Path;

use mewkit_core::validate::{has_pack_manifest, load_pack_manifest, resolve_packs};

use crate::contract::{EmitError, EmitRequest};

/// What survives the selection.
pub struct Selection {
    /// `None`: every file. `Some`: only these `.claude/`-relative paths.
    allowed: Option<BTreeSet<String>>,
    disabled: Vec<String>,
}

impl Selection {
    pub fn of(
        req: &EmitRequest<'_>,
        claude_dir: &Path,
    ) -> Result<(Self, Option<String>), EmitError> {
        let mut notice = None;
        let allowed = if req.packs.is_empty() {
            None
        } else if has_pack_manifest(claude_dir) {
            let manifest = load_pack_manifest(claude_dir)
                .map_err(|e| EmitError::Kit(format!("pack-manifest.json: {e}")))?;
            let resolved = resolve_packs(claude_dir, &manifest, req.packs)
                .map_err(|e| EmitError::Kit(e.to_string()))?;
            Some(resolved.paths)
        } else {
            // A release from before pack manifests cannot honour a partial
            // selection, so it installs whole rather than half-installing.
            notice = Some(
                "this kit has no pack-manifest.json: installing the full tree instead of the selected packs"
                    .to_owned(),
            );
            None
        };
        Ok((
            Self {
                allowed,
                disabled: req.disabled.to_vec(),
            },
            notice,
        ))
    }

    /// Whether the file at `rel` (relative to `.claude/`) installs.
    pub fn installs(&self, rel: &str) -> bool {
        if let Some(allowed) = &self.allowed
            && !allowed.contains(rel)
        {
            return false;
        }
        let skill = rel.strip_prefix("skills/").and_then(|r| r.split_once('/'));
        !skill.is_some_and(|(dir, _)| {
            self.disabled
                .iter()
                .any(|d| d == dir || d.strip_prefix("mk:") == Some(dir))
        })
    }
}
