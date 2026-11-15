//! Where MeowKit shares a host with something else.
//!
//! Four of these rows look outward — at agent names, hook registrations,
//! always-on instruction files and the skill listing every installed toolkit
//! draws on — and one looks at the kit colliding with itself, because a host
//! that also loads another runtime's tree runs two copies of the same install.
//!
//! All of them are `ok` or `warn` and never `fail`. Nothing reported here is a
//! broken install, and no command fixes it: another toolkit on the same machine
//! is a choice its user made. The row's job is to say what is there, with the
//! numbers behind it, so the person reading can decide. Where it states a
//! precedence it says whose documentation that came from, because this binary
//! cannot watch a host resolve a name and must not pretend it did.
use std::path::PathBuf;

use mewkit_adapters::ScopeKind;
use mewkit_adapters::contract::{RelPath, Runtime};

use super::coexistence_hooks;
use super::coexistence_scan as scan;
use super::coexistence_sources;
use super::hooks;
use super::{Check, Status};
use crate::place::Place;

const AGENTS: &str = "coexistence: agent names";
const CROSS: &str = "coexistence: cross-runtime load";

/// Where a host looks for the files it loads without being asked. The hook file
/// for each runtime is [`hooks::hook_file`]; these are the rest.
pub struct Trees {
    pub agents: &'static str,
    pub skills: &'static str,
    pub rules: &'static str,
    /// The instruction file read in every session, or `""` for a runtime that
    /// has none of its own at this scope.
    pub instructions: &'static str,
}

/// The directories and files `runtime` reads at `scope`, as its own bundle
/// lays them out.
pub fn trees(runtime: Runtime, scope: ScopeKind) -> Trees {
    let global = scope == ScopeKind::Global;
    match runtime {
        Runtime::ClaudeCode => Trees {
            agents: ".claude/agents",
            skills: ".claude/skills",
            rules: ".claude/rules",
            instructions: if global {
                ".claude/CLAUDE.md"
            } else {
                "CLAUDE.md"
            },
        },
        // Codex skills stay in `.agents/skills` at either scope; the scope
        // model is what resolves that to the right place on disk.
        Runtime::Codex => Trees {
            agents: ".codex/agents",
            skills: ".agents/skills",
            rules: ".codex/rules",
            instructions: if global {
                ".codex/AGENTS.md"
            } else {
                "AGENTS.md"
            },
        },
        // Cursor has no always-on instruction file of its own, which is why the
        // kit's standing context ships as a rule there.
        Runtime::Cursor => Trees {
            agents: ".cursor/agents",
            skills: ".cursor/skills",
            rules: ".cursor/rules",
            instructions: "",
        },
    }
}

/// `rel` resolved at `place`, with that scope's mounts applied.
pub fn at(place: &Place, rel: &str) -> PathBuf {
    RelPath::new(rel).map_or_else(|_| place.scope.root.join(rel), |r| place.scope.resolve(&r))
}

pub fn checks(places: &[&Place], targets: &[Runtime]) -> Vec<Check> {
    vec![
        agent_names(places, targets),
        coexistence_hooks::foreign(places, targets),
        coexistence_sources::instruction_files(places, targets),
        coexistence_sources::skill_listing(places, targets),
        cross_runtime(places, targets),
    ]
}

/// One name defined at two scopes is not an error — it is how a user overrides
/// a toolkit — but it does mean one of the two definitions is the one running,
/// and a report that never said so would leave a surprising answer unexplained.
fn agent_names(places: &[&Place], targets: &[Runtime]) -> Check {
    let mut seen = 0usize;
    let mut cut = false;
    let mut shared: Vec<String> = Vec::new();
    for &runtime in targets {
        let per: Vec<scan::Listing> = places
            .iter()
            .map(|p| scan::files(&at(p, trees(runtime, p.scope.kind).agents)))
            .collect();
        seen += per.iter().map(scan::Listing::len).sum::<usize>();
        cut |= per.iter().any(|l| l.truncated);
        let [here, there, ..] = per.as_slice() else {
            continue;
        };
        let theirs = there.names();
        let both: Vec<String> = here
            .names()
            .into_iter()
            .filter(|n| theirs.contains(n))
            .collect();
        if !both.is_empty() {
            shared.push(format!("{}: {}", runtime.name(), scan::sample(&both)));
        }
    }
    let cap = scan::truncation_note(cut);
    if shared.is_empty() {
        let note = if places.len() < 2 {
            "; only one scope could be read, so a name defined at the other is not counted"
        } else {
            ""
        };
        return Check::new(
            AGENTS,
            Status::Ok,
            format!(
                "{seen} agent definitions across the scopes read; none defined twice{note}{cap}"
            ),
        );
    }
    Check::new(
        AGENTS,
        Status::Warn,
        format!(
            "{seen} agent definitions read, and these names are defined at both scopes — {}; \
             the hosts document the nearer definition winning (a project's over your home \
             directory's, and `.cursor/` over a tree Cursor borrows), which this row repeats \
             from their documentation and does not verify here{cap}",
            shared.join("; ")
        ),
    )
}

/// Cursor reads the other runtimes' trees as well as its own, so one project
/// carrying the kit for Cursor and for Claude Code or Codex runs two copies of
/// the same install: both hook sets fire and every skill and agent appears
/// twice. The foreign-hook row cannot see that, because the kit owns both
/// sides of it.
fn cross_runtime(places: &[&Place], targets: &[Runtime]) -> Check {
    let mut doubled: Vec<String> = Vec::new();
    if !targets.contains(&Runtime::Cursor) {
        return Check::new(
            CROSS,
            Status::Ok,
            "cursor is not among the runtimes checked, and no other host loads a second tree",
        );
    }
    for place in places {
        if installed(place, Runtime::Cursor).is_none() {
            continue;
        }
        for borrowed in [Runtime::ClaudeCode, Runtime::Codex] {
            if !targets.contains(&borrowed) || installed(place, borrowed).is_none() {
                continue;
            }
            let tree = trees(borrowed, place.scope.kind);
            let hook_scripts = hooks::hook_doc(place, borrowed)
                .map(|(_, doc)| hooks::registered(&doc).len())
                .unwrap_or_default();
            doubled.push(format!(
                "{} ({}): {hook_scripts} hook scripts, {} skills, {} agents",
                borrowed.name(),
                place.label(),
                scan::dirs(&at(place, tree.skills)).len(),
                scan::files(&at(place, tree.agents)).len(),
            ));
        }
    }
    if doubled.is_empty() {
        return Check::new(
            CROSS,
            Status::Ok,
            "no runtime's tree is loaded by a second host here",
        );
    }
    Check::new(
        CROSS,
        Status::Warn,
        format!(
            "Cursor also loads another runtime's tree while \"Include Third-Party Plugins, \
             Skills, and Other Configs\" is on, which is its default, so this install loads \
             twice in Cursor — {}; every matching hook runs and `.cursor/` wins a name clash",
            doubled.join("; ")
        ),
    )
}

/// `runtime`'s ownership index at `place`, treating an unreadable one as absent:
/// `installs.rs` already reports a broken index, and this row must not report it
/// a second time as a coexistence problem.
pub fn installed(
    place: &Place,
    runtime: Runtime,
) -> Option<mewkit_adapters::contract::OwnershipIndex> {
    place.index(runtime).ok().flatten()
}
