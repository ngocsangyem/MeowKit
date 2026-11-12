//! The canonical active-task pointer.
//!
//! It identifies a TASK by id, not a fuzzy plan string: the plan fields are
//! provenance and join hints, `taskId` is authoritative. Unknown keys pass
//! through so the legacy `path`/`slug` mirror the checkpoint reader still reads
//! survives a read→write round-trip — dropping it would silently blind that
//! reader to the current task.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::task_record::is_valid_task_id;
use super::{Extra, Validation, parse_with, quote};

/// The active-task pointer schema version THIS binary writes.
pub const ACTIVE_TASK_POINTER_SCHEMA_VERSION: &str = "1.0";

/// The canonical active-task pointer: it identifies a TASK by id, not a fuzzy
/// plan string. The plan fields are provenance/join hints; `taskId` is
/// authoritative. Unknown keys pass through so the legacy `path`/`slug` mirror
/// kept for the checkpoint reader survives a round-trip.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveTaskPointer {
    pub schema_version: String,
    pub task_id: String,
    #[serde(default)]
    pub plan_path: Option<String>,
    #[serde(default)]
    pub plan_slug: Option<String>,
    #[serde(flatten)]
    pub extra: Extra,
}

impl ActiveTaskPointer {
    pub fn validate(&self) -> Validation {
        let mut errors = Vec::new();
        if self.schema_version != ACTIVE_TASK_POINTER_SCHEMA_VERSION {
            errors.push(format!(
                "schemaVersion: must be {}",
                quote(ACTIVE_TASK_POINTER_SCHEMA_VERSION)
            ));
        }
        if !is_valid_task_id(&self.task_id) {
            errors.push(format!("taskId: invalid task id {}", quote(&self.task_id)));
        }
        Validation::new(errors)
    }

    pub fn parse(value: &Value) -> Result<Self, Vec<String>> {
        parse_with(value, |p: &Self| p.validate())
    }
}

#[cfg(test)]
#[path = "active_task_pointer_tests.rs"]
mod tests;
