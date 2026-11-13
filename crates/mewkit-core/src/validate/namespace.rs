//! Source namespace purity: agents bare, skills `mk:`-scoped, refs resolvable.
//!
//! Port of `core/namespace-purity.ts`. These three rows encode failure modes
//! from the toolkit's namespaced-distribution experiment: a namespaced agent
//! name is never valid source, a non-`mk:` skill name is a namespace leak, and
//! a `subagent_type` naming nothing is a delegation that silently never happens.
//! Cheap and consumer-relevant, so they run in both modes.
use std::collections::BTreeSet;
use std::path::Path;

use super::namespace_scan::{
    BUILTIN_AGENT_TYPES, collect_agent_names, skill_name_leaks, stray_subagent_refs,
};
use super::result::{CheckResult, Section, Status};

/// The three namespace rows for one `.claude/` directory.
pub fn check_plugin_namespace(claude_dir: &Path) -> Vec<CheckResult> {
    let agent_names = collect_agent_names(&claude_dir.join("agents"));
    let prefixed: Vec<String> = agent_names
        .iter()
        .filter(|n| n.contains(':'))
        .cloned()
        .collect();
    let mut results = vec![CheckResult::new(
        "Agent names are bare",
        if prefixed.is_empty() {
            Status::Pass
        } else {
            Status::Fail
        },
        if prefixed.is_empty() {
            format!("{} agents, none namespaced", agent_names.len())
        } else {
            format!("unexpectedly namespaced: {}", prefixed.join(", "))
        },
        Section::Plugin,
    )];

    let leaked = skill_name_leaks(&claude_dir.join("skills"));
    results.push(CheckResult::new(
        "Skill names are mk:-scoped",
        if leaked.is_empty() {
            Status::Pass
        } else {
            Status::Fail
        },
        if leaked.is_empty() {
            "no namespace leaks".to_string()
        } else {
            format!("non-mk: skill names: {}", leaked.join("; "))
        },
        Section::Plugin,
    ));

    let mut allowed: BTreeSet<String> = agent_names.into_iter().collect();
    allowed.extend(BUILTIN_AGENT_TYPES.iter().map(|t| (*t).to_string()));
    let stray = stray_subagent_refs(claude_dir, &allowed);
    results.push(CheckResult::new(
        "subagent_type refs resolve",
        if stray.is_empty() {
            Status::Pass
        } else {
            Status::Warn
        },
        if stray.is_empty() {
            "all refs are kit agents or built-ins".to_string()
        } else {
            format!(
                "unknown refs: {}",
                stray.iter().take(5).cloned().collect::<Vec<_>>().join("; ")
            )
        },
        Section::Plugin,
    ));
    results
}

#[cfg(test)]
#[path = "namespace_tests.rs"]
mod namespace_tests;
