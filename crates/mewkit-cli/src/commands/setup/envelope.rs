//! The one mutation envelope `setup --json` prints on stdout.
use mewkit_core::setup::PlannedChange;
use serde_json::{Value, json};

pub(super) struct Envelope {
    dry_run: bool,
    pub planned: Vec<PlannedChange>,
    pub applied: Vec<PlannedChange>,
    /// The human lines that are not change items: step verdicts, warnings, hints.
    pub notes: Vec<String>,
    pub error: Option<String>,
    /// What to do about `error`; never printed without it.
    pub fix: Option<String>,
}

fn change_json(change: &PlannedChange) -> Value {
    match &change.detail {
        Some(detail) => json!({"action": change.action, "path": change.path, "detail": detail}),
        None => json!({"action": change.action, "path": change.path}),
    }
}

impl Envelope {
    pub fn new(dry_run: bool) -> Self {
        Self {
            dry_run,
            planned: Vec::new(),
            applied: Vec::new(),
            notes: Vec::new(),
            error: None,
            fix: None,
        }
    }

    /// Print the envelope when `--json` asked for one.
    pub fn finish(&self, json_mode: bool, exit_code: u8) {
        if !json_mode {
            return;
        }
        let mut doc = json!({
            "ok": exit_code == 0,
            "command": "setup",
            "dryRun": self.dry_run,
            "planned": self.planned.iter().map(change_json).collect::<Vec<_>>(),
            "applied": self.applied.iter().map(change_json).collect::<Vec<_>>(),
            "notes": self.notes,
        });
        if let Some(error) = &self.error {
            doc["error"] = json!(error);
        }
        if let Some(fix) = &self.fix {
            doc["fix"] = json!(fix);
        }
        println!("{}", serde_json::to_string_pretty(&doc).unwrap_or_default());
    }
}
