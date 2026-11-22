//! What the kit's coverage file (`.claude/hooks/hook-coverage.json`) says about
//! a runtime's guards, read the same way by `mewkit init` and `mewkit doctor`.
//!
//! A guard marked `unverified` is installed and runs the shared decision, but
//! was built from the runtime's documentation and no live run has shown it
//! deny. Both commands name every such guard, so an install is not read as
//! protection it has not been seen to give.
use std::path::Path;

use serde_json::Value;

/// The coverage file, relative to the kit root.
pub const FILE: &str = ".claude/hooks/hook-coverage.json";

/// The coverage file of the kit at `kit_dir`, or `None` when it is missing or
/// not JSON.
pub fn read(kit_dir: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(kit_dir.join(FILE)).ok()?;
    serde_json::from_str(&text).ok()
}

/// Each safety behaviour `runtime` carries as `unverified`, with the installed
/// script that runs it (the first word of the row's `where`), in file order.
pub fn unverified(doc: &Value, runtime: &str) -> Vec<(String, String)> {
    doc["safety"]
        .as_object()
        .into_iter()
        .flatten()
        .filter(|(_, row)| row[runtime]["status"] == "unverified")
        .map(|(name, row)| {
            let script = row[runtime]["where"]
                .as_str()
                .and_then(|w| w.split_whitespace().next())
                .unwrap_or("its hook script");
            (name.clone(), script.to_owned())
        })
        .collect()
}

/// `privacy (path), pre-ship (path)`: the list as one line.
pub fn describe(guards: &[(String, String)]) -> String {
    guards
        .iter()
        .map(|(name, script)| format!("{name} ({script})"))
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::{describe, unverified};

    #[test]
    fn lists_only_the_unverified_rows_of_the_runtime_asked_about() {
        let doc = serde_json::json!({
            "safety": {
                "privacy": {
                    "antigravity": { "status": "unverified", "where": ".agents/x/privacy-block.cjs (hooks.json)" },
                    "grok": { "status": "ported", "where": ".grok/p.cjs" }
                },
                "pre-ship": { "antigravity": { "status": "not-ported", "reason": "r" } }
            }
        });
        let list = unverified(&doc, "antigravity");
        assert_eq!(describe(&list), "privacy (.agents/x/privacy-block.cjs)");
        assert!(unverified(&doc, "grok").is_empty());
        assert!(unverified(&serde_json::json!({}), "antigravity").is_empty());
    }
}
