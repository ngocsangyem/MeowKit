//! Reading the pointer that names the current task.
//!
//! Two readers, because there are two pointer generations. The canonical one
//! identifies a TASK by id; a pre-canonical one carries a plan path or slug and
//! is resolved to a task by EXACT normalized matching only, never a substring.
//! Both live in the same file, so the shape decides which reader applies.
use std::path::Path;

use serde_json::Value;

use crate::schema::active_task_pointer::ActiveTaskPointer;
use crate::schema::task_record::is_valid_task_id;
use crate::state_paths::resolve_session_state_file;

const POINTER_JSON: &str = "active-plan.json";
/// The plain-text pointer a pre-canonical writer left behind.
const POINTER_TEXT: &str = "active-plan";

/// A pointer file that exists but cannot be read AT ALL (not merely one with
/// unexpected content, which falls through to the next reader). It is the one
/// failure the orientation path lets through: an unreadable pointer means the
/// answer would be a guess about which task is current.
#[derive(Debug, thiserror::Error)]
#[error("cannot read the active-task pointer {path}: {source}")]
pub struct PointerError {
    pub path: String,
    pub source: std::io::Error,
}

/// How the pointer was read. `Legacy` support is temporary.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActiveTaskPointerRead {
    Canonical(ActiveTaskPointer),
    Legacy { plan_ref: String },
}

impl ActiveTaskPointerRead {
    /// The diagnostic label the orientation envelope reports.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::Canonical(_) => "canonical",
            Self::Legacy { .. } => "legacy",
        }
    }
}

/// Read the active-task pointer. JSON is parsed FIRST: a payload with a valid
/// `taskId` is canonical; one with only `path`/`slug` is a legacy plan
/// reference. The plain-text file is the last fallback. Content that does not
/// fit either shape is not an error — it falls through, and absence is
/// reported as `None`.
pub fn read_active_task_pointer(
    project_root: &Path,
) -> Result<Option<ActiveTaskPointerRead>, PointerError> {
    let json_path = resolve_session_state_file(project_root, POINTER_JSON);
    if json_path.exists()
        && let Ok(text) = std::fs::read_to_string(&json_path)
        && let Ok(raw) = serde_json::from_str::<Value>(&text)
    {
        if let Some(id) = raw.get("taskId").and_then(Value::as_str) {
            // A valid id commits to the canonical reader; a pointer
            // whose other fields are wrong then falls through, the way
            // a thrown schema parse does on the TypeScript side.
            if is_valid_task_id(id)
                && let Ok(pointer) = ActiveTaskPointer::parse(&raw)
            {
                return Ok(Some(ActiveTaskPointerRead::Canonical(pointer)));
            }
        }
        if let Some(plan_ref) = plan_ref_of(&raw) {
            return Ok(Some(ActiveTaskPointerRead::Legacy { plan_ref }));
        }
    }
    let text_path = resolve_session_state_file(project_root, POINTER_TEXT);
    if text_path.exists() {
        let plan_ref = read_or_fail(&text_path)?;
        let plan_ref = plan_ref.trim();
        if !plan_ref.is_empty() {
            return Ok(Some(ActiveTaskPointerRead::Legacy {
                plan_ref: plan_ref.to_string(),
            }));
        }
    }
    Ok(None)
}

/// The current active-plan pointer as a plain string, mirroring the hook
/// contract (`active-plan.json` → `path` || `slug`, else the plain-text file).
/// `None` when absent.
pub fn read_active_plan_pointer(project_root: &Path) -> Result<Option<String>, PointerError> {
    let json_path = resolve_session_state_file(project_root, POINTER_JSON);
    if json_path.exists()
        && let Ok(text) = std::fs::read_to_string(&json_path)
        && let Ok(raw) = serde_json::from_str::<Value>(&text)
        && let Some(plan_ref) = plan_ref_of(&raw)
    {
        return Ok(Some(plan_ref));
    }
    let text_path = resolve_session_state_file(project_root, POINTER_TEXT);
    if text_path.exists() {
        let text = read_or_fail(&text_path)?;
        let text = text.trim();
        if !text.is_empty() {
            return Ok(Some(text.to_string()));
        }
    }
    Ok(None)
}

/// `path`, else `slug`, trimmed and non-empty.
///
/// The FIRST non-empty string of the two is chosen, and only then trimmed: an
/// all-whitespace `path` still shadows `slug`, because the JavaScript reader
/// picks with `||` (empty is falsy, whitespace is not) before it trims.
fn plan_ref_of(raw: &Value) -> Option<String> {
    let chosen = ["path", "slug"]
        .iter()
        .filter_map(|key| raw.get(*key).and_then(Value::as_str))
        .find(|value| !value.is_empty())?;
    let trimmed = chosen.trim();
    (!trimmed.is_empty()).then(|| trimmed.to_string())
}

/// The plain-text pointer is read WITHOUT a fallback: it is the last reader, so
/// swallowing its failure would report "no current task" for a pointer that is
/// merely unreadable — a different fact, and the dangerous one to guess at.
fn read_or_fail(path: &Path) -> Result<String, PointerError> {
    std::fs::read_to_string(path).map_err(|source| PointerError {
        path: path.display().to_string(),
        source,
    })
}
