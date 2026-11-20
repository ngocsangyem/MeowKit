//! The post-install checks for a Cursor project the kit was installed into.
//! Read-only.
//!
//! Each row checks what the install writes in the form Cursor documents: the
//! hook file (https://cursor.com/docs/hooks), project rules as `.mdc` files
//! with frontmatter (https://cursor.com/docs/rules#rule-file-structure) and a
//! skill's `SKILL.md` (https://cursor.com/docs/skills#skill-directories).
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::result::{CheckResult, Status};
use super::target_helpers::{list_files, row, skills_named_after_folder};

const HOOK_FILE: &str = ".cursor/hooks.json";
const HOOK_SCRIPTS: &str = ".cursor/hooks";
/// The guard scripts the hook file must register.
const GUARDS: [&str; 2] = ["/privacy-read-gate.cjs", "/pre-ship.cjs"];

fn runtime_config(dir: &Path) -> PathBuf {
    dir.join(HOOK_SCRIPTS).join("hook-runtime-config.json")
}

/// The kit's hook scripts are what tell an install from a `.cursor/` the user
/// made: rules or a skills folder alone could be anyone's.
pub fn detects(dir: &Path) -> bool {
    runtime_config(dir).exists()
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    vec![
        hook_file(dir),
        hook_runtime(dir),
        rules(dir),
        skills_named_after_folder("Cursor", dir, ".cursor/skills"),
    ]
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))
}

/// Every command the kit registered names a script that is installed, and
/// both guards are among them.
fn hook_file(dir: &Path) -> CheckResult {
    let name = "Cursor hook file registers installed scripts";
    let doc = match read_json(&dir.join(HOOK_FILE)) {
        Ok(doc) => doc,
        Err(why) => return row(name, Status::Fail, why),
    };
    let Some(events) = doc["hooks"].as_object() else {
        return row(
            name,
            Status::Fail,
            format!("{HOOK_FILE}: no `hooks` object"),
        );
    };
    let mut registered = Vec::new();
    for handler in events
        .values()
        .flat_map(|handlers| handlers.as_array().into_iter().flatten())
    {
        let command = handler["command"].as_str().unwrap_or_default();
        // A handler of the user's own is theirs to keep working.
        let Some(script) = command
            .split_whitespace()
            .find(|word| word.starts_with(HOOK_SCRIPTS))
        else {
            continue;
        };
        if !dir.join(script).is_file() {
            return row(
                name,
                Status::Fail,
                format!("{HOOK_FILE}: the script of `{command}` is not installed"),
            );
        }
        registered.push(script.to_owned());
    }
    for guard in GUARDS {
        if !registered.iter().any(|script| script.ends_with(guard)) {
            return row(
                name,
                Status::Fail,
                format!("{HOOK_FILE}: {guard} is not registered"),
            );
        }
    }
    row(
        name,
        Status::Pass,
        format!(
            "{} kit handlers, each with an installed script",
            registered.len()
        ),
    )
}

/// The guards refuse to run unless the config beside them names this runtime.
fn hook_runtime(dir: &Path) -> CheckResult {
    let name = "Cursor hook scripts are configured for Cursor";
    match read_json(&runtime_config(dir)) {
        Ok(config) if config["runtime"] == "cursor" => {
            row(name, Status::Pass, "runtime config names cursor".into())
        }
        Ok(_) => row(
            name,
            Status::Fail,
            format!("{HOOK_SCRIPTS}/hook-runtime-config.json does not name cursor"),
        ),
        Err(why) => row(name, Status::Fail, why),
    }
}

/// A project rule is an `.mdc` file that starts with frontmatter.
fn rules(dir: &Path) -> CheckResult {
    let name = "Cursor rules each start with frontmatter";
    let files = list_files(&dir.join(".cursor").join("rules"), ".mdc");
    if files.is_empty() {
        return row(
            name,
            Status::Fail,
            "no .mdc rule under .cursor/rules".into(),
        );
    }
    for file in &files {
        let starts = std::fs::read_to_string(file).is_ok_and(|text| text.starts_with("---\n"));
        if !starts {
            return row(
                name,
                Status::Fail,
                format!("{}: no frontmatter", file.display()),
            );
        }
    }
    row(name, Status::Pass, format!("{} rules", files.len()))
}
