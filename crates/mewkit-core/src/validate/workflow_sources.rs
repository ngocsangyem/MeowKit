//! The `sources:` list: which prose files the drift check scans, and with what
//! scope.
//!
//! A malformed entry is a SPEC error rather than a scan finding — a file that
//! cannot say which prose it governs cannot be scanned against.
use serde_json::Value;
use std::path::Path;

use super::workflow_spec::{SpecErrorKind, WorkflowSource, WorkflowSpecError};

pub(super) fn parse_sources(
    raw: &Value,
    path: &Path,
) -> Result<Vec<WorkflowSource>, WorkflowSpecError> {
    let malformed = |detail: String| WorkflowSpecError {
        kind: SpecErrorKind::Malformed,
        message: format!(
            "Canonical workflow spec malformed ({detail}): {}",
            path.display()
        ),
    };
    let sources = match raw.get("sources") {
        None | Some(Value::Null) => return Ok(Vec::new()),
        Some(Value::Array(entries)) => entries,
        Some(_) => return Err(malformed("sources must be an array".to_string())),
    };
    let mut out = Vec::new();
    for (index, source) in sources.iter().enumerate() {
        match source {
            Value::String(text) if !text.trim().is_empty() => out.push(WorkflowSource {
                path: text.clone(),
                lifecycle_render: false,
            }),
            Value::Object(entry) => {
                let Some(source_path) = entry.get("path").and_then(Value::as_str) else {
                    return Err(malformed(format!("invalid sources[{index}] entry")));
                };
                if source_path.trim().is_empty() {
                    return Err(malformed(format!("invalid sources[{index}] entry")));
                }
                match entry.get("lifecycle_render") {
                    None | Some(Value::Null) => out.push(WorkflowSource {
                        path: source_path.to_string(),
                        lifecycle_render: false,
                    }),
                    Some(Value::Bool(flag)) => out.push(WorkflowSource {
                        path: source_path.to_string(),
                        lifecycle_render: *flag,
                    }),
                    Some(_) => {
                        return Err(malformed(format!(
                            "sources[{index}].lifecycle_render must be boolean"
                        )));
                    }
                }
            }
            _ => return Err(malformed(format!("invalid sources[{index}] entry"))),
        }
    }
    Ok(out)
}
