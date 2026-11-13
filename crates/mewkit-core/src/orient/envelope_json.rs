//! The `--json` projection of the orientation envelope.
//!
//! Split out because the KEY ORDER is the contract: this document is compared
//! field for field against the one the npm CLI prints, and that order is an
//! artifact of how its builder spreads a defaults object (the defaults first,
//! `outcome` appended last). Keeping the projection in its own file keeps that
//! reasoning next to the only code it governs.
use serde_json::{Map, Value, json};

use super::envelope::{ORIENT_ENVELOPE_SCHEMA_VERSION, OrientEnvelope};

impl OrientEnvelope {
    /// The `--json` document. Key order is the one the TypeScript builder
    /// produces (its defaults object first, `outcome` appended by the spread),
    /// because this output is compared field for field against that CLI's.
    pub fn to_json(&self) -> Value {
        let mut out = Map::new();
        out.insert(
            "schemaVersion".into(),
            ORIENT_ENVELOPE_SCHEMA_VERSION.into(),
        );
        out.insert(
            "activeTask".into(),
            match &self.active_task {
                None => Value::Null,
                Some(task) => json!({
                    "taskId": task.task_id,
                    "status": task.status(),
                    "planPath": task.plan_path,
                    "planSlug": task.plan_slug,
                    "currentStep": task.current_step,
                    "nextAction": task.next_action,
                    "blockers": task.blockers,
                }),
            },
        );
        out.insert("candidates".into(), json!(self.candidates));
        out.insert("staleWarnings".into(), json!(self.stale_warnings));
        out.insert(
            "issues".into(),
            Value::Array(
                self.issues
                    .iter()
                    .map(|i| json!({"taskId": i.task_id, "problem": i.problem}))
                    .collect(),
            ),
        );
        out.insert("pointerKind".into(), self.pointer_kind.into());
        out.insert("outcome".into(), self.outcome.as_str().into());
        Value::Object(out)
    }
}
