//! Refusing to install a released kit over the kit's own source tree.
//!
//! In the MeowKit repository `.claude/` is the authored source of every
//! release, not an installed copy: it carries no install record, so an install
//! cannot tell authored files from stale ones. Installing there is never what
//! the user wants, so it takes an explicit flag.
use std::path::Path;

use mewkit_adapters::ScopeKind;
use mewkit_core::kit_source::is_kit_source_checkout;

use crate::failure::FAILED;
use crate::place::Place;

/// True when `dir` is the MeowKit source repo: `.claude/` plus this CLI's own
/// crate manifest.
fn is_kit_source(dir: &Path) -> bool {
    dir.join(".claude").exists() && is_kit_source_checkout(dir)
}

/// The exit code when this project is the kit source and no override was given.
pub fn refuse_kit_source(place: &Place) -> Option<u8> {
    if place.scope.kind != ScopeKind::Project || !is_kit_source(&place.scope.root) {
        return None;
    }
    eprintln!(
        "mewkit init: refusing to run in the MeowKit source repo ({}).\n  \
         Its .claude/ is the kit's authored source; installing a release here overwrites it.\n  \
         Run this in a project that uses MeowKit, or pass --allow-kit-source if you really mean it.",
        place.scope.root.display()
    );
    Some(FAILED)
}
