//! `mewkit validate` — does this install's STRUCTURE and WIRING hold?
//!
//! Port of `commands/validate.ts` and the `core/check-*.ts` modules it calls.
//! The scope is deliberately narrow and is stated in the output: that gate files
//! exist and are wired, NOT that they actually block. Behavioural proof is
//! `doctor --hard-gates`. So the statuses are honest — PASS / WARN / N/A / FAIL
//! — and WARN or N/A does not fail the build unless `--strict` is passed.
//!
//! ## The two profiles
//!
//! The CONSUMER-actionable checks run in both modes: the directories, the
//! always-on rules, the config, the hooks, the docs references, namespace
//! purity and the committed team-memory store. The AUTHORING-coherence suite
//! runs only in `authoring` — workflow drift, gate authority, operation
//! conformance, the generic-core baseline, the stale index, ownership,
//! agent conformance, the responsibility substrate, pack coherence,
//! routing-table breadth and the capability manifest with its generated view.
//! A consumer legitimately customizes `rules/`, so those rows would be false
//! failures in a healthy flat-copy install.
//!
//! `--portable` adds the provider-contract surface matrix in either mode, and
//! `--target <provider>` validates a GENERATED provider tree instead of this
//! one.
//!
//! ## The one thing that is not ported
//!
//! The Codex PROJECTION rows under `--portable` (for a generated `.codex/` or
//! `.agents/skills` tree inside the project being validated) count the skills a
//! provider may carry, which needs the portability-policy engine. A project
//! carrying such a tree is refused by name through [`NotPorted`] rather than
//! half-reported: a partial report that exited 0 would be read by CI as a full
//! pass, which is the one outcome a validator must not produce.
mod agent_conformance;
mod agent_registry_rows;
mod agent_sources;
mod agent_views;
mod capabilities;
mod capabilities_validate;
mod capability_authored;
mod capability_build;
mod capability_rows;
mod default_checks;
mod denied_tokens;
mod dir_order;
mod docs_refs;
mod docs_refs_rows;
mod docs_refs_tokens;
mod entry;
mod frontmatter;
mod frontmatter_rows;
mod gate_authority;
mod gate_authority_patterns;
mod gate_authority_rows;
mod generic_tokens;
mod generic_tokens_body;
mod hooks;
mod inventory;
mod inventory_agent;
mod inventory_build;
mod inventory_edges;
mod inventory_enumerate;
mod inventory_read;
mod json_schema_lite;
mod json_schema_object;
mod json_schema_scalars;
mod namespace;
mod namespace_scan;
mod operation_rows;
mod operations;
mod ownership_rows;
mod pack_files;
mod pack_manifest;
mod pack_manifest_shape;
mod pack_resolve;
mod packs;
mod packs_safety;
mod portability;
mod pseudo_capabilities;
mod render;
mod result;
mod routing_breadth;
mod runtime_contract;
mod stale_index;
mod stale_index_specs;
mod structure;
mod substrate;
mod substrate_aggregate;
mod substrate_view;
mod target_codex;
mod target_codex_agents;
mod target_codex_config;
mod target_codex_hooks;
mod target_codex_rules;
mod target_codex_skills;
mod target_cursor;
mod target_helpers;
mod targets;
mod toml_json;
mod workflow_drift;
mod workflow_line_scan;
mod workflow_rows;
mod workflow_sources;
mod workflow_spec;
mod workflow_spec_load;

pub use crate::project_root::resolve_project_root;
pub use agent_conformance::check_agent_conformance;
pub use agent_views::{artifact_patterns_overlap, render_agent_view_counts};
pub use capabilities::{
    CapabilityEntry, CapabilityIssue, IssueLevel, KNOWN_INVOCATION_IDS, build_capabilities,
    validate_capabilities,
};
pub use capability_rows::{
    ViewDriftState, capability_view_drift, check_capabilities_section, check_capability_view_drift,
    render_capability_view,
};
pub use default_checks::{NotPorted, ValidateMode, build_default_checks, detect_validate_mode};
pub use docs_refs::{
    CONTRACT_REL_PATH, DocsRefFinding, DocsRefResult, RefLevel, check_docs_references,
};
pub use docs_refs_rows::check_docs_refs_contract;
pub use docs_refs_tokens::{extract_tokens, parse_allowlist, resolve_contract_path};
pub use frontmatter::{
    FrontmatterReport, check_skill_frontmatter, is_external_service_entrypoint,
    tool_contract_warnings,
};
pub use frontmatter_rows::check_frontmatter_contract;
pub use gate_authority::{GateAuthorityViolation, scan_for_gate_authority};
pub use gate_authority_rows::check_gate_authority;
pub use generic_tokens::{
    GenericCoreTokenFinding, TokenCategory, find_generic_core_tokens, summarize_generic_core_tokens,
};
pub use hooks::{check_hooks_executable, is_hook_script};
pub use inventory::{
    DEPENDENCY_EDGE_TYPES, DependencyEdge, Inventory, InventoryEntry, REQUIRED_FIELDS,
    STATUS_REFERENCE,
};
pub use inventory_build::build_inventory;
pub use inventory_enumerate::{
    ArtifactRef, ArtifactType, InventoryIssue, MetaSource, enumerate_artifacts,
};
pub use inventory_read::{read_frontmatter, read_registry};
pub use json_schema_lite::{SchemaViolation, format_violation, validate_against_schema};
pub use namespace::check_plugin_namespace;
pub use namespace_scan::collect_agent_names;
pub use operation_rows::{check_generic_core_tokens, check_operation_conformance};
pub use operations::{
    ADAPTED_PROVIDERS, LOGICAL_OPERATIONS, OperationConformanceFinding, OperationSupport,
    assert_operations_not_invocable, find_operation_conformance, is_blocking_gap,
};
pub use ownership_rows::check_ownership;
pub use pack_files::collect_files;
pub use pack_manifest::{
    BASE_PACK, PackManifest, PackManifestError, flatten_profile, has_pack_manifest,
    load_pack_manifest, pack_manifest_path,
};
pub use pack_resolve::{Resolved, resolve_packs, resolve_profile};
pub use packs::check_packs;
pub use portability::check_portability;
pub use pseudo_capabilities::{
    PseudoCapabilityFinding, find_pseudo_capabilities, scan_for_pseudo_capabilities,
};
pub use render::{exit_code, render_results};
pub use result::{CheckResult, Section, Status, ok};
pub use routing_breadth::{check_routing_table_breadth, resolve_inventory_path};
pub use runtime_contract::{RUNTIME_KEY, documented_python_scripts, runtime_contract_errors};
pub use stale_index::{CountDiff, check_stale_index, compare_counts, missing_rows};
pub use structure::{
    ALWAYS_ON_RULES, always_on_rule_paths, check_config, check_dir_exists, check_file_exists,
};
pub use substrate::{Coverage, SubstrateAggregate, TAXONOMY, check_substrate};
pub use substrate_aggregate::aggregate_substrate;
pub use substrate_view::render_substrate_view;
pub use targets::{TARGET_PROFILES, check_target, detects_target, is_target_profile};
pub use workflow_drift::{Violation, scan_for_violations};
pub use workflow_rows::check_workflow_drift;
pub use workflow_spec::{
    CanonicalSpec, SPEC_FILENAME, SpecErrorKind, WorkflowSource, WorkflowSpecError,
};
pub use workflow_spec_load::load_workflow_spec;

pub use entry::{check_memory_store, find_meowkit_dir};
