//! Checks of what is installed: each ownership index and the files it owns,
//! the same runtime at both scopes, and a MeowKit project that relies on a
//! global install (whose hooks do not run the project's gates).
use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{OwnershipIndex, Runtime};
use mewkit_core::fsx::{RelPath, sha256_hex};

use super::hooks;
use super::{Check, Status};
use crate::place::Place;

pub fn checks(place: &Place, other: Option<&Place>, targets: &[Runtime]) -> Vec<Check> {
    let mut out = Vec::new();
    for &runtime in targets {
        let here = index_check(place, runtime, &mut out);
        let there = other.and_then(|o| index_check(o, runtime, &mut out));
        if here.is_some() && there.is_some() {
            out.push(Check::new(
                format!("{} scopes", runtime.name()),
                Status::Warn,
                "installed both in this project and globally: hooks registered at both scopes run twice",
            ));
        }
        let project = [Some(place), other]
            .into_iter()
            .flatten()
            .find(|p| p.scope.kind == ScopeKind::Project);
        let has_project = if place.scope.kind == ScopeKind::Project {
            here.is_some()
        } else {
            there.is_some()
        };
        let has_global = if place.scope.kind == ScopeKind::Global {
            here.is_some()
        } else {
            there.is_some()
        };
        if let Some(p) = project
            && has_global
            && !has_project
            && p.scope.root.join(".meowkit").is_dir()
        {
            out.push(Check::new(
                format!("{} project hooks", runtime.name()),
                Status::Warn,
                format!(
                    "this MeowKit project has no project install of {0}; the plan and review gates \
                     run only from project hooks: `mewkit-next init --target {0}`",
                    runtime.name()
                ),
            ));
        }
        for (p, index) in [(Some(place), here), (other, there)] {
            if let (Some(p), Some(index)) = (p, index) {
                out.extend(hooks::checks(p, runtime, &index));
            }
        }
    }
    out
}

/// Load `runtime`'s index at `place` and report its owned files.
fn index_check(place: &Place, runtime: Runtime, out: &mut Vec<Check>) -> Option<OwnershipIndex> {
    let name = format!("{} ({})", runtime.name(), place.label());
    let index = match place.index(runtime) {
        Ok(Some(index)) => index,
        Ok(None) => return None,
        Err(e) => {
            out.push(Check::new(name, Status::Fail, e.to_string()));
            return None;
        }
    };
    let (mut missing, mut edited) = (Vec::new(), Vec::new());
    for (path, want) in &index.paths {
        let Ok(rel) = RelPath::new(path) else {
            continue;
        };
        match std::fs::read(place.scope.resolve(&rel)) {
            Ok(bytes) if sha256_hex(&bytes) == *want => {}
            Ok(_) => edited.push(path.as_str()),
            Err(_) => missing.push(path.as_str()),
        }
    }
    let summary = format!(
        "kit {}, {} owned files, {} edited, {} missing",
        index.kit_version,
        index.paths.len(),
        edited.len(),
        missing.len()
    );
    let (status, detail) = if missing.is_empty() && edited.is_empty() {
        (Status::Ok, summary)
    } else {
        let mut sample: Vec<&str> = missing.iter().chain(&edited).take(5).copied().collect();
        sample.sort_unstable();
        (
            Status::Warn,
            format!(
                "{summary} (e.g. {}); `mewkit-next upgrade --force` restores them",
                sample.join(", ")
            ),
        )
    };
    out.push(Check::new(name, status, detail));
    Some(index)
}
