//! Files an earlier install wrote that no plan writes now, though the kit
//! never shipped them as files of its own.
//!
//! `upgrade` queues every recorded path a new plan no longer writes, and each
//! removal needs a kit hash to corroborate it. The old kit is replanned with
//! the current emitter, which leaves these paths out too, so no kit hash
//! exists. The ownership record of what the install wrote corroborates
//! instead, which still keeps every file whose bytes changed since.
//!
//! - `.claude/runtime.json`: earlier Claude Code installs pointed the
//!   orientation hook at the launcher through it; the hook now finds the
//!   launcher by its project path.
//! - `.agents/meowkit/hooks/**`: an Antigravity install alone no longer writes
//!   the Pi and OMP guard (see `antigravity::unused_guard`).
use std::collections::BTreeMap;

use crate::antigravity::unused_guard;
use crate::claude_code::launcher::LEGACY_DESCRIPTOR;
use crate::contract::{OwnershipIndex, Runtime};

/// The hashes `index` recorded for `runtime`'s retired paths, by path.
pub fn recorded_hashes(runtime: Runtime, index: &OwnershipIndex) -> BTreeMap<String, String> {
    let retired = |path: &str| match runtime {
        Runtime::ClaudeCode => path == LEGACY_DESCRIPTOR,
        Runtime::Antigravity => path.starts_with(unused_guard::HOOKS),
        _ => false,
    };
    index
        .paths
        .iter()
        .filter(|(path, _)| retired(path))
        .map(|(path, hash)| (path.clone(), hash.clone()))
        .collect()
}
