//! Reading the canonical spec into the sets the drift check compares against.
//!
//! It NEVER returns a degenerate empty spec — that would let drift pass
//! silently — so every failure is an error naming the file and what is wrong
//! with it.
use std::path::Path;

use serde_json::Value;

use super::workflow_sources::parse_sources;
use super::workflow_spec::{
    CanonicalSpec, SpecErrorKind, WorkflowSpecError, id_string, output_dir_of, spec_path,
};

pub fn load_workflow_spec(project_root: &Path) -> Result<CanonicalSpec, WorkflowSpecError> {
    let path = spec_path(project_root);
    if !path.exists() {
        return Err(WorkflowSpecError {
            kind: SpecErrorKind::Missing,
            message: format!("Canonical workflow spec missing: {}", path.display()),
        });
    }
    let source = std::fs::read(&path)
        .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
        .unwrap_or_default();
    let raw = crate::yaml_doc::parse_value(&source).map_err(|error| WorkflowSpecError {
        kind: SpecErrorKind::Unparseable,
        message: format!(
            "Canonical workflow spec is unparseable ({}): {error}",
            path.display()
        ),
    })?;
    let Some(phases) = raw.get("phases").and_then(Value::as_array) else {
        return Err(WorkflowSpecError {
            kind: SpecErrorKind::Malformed,
            message: format!(
                "Canonical workflow spec malformed (no phases): {}",
                path.display()
            ),
        });
    };

    let mut spec = CanonicalSpec::default();
    for phase in phases {
        let (Some(id), Some(name)) = (
            phase.get("id").and_then(id_string),
            phase.get("name").and_then(Value::as_str),
        ) else {
            continue;
        };
        if name.is_empty() {
            continue;
        }
        spec.phase_names.insert(name.to_string());
        spec.name_by_id.push((id.clone(), name.to_string()));
        if id.chars().all(|c| c.is_ascii_digit())
            && !id.is_empty()
            && let Ok(number) = id.parse::<i64>()
        {
            spec.integer_phase_ids.push(number);
        }
        if name == "Reflect" {
            spec.reflect_leads = phase
                .get("leads")
                .and_then(Value::as_array)
                .map(|leads| leads.iter().filter_map(id_string).collect())
                .or_else(|| phase.get("lead").and_then(id_string).map(|lead| vec![lead]))
                .unwrap_or_default();
        }
        for substep in phase
            .get("substeps")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            let (Some(sub_id), Some(sub_name)) = (
                substep.get("id").and_then(id_string),
                substep.get("name").and_then(Value::as_str),
            ) else {
                continue;
            };
            if sub_name.is_empty() {
                continue;
            }
            spec.phase_names.insert(sub_name.to_string());
            spec.name_by_id.push((sub_id, sub_name.to_string()));
        }
    }

    for gate in raw
        .get("gates")
        .and_then(Value::as_array)
        .unwrap_or(&Vec::new())
    {
        let (Some(id), Some(output)) = (
            gate.get("id").and_then(Value::as_str),
            gate.get("required_output").and_then(Value::as_str),
        ) else {
            continue;
        };
        spec.gate_output.push((id.to_string(), output.to_string()));
        if let Some(dir) = output_dir_of(output) {
            spec.output_dirs.insert(dir);
        }
    }
    for phase in phases {
        for glob in phase
            .get("required_outputs")
            .and_then(Value::as_array)
            .unwrap_or(&Vec::new())
        {
            if let Some(dir) = glob.as_str().and_then(output_dir_of) {
                spec.output_dirs.insert(dir);
            }
        }
    }
    if let Some(dir) = raw
        .get("contract_substep")
        .and_then(|value| value.get("required_output"))
        .and_then(Value::as_str)
        .and_then(output_dir_of)
    {
        spec.output_dirs.insert(dir);
    }

    spec.sources = parse_sources(&raw, &path)?;
    Ok(spec)
}
