//! `doctor --adopt`: rebuild the npm CLI's ownership baseline from the local
//! kit cache, or refuse. Nothing is written on a refusal: a partial baseline
//! is worse than none.
//!
//! A runtime that `mewkit-next` installed is refused too: its ownership index
//! is the record there, and a second baseline beside it would disagree.
use std::path::Path;

use mewkit_core::baseline::{plan_adoption, write_install_metadata};
use serde_json::{Value, json};

use crate::failure::Failure;

/// The `mewkit-next` ownership index for claude-code here, if it is a real one.
fn next_index(root: &Path) -> Option<std::path::PathBuf> {
    let file = root.join(".meowkit/state/ownership/claude-code.json");
    let parsed: Value = serde_json::from_slice(&std::fs::read(&file).ok()?).ok()?;
    (parsed.get("schema_version").is_some() && parsed.get("paths").is_some()).then_some(file)
}

fn pretty(v: &Value) -> String {
    serde_json::to_string_pretty(v).unwrap_or_default()
}

pub fn run(root: Option<&Path>, json: bool) -> Result<u8, Failure> {
    let Some(root) = root else {
        if json {
            println!(
                "{}",
                pretty(&json!({"ok": false, "message": "No project here."}))
            );
        } else {
            eprintln!("No MeowKit project here.");
        }
        return Ok(1);
    };
    if let Some(index) = next_index(root) {
        let message = format!(
            "mewkit doctor --adopt: claude-code here was installed by mewkit-next ({}).\n  Manage it with mewkit-next instead: `mewkit-next upgrade`, `mewkit-next uninstall --target claude-code`.",
            index.display()
        );
        if json {
            println!("{}", pretty(&json!({"ok": false, "message": message})));
        } else {
            eprintln!("{message}");
        }
        return Ok(1);
    }
    let plan = match plan_adoption(root) {
        Ok(plan) => plan,
        Err((message, fix)) => {
            if json {
                let mut result = json!({"ok": false, "message": message});
                if let Some(fix) = fix {
                    result["fix"] = fix.into();
                }
                println!("{}", pretty(&result));
            } else {
                eprintln!("{message}");
                if let Some(fix) = fix {
                    eprintln!("Fix: {fix}");
                }
            }
            return Ok(1);
        }
    };
    write_install_metadata(root, &plan.meta)?;
    let c = &plan.counts;
    let message = format!(
        "Adopted {} file(s) against the cached kit {}: {} unchanged, {} edited, {} yours.",
        plan.meta.files.len(),
        plan.meta.version,
        c.meowkit,
        c.modified,
        c.user
    );
    if json {
        let result = json!({
            "ok": true,
            "message": message,
            "counts": {"meowkit": c.meowkit, "modified": c.modified, "user": c.user},
            "version": plan.meta.version,
        });
        println!("{}", pretty(&result));
    } else {
        println!("{message}");
        println!(
            "A file the cached kit does not hold is recorded as yours, so uninstall can never delete it as kit content."
        );
    }
    Ok(0)
}
