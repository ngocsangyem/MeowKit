//! The SHA-bound review worktree ownership record.
//!
//! `worktreePath` and `ref` are FORMAT-PINNED rather than free text because they
//! reach git and the filesystem, and a review worktree hosts untrusted PR code
//! that can rewrite the manifest describing it. The pin mirrors the CommonJS
//! worktree action's own shape check: two boundaries, one contract, so neither
//! can quietly become the laxer one.
//!
//! The manifest must survive worktree removal — cleanup, coverage and compose
//! all read it afterwards — so it lives at
//! `tasks/reviews/<session>/manifest.json`, and the nonce is the cleanup guard
//! that stops a run from deleting a worktree it does not own.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{Extra, Validation, parse_with, require_non_empty};

// `[0-9]` rather than `\d`: the zod source spells it `\d`, which is ASCII in a
// `RegExp` without the `u` flag, while Rust's `\d` is `\p{Nd}`. Both values
// become a filesystem path and a git ref, so an Arabic-Indic digit must not
// satisfy the pin. The error messages below still quote the `\d` the TS schema
// is written with.
static WORKTREE_PATH_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\.worktrees/review-pr-[0-9]+-[A-Za-z0-9._-]+$").expect("static worktree pattern")
});
static REVIEW_REF_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^refs/mewkit/review-pr-[0-9]+-[A-Za-z0-9._-]+$").expect("static ref pattern")
});

/// Hosts the pipeline can write to. Extending this set is additive; an
/// unsupported host stays review-only rather than silently degrading to a
/// write it cannot perform.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReviewHost {
    Github,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewManifest {
    pub schema_version: String,
    pub session: String,
    /// The cleanup guard: a run may only remove a worktree whose manifest nonce
    /// it wrote.
    pub nonce: String,
    pub worktree_path: String,
    pub pr: i64,
    #[serde(rename = "ref")]
    pub git_ref: String,
    pub head_sha: String,
    pub base_sha: String,
    pub base_branch: String,
    /// Bound to the PR's BASE owner/repo — never a fork remote, because
    /// `pull/N/head` exists only on the base remote.
    pub base_remote: String,
    pub host: ReviewHost,
    pub owner: String,
    pub repo: String,
    pub created_at: String,
    /// Added by `review prepare`: makes the captured diff tamper-evident, so
    /// compose and coverage can re-hash before trusting `diff.patch`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub diff_sha256: Option<String>,
    /// Records degraded capture (rate limit, missing scope) so a later stage can
    /// cap the verdict instead of reading silence as completeness.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_unavailable: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: Extra,
}

impl ReviewManifest {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        for (label, value) in [
            ("schemaVersion", &self.schema_version),
            ("session", &self.session),
            ("nonce", &self.nonce),
            ("headSha", &self.head_sha),
            ("baseSha", &self.base_sha),
            ("baseBranch", &self.base_branch),
            ("baseRemote", &self.base_remote),
            ("owner", &self.owner),
            ("repo", &self.repo),
            ("createdAt", &self.created_at),
        ] {
            require_non_empty(label, value, &mut errors);
        }
        if !WORKTREE_PATH_RE.is_match(&self.worktree_path) {
            errors.push(
                "worktreePath: must match ^\\.worktrees/review-pr-\\d+-[A-Za-z0-9._-]+$"
                    .to_string(),
            );
        }
        if !REVIEW_REF_RE.is_match(&self.git_ref) {
            errors.push("ref: must match ^refs/mewkit/review-pr-\\d+-[A-Za-z0-9._-]+$".to_string());
        }
        if self.pr <= 0 {
            errors.push("pr: must be a positive integer".to_string());
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |m: &Self| m.validate())
    }

    /// Whether `nonce` owns this manifest. Cleanup asks this BEFORE any delete:
    /// a foreign manifest is refused, never removed.
    pub fn owned_by(&self, nonce: &str) -> bool {
        !self.nonce.is_empty() && self.nonce == nonce
    }
}

#[cfg(test)]
#[path = "review_manifest_tests.rs"]
mod tests;
