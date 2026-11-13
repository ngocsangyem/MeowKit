//! The canonical lifecycle spec, distilled into checkable sets.
//!
//! `.claude/skills/workflow-orchestrator/workflow.yaml` is the single source of
//! truth for the lifecycle. Loading it NEVER returns a degenerate empty spec —
//! that would let drift pass silently — so every failure is an error naming the
//! file. Port of the spec half of `core/check-workflow-drift.ts`.
use std::collections::BTreeSet;
use std::path::Path;

use serde_json::Value;

/// Basename of the canonical spec, and the pointer every prose source must
/// carry: short on purpose, because two of those sources are always-loaded
/// rules with a byte budget, and the basename is unique in the kit.
pub const SPEC_FILENAME: &str = "workflow.yaml";

/// Location of the spec, inside the skill that owns the lifecycle.
pub const SPEC_REL: [&str; 4] = [".claude", "skills", "workflow-orchestrator", SPEC_FILENAME];

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WorkflowSource {
    pub path: String,
    pub lifecycle_render: bool,
}

#[derive(Clone, Debug, Default)]
pub struct CanonicalSpec {
    /// Every phase and substep name.
    pub phase_names: BTreeSet<String>,
    /// id as written (`"0"`..`"6"`, `"3.5"`) → canonical name, in spec order.
    pub name_by_id: Vec<(String, String)>,
    /// Integer phase ids an `applies_to:` list must fully enumerate.
    pub integer_phase_ids: Vec<i64>,
    /// Gate id → its single required-output glob.
    pub gate_output: Vec<(String, String)>,
    /// Canonical second path-segments under `tasks/`.
    pub output_dirs: BTreeSet<String>,
    /// Reflect-phase canonical leads.
    pub reflect_leads: Vec<String>,
    /// Prose files to scan, with validation scope.
    pub sources: Vec<WorkflowSource>,
}

impl CanonicalSpec {
    pub fn name_of(&self, id: &str) -> Option<&str> {
        self.name_by_id
            .iter()
            .find(|(key, _)| key == id)
            .map(|(_, name)| name.as_str())
    }

    pub fn id_of(&self, name: &str) -> Option<&str> {
        self.name_by_id
            .iter()
            .find(|(_, value)| value == name)
            .map(|(id, _)| id.as_str())
    }

    pub fn gate(&self, id: &str) -> Option<&str> {
        self.gate_output
            .iter()
            .find(|(key, _)| key == id)
            .map(|(_, glob)| glob.as_str())
    }
}

/// `missing` = the file is absent (downgradable to WARN in a non-scoped run);
/// anything else is present-but-broken and is always a FAIL.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpecErrorKind {
    Missing,
    Unparseable,
    Malformed,
}

#[derive(Clone, Debug)]
pub struct WorkflowSpecError {
    pub kind: SpecErrorKind,
    pub message: String,
}

/// `String(value)` for an id that YAML may have read as a number.
pub(super) fn id_string(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        _ => None,
    }
}

/// The second path segment of a `tasks/<dir>/...` glob.
pub(super) fn output_dir_of(glob: &str) -> Option<String> {
    static PATTERN: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
        crate::js_regex::compile(r"^tasks/([A-Za-z0-9_-]+)/").expect("a static output-dir pattern")
    });
    PATTERN
        .captures(glob.trim())
        .and_then(|capture| capture.get(1).map(|m| m.as_str().to_string()))
}

pub fn spec_path(project_root: &Path) -> std::path::PathBuf {
    SPEC_REL
        .iter()
        .fold(project_root.to_path_buf(), |acc, part| acc.join(part))
}
