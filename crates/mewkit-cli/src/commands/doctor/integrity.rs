//! The `guards: integrity` row: do the files a host actually runs still match
//! what the install wrote?
//!
//! Every other row in this module reports a situation. This one reports a
//! change, and it exists because the two halves of a guard can be separated
//! without anything else noticing: a guard is a file on disk named by a line in
//! a hook file, so editing the file, or pointing the line somewhere else, leaves
//! every other row still saying the guard is installed.
//!
//! The ownership index records the SHA-256 the install wrote for each path, so
//! the comparison is local, cheap and needs nothing from the network. It stays
//! `warn`: an edit may be entirely deliberate, and the row's job is to say it
//! happened, not to judge it.
use mewkit_adapters::contract::{RelPath, Runtime};
use mewkit_core::fsx::sha256_hex;

use super::coexistence::installed;
use super::coexistence_scan as scan;
use super::hooks;
use super::{Check, Status};
use crate::place::Place;

const NAME: &str = "guards: integrity";
/// What a host loads out of a hook tree: the executables, and the JSON a
/// dispatcher reads to decide which of them runs.
const GUARD_SUFFIXES: [&str; 6] = [".cjs", ".js", ".mjs", ".sh", ".py", ".json"];

pub fn check(places: &[&Place], targets: &[Runtime]) -> Check {
    let mut guards = 0usize;
    let (mut edited, mut missing, mut dangling) = (Vec::new(), Vec::new(), Vec::new());
    for place in places {
        for &runtime in targets {
            let Some(index) = installed(place, runtime) else {
                continue;
            };
            for (path, recorded) in &index.paths {
                if !is_guard(path) {
                    continue;
                }
                guards += 1;
                let Ok(rel) = RelPath::new(path) else {
                    continue;
                };
                match std::fs::read(place.scope.resolve(&rel)) {
                    Ok(bytes) if sha256_hex(&bytes) == *recorded => {}
                    Ok(_) => edited.push(path.clone()),
                    Err(_) => missing.push(path.clone()),
                }
            }
            let Some((file, doc)) = hooks::hook_doc(place, runtime) else {
                continue;
            };
            let base = hooks::base_dir(place, runtime, &file);
            dangling.extend(
                hooks::registered(&doc)
                    .into_iter()
                    .filter(|token| !hooks::resolve(base, token).is_file())
                    // A registration this install does not own is still printed
                    // here, so the path comes from a file someone else wrote.
                    .map(|token| scan::safe(&token, scan::MAX_FIELD)),
            );
        }
    }
    for list in [&mut edited, &mut missing, &mut dangling] {
        list.sort_unstable();
        list.dedup();
    }
    if edited.is_empty() && missing.is_empty() && dangling.is_empty() {
        let detail = if guards == 0 {
            "no install at the scopes read, so there is no guard to compare".to_owned()
        } else {
            format!(
                "{guards} guard files match the bytes recorded at install, and every hook \
                 registration names a file that is there"
            )
        };
        return Check::new(NAME, Status::Ok, detail);
    }
    let mut parts = Vec::new();
    if !edited.is_empty() {
        parts.push(format!(
            "{} changed since install ({})",
            edited.len(),
            scan::sample(&edited)
        ));
    }
    if !missing.is_empty() {
        parts.push(format!(
            "{} gone ({})",
            missing.len(),
            scan::sample(&missing)
        ));
    }
    if !dangling.is_empty() {
        parts.push(format!(
            "{} hook registrations name a file that is not there ({})",
            dangling.len(),
            scan::sample(&dangling)
        ));
    }
    Check::new(
        NAME,
        Status::Warn,
        format!(
            "of {guards} guard files: {} — a guard whose bytes changed is not the guard that was \
             reviewed; `mewkit upgrade --force` restores the shipped bytes",
            parts.join(", ")
        ),
    )
}

/// A path a host executes as part of a check, or the configuration one of them
/// reads: everything the install wrote inside a `hooks` directory. A library
/// under it counts, because a guard that loads it is only as sound as it is.
fn is_guard(path: &str) -> bool {
    path.split('/').any(|segment| segment == "hooks")
        && GUARD_SUFFIXES.iter().any(|s| path.ends_with(s))
}

#[cfg(test)]
mod tests {
    use super::is_guard;

    #[test]
    fn a_guard_is_what_a_host_runs_out_of_a_hook_tree() {
        assert!(is_guard(".claude/hooks/privacy-block.cjs"));
        assert!(is_guard(".claude/hooks/lib/core/pre-ship.cjs"));
        assert!(is_guard(".claude/hooks/handlers.json"));
        assert!(is_guard(".cursor/hooks/privacy-read-gate.cjs"));
        // Documentation in the same tree is not a guard, and neither is a
        // skill that merely mentions one.
        assert!(!is_guard(".claude/hooks/HOOKS_INDEX.md"));
        assert!(!is_guard(".claude/skills/cook/SKILL.md"));
        assert!(!is_guard(".claude/settings.json"));
    }
}
