//! The default run: which checks, in which order, for which mode.
//!
//! Port of `detectValidateMode` and `buildDefaultChecks` in
//! `commands/validate.ts`. Pure and side-effect-free, so a fixture can be
//! validated in a test without a process.
use std::path::Path;

use super::agent_conformance::check_agent_conformance;
use super::capability_rows::{check_capabilities_section, check_capability_view_drift};
use super::docs_refs_rows::check_docs_refs_contract;
use super::gate_authority_rows::check_gate_authority;
use super::hooks::check_hooks_executable;
use super::namespace::check_plugin_namespace;
use super::operation_rows::{check_generic_core_tokens, check_operation_conformance};
use super::ownership_rows::check_ownership;
use super::packs::check_packs;
use super::portability::check_portability;
use super::result::{CheckResult, Section, Status};
use super::routing_breadth::check_routing_table_breadth;
use super::stale_index::check_stale_index;
use super::structure::{always_on_rule_paths, check_config, check_dir_exists, check_file_exists};
use super::substrate::check_substrate;
use super::workflow_rows::check_workflow_drift;

/// Consumer profile for a validate run.
///
/// * `Authoring` — the MeowKit source checkout. Gets the full authoring
///   coherence suite alongside the consumer checks.
/// * `FlatCopy` — a project that installed `.claude/` by copy. Gets only the
///   consumer-actionable checks: a consumer legitimately customizes `rules/`,
///   which trips workflow-drift and routing-breadth, so those checks would
///   surface as false failures in a HEALTHY consumer install.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ValidateMode {
    Authoring,
    FlatCopy,
}

impl ValidateMode {
    pub fn as_str(self) -> &'static str {
        match self {
            ValidateMode::Authoring => "authoring",
            ValidateMode::FlatCopy => "flat-copy",
        }
    }

    /// The clause the run header prints after the mode name.
    pub fn description(self) -> &'static str {
        match self {
            ValidateMode::Authoring => "full authoring-coherence suite",
            ValidateMode::FlatCopy => "consumer checks only; authoring-coherence checks suppressed",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "authoring" => Some(ValidateMode::Authoring),
            "flat-copy" => Some(ValidateMode::FlatCopy),
            _ => None,
        }
    }
}

/// Detect the mode from the project layout.
///
/// The source checkout carries this CLI's own crate beside its `.claude/`; a
/// consumer flat-copy install has `.claude/` and no CLI source. That single
/// filesystem signal is the discriminator, and an explicit mode overrides it.
pub fn detect_validate_mode(project_root: &Path) -> ValidateMode {
    if crate::kit_source::is_kit_source_checkout(project_root) {
        ValidateMode::Authoring
    } else {
        ValidateMode::FlatCopy
    }
}

/// Assemble the default-run checks for one mode.
///
/// Consumer-actionable checks run in both modes; the authoring-coherence suite
/// runs only in `authoring`, because a consumer legitimately customizes
/// `rules/` and would read those rows as false failures. `portable` appends the
/// provider-contract surface rows in either mode.
pub fn build_default_checks(
    meowkit_dir: &Path,
    project_root: &Path,
    mode: ValidateMode,
    portable: bool,
) -> Vec<CheckResult> {
    let mut results = vec![
        check_dir_exists(meowkit_dir, "agents"),
        check_dir_exists(meowkit_dir, "hooks"),
    ];
    // The always-on rule set replaces a root-`CLAUDE.md` presence check: these
    // files are what the host auto-loads every session, so a missing one
    // silently drops the enforcement it alone carries.
    results.extend(
        always_on_rule_paths()
            .iter()
            .map(|rel| check_file_exists(meowkit_dir, rel, Section::Structure)),
    );
    results.push(check_config(meowkit_dir));
    results.extend(check_hooks_executable(meowkit_dir));
    results.extend(check_docs_refs_contract(meowkit_dir));
    // Namespace purity is cheap and consumer-relevant: a leaked double-prefix
    // misbehaves in a consumer install too.
    results.extend(check_plugin_namespace(meowkit_dir));
    // The team-memory store is consumer-owned content: a consumer's store can
    // carry instruction-like text or a secret as easily as the source can.
    results.extend(super::check_memory_store(project_root));

    if mode == ValidateMode::Authoring {
        // Advisory in the default run: a wholly-absent governance file WARNs
        // (prompting an upgrade) rather than failing an un-synced install. The
        // scoped flags stay strict, which is what the CI steps use.
        results.extend(check_workflow_drift(project_root, Status::Warn));
        // Gate-authority stays STRICT even here: an un-synced install cannot
        // explain a file that grants automated gate approval.
        results.extend(check_gate_authority(
            project_root,
            &[".claude"],
            Status::Fail,
        ));
        results.extend(check_operation_conformance(meowkit_dir));
        results.push(check_generic_core_tokens(meowkit_dir));
        // Declared doc counts against the real inventory: surfacing it here
        // means an author sees a stale README at validate time, not at CI time.
        results.extend(check_stale_index(project_root));
        results.extend(check_ownership(meowkit_dir));
        results.extend(check_agent_conformance(project_root));
        results.extend(check_substrate(meowkit_dir, Status::Warn));
        results.extend(check_packs(meowkit_dir, Status::Warn));
        results.extend(check_routing_table_breadth(meowkit_dir));
        results.extend(check_capabilities_section(meowkit_dir));
        results.extend(check_capability_view_drift(meowkit_dir, project_root));
    }

    if portable {
        results.extend(check_portability());
        results.extend(codex_tree_pointer(project_root));
    }
    results
}

/// A Codex tree in this project is checked by `--target codex`, which reads
/// what an install actually writes. The surface matrix above describes the
/// provider contracts, not one install, so it says where that check lives
/// instead of re-deriving a skill count from `.claude/skills` that an install
/// filtered by packs would never match.
fn codex_tree_pointer(project_root: &Path) -> Option<CheckResult> {
    let has_tree = project_root.join(".codex").exists()
        || project_root.join(".agents").join("skills").exists();
    has_tree.then(|| {
        CheckResult::new(
            "Codex projection",
            Status::Na,
            "a Codex tree is present; validate it with `mewkit validate --target codex .`",
            Section::Portability,
        )
    })
}

#[cfg(test)]
#[path = "default_checks_tests.rs"]
mod default_checks_tests;
