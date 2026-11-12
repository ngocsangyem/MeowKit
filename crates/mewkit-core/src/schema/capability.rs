//! The model-agnostic capability contract: one semantic entry per installed
//! artifact, mapping it to safe selection, logical invocation requirements, and
//! verification.
//!
//! Security invariant: frontmatter may name LOGICAL requirement and invocation
//! IDs only — never a command string, never a provider-native tool name. Trusted
//! adapter code maps a logical ID to a constant provider operation, which is what
//! stops hostile frontmatter from smuggling an executable through the manifest.
//! An ID outside [`KNOWN_INVOCATION_IDS`] is therefore a validation error, not an
//! unknown-but-tolerated value.

use serde::{Deserialize, Serialize};

use super::{Validation, quote, require_non_empty};

/// Capability kinds. Disk-enumerated: skill/agent/command/workflow/hook.
/// Authored-only (no disk artifact, no frontmatter):
/// tool/context-service/state-service. `rule` artifacts are inventory-only
/// context and are deliberately NOT capabilities.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CapabilityKind {
    Skill,
    Agent,
    Command,
    Workflow,
    Hook,
    Tool,
    ContextService,
    StateService,
}

/// Where a field's value came from. `unknown` is SURFACED, never invented.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldProvenance {
    Authored,
    #[default]
    Inferred,
    Adapter,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RequirementType {
    HostTool,
    McpOrApp,
    ExternalBinary,
    SubagentSurface,
    SkillScript,
    LifecycleEvent,
    FileOrConfig,
}

/// A typed logical requirement. `id` is a logical identifier (an
/// `external_binary` maps to a system-dependency ID), never an executable
/// command.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TypedRequirement {
    #[serde(rename = "type")]
    pub requirement_type: RequirementType,
    pub id: String,
    #[serde(default)]
    pub provenance: FieldProvenance,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InvocationKind {
    Skill,
    Agent,
    Command,
    Workflow,
    Hook,
    /// Not directly invocable (a hook, for instance).
    None,
}

/// A logical invocation contract. `id` must be a known logical invocation ID;
/// adapters map it to a constant provider operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Invocation {
    pub kind: InvocationKind,
    pub id: String,
}

/// Known logical invocation IDs. Frontmatter may reference only these.
pub const KNOWN_INVOCATION_IDS: &[&str] = &[
    "invoke-skill",
    "invoke-agent",
    "invoke-command",
    "invoke-workflow",
    "lifecycle-hook",
    "none",
];

/// The four independent host-support levels, per provider. Populated from
/// adapter evidence only; absence ⇒ unknown.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupportLevels {
    pub discoverable: bool,
    pub selectable: bool,
    pub invocable: bool,
    pub enforceable: bool,
}

fn default_context_scope() -> String {
    "task-repo".to_string()
}

/// Declares that a capability needs a bounded task-scoped repository-context
/// envelope BEFORE source-grounded work. This is an ORCHESTRATION precondition,
/// not a host dependency: the envelope is acquired on demand and recorded, never
/// probed for presence — so it is deliberately NOT a [`TypedRequirement`], which
/// feeds availability adapters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContextRequirement {
    #[serde(default = "default_context_scope")]
    pub scope: String,
    #[serde(default)]
    pub reason: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerificationKind {
    Command,
    File,
    Runtime,
    None,
    /// Explicit, not a silent gap.
    #[default]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verification {
    pub kind: VerificationKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
}

impl Default for Verification {
    fn default() -> Self {
        Self {
            kind: VerificationKind::Unknown,
            id: None,
        }
    }
}

impl Invocation {
    /// The refusal an unknown logical invocation ID earns. Named so an operator
    /// reading it sees which ID was rejected.
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if !KNOWN_INVOCATION_IDS.contains(&self.id.as_str()) {
            errors.push(format!(
                "invocation.id: unknown logical invocation id {}",
                quote(&self.id)
            ));
        }
        Validation::new(errors)
    }
}

impl TypedRequirement {
    pub fn validate(&self, label: &str) -> Vec<String> {
        let mut errors = Vec::new();
        require_non_empty(&format!("{label}.id"), &self.id, &mut errors);
        errors
    }
}

impl ContextRequirement {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if self.scope != "task-repo" {
            errors.push("contextRequirement.scope: must be \"task-repo\"".to_string());
        }
        Validation::new(errors)
    }
}

#[cfg(test)]
#[path = "capability_tests.rs"]
mod tests;
