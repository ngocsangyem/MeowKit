//! The one mutation envelope `pack add|remove --json` prints, and the change
//! list both the text and the JSON forms are built from.
use serde_json::json;

/// One line of a change list: what a run would do, or did, to one path.
pub struct Change {
    pub action: &'static str,
    pub path: String,
}

/// `.claude/`-relative paths as sorted change lines.
pub fn changes(action: &'static str, paths: &[String]) -> Vec<Change> {
    let mut paths: Vec<&String> = paths.iter().collect();
    paths.sort();
    paths
        .into_iter()
        .map(|p| Change {
            action,
            path: format!(".claude/{p}"),
        })
        .collect()
}

pub fn print(
    command: &str,
    dry_run: bool,
    planned: &[Change],
    applied: &[Change],
    notes: &[String],
) {
    let list = |c: &[Change]| {
        c.iter()
            .map(|c| json!({"action": c.action, "path": c.path}))
            .collect::<Vec<_>>()
    };
    let doc = json!({
        "ok": true,
        "command": command,
        "dryRun": dry_run,
        "planned": list(planned),
        "applied": list(applied),
        "notes": notes,
    });
    println!("{}", serde_json::to_string_pretty(&doc).unwrap_or_default());
}
