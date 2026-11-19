//! The post-install checks for a Grok project the kit was installed into.
//! Read-only.
//!
//! Each row checks a form the vendor documents: the hook file's shape
//! (https://docs.x.ai/build/features/hooks) and a skill's `SKILL.md`
//! (https://docs.x.ai/build/features/skills-plugins-marketplaces).
use std::path::{Path, PathBuf};

use serde_json::Value;

use super::result::{CheckResult, Status};
use super::target_helpers::row;

const HOOK_FILE: &str = ".grok/hooks/meowkit.json";
const HOOK_SCRIPTS: &str = ".grok/meowkit/hooks";
/// The guard scripts the hook file must register.
const GUARDS: [&str; 2] = ["/privacy-block.cjs", "/pre-ship.cjs"];
/// The only event whose hook can stop a call.
const BLOCKING_EVENT: &str = "PreToolUse";

fn runtime_config(dir: &Path) -> PathBuf {
    dir.join(HOOK_SCRIPTS).join("hook-runtime-config.json")
}

/// The kit's hook scripts are what tell an install from a `.grok/` the user
/// made: a root `AGENTS.md` or a skills folder alone could be anyone's.
pub fn detects(dir: &Path) -> bool {
    runtime_config(dir).exists()
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    let mut rows = vec![if dir.join("AGENTS.md").exists() {
        row(
            "Grok AGENTS.md present",
            Status::Pass,
            "instruction surface exists".into(),
        )
    } else {
        row(
            "Grok AGENTS.md present",
            Status::Fail,
            format!("Missing: {}", dir.join("AGENTS.md").display()),
        )
    }];
    rows.push(hook_file(dir));
    rows.push(hook_runtime(dir));
    rows.push(skills(dir));
    rows
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))
}

/// Every handler is a command with a timeout, registered on the blocking
/// event, and the script it runs exists.
fn hook_file(dir: &Path) -> CheckResult {
    let name = "Grok hook file in the documented form";
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
    let mut handlers = 0;
    let mut registered = Vec::new();
    for (event, groups) in events {
        if event != BLOCKING_EVENT {
            return row(
                name,
                Status::Fail,
                format!(
                    "{HOOK_FILE}: a guard on {event} cannot block; Grok blocks on {BLOCKING_EVENT} only"
                ),
            );
        }
        for handler in groups
            .as_array()
            .into_iter()
            .flatten()
            .flat_map(|group| group["hooks"].as_array().into_iter().flatten())
        {
            handlers += 1;
            let command = handler["command"].as_str().unwrap_or_default();
            if handler["type"] != "command" || !handler["timeout"].is_u64() {
                return row(
                    name,
                    Status::Fail,
                    format!(
                        "{HOOK_FILE}: the kit writes every handler with `type: command` and a `timeout` in seconds: {command}"
                    ),
                );
            }
            let script = command
                .split('"')
                .find_map(|part| part.strip_prefix("$GROK_WORKSPACE_ROOT/"));
            match script {
                Some(script) if dir.join(script).is_file() => registered.push(script.to_owned()),
                _ => {
                    return row(
                        name,
                        Status::Fail,
                        format!("{HOOK_FILE}: the script of `{command}` is not installed"),
                    );
                }
            }
        }
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
            "{handlers} handlers on {BLOCKING_EVENT}, each with a timeout and an installed script"
        ),
    )
}

/// The guards refuse to run unless the config beside them names this runtime.
fn hook_runtime(dir: &Path) -> CheckResult {
    let name = "Grok hook scripts are configured for Grok";
    match read_json(&runtime_config(dir)) {
        Ok(config) if config["runtime"] == "grok" => {
            row(name, Status::Pass, "runtime config names grok".into())
        }
        Ok(_) => row(
            name,
            Status::Fail,
            format!(
                "{HOOK_SCRIPTS}/hook-runtime-config.json does not name grok, so the guards deny every call"
            ),
        ),
        Err(why) => row(name, Status::Fail, why),
    }
}

/// A skill is a folder holding a `SKILL.md` that starts with frontmatter and
/// whose `name`, when given, is the folder's name.
fn skills(dir: &Path) -> CheckResult {
    let name = "Grok skills each have a SKILL.md named after their folder";
    let root = dir.join(".grok").join("skills");
    let mut count = 0;
    for folder in super::dir_order::sorted_names(&root) {
        let folder_path = root.join(&folder);
        if !folder_path.is_dir() {
            continue;
        }
        let Ok(text) = std::fs::read_to_string(folder_path.join("SKILL.md")) else {
            return row(
                name,
                Status::Fail,
                format!(".grok/skills/{folder}: no readable SKILL.md"),
            );
        };
        let Some(frontmatter) = text
            .strip_prefix("---\n")
            .and_then(|rest| rest.split_once("\n---"))
            .map(|(head, _)| head)
        else {
            return row(
                name,
                Status::Fail,
                format!(".grok/skills/{folder}/SKILL.md: no frontmatter"),
            );
        };
        let declared = frontmatter
            .lines()
            .find_map(|line| line.strip_prefix("name:"))
            .map(|value| value.trim().trim_matches(['"', '\'']));
        if declared.is_some_and(|declared| declared != folder) {
            return row(
                name,
                Status::Fail,
                format!(".grok/skills/{folder}/SKILL.md: `name` is not `{folder}`"),
            );
        }
        count += 1;
    }
    if count == 0 {
        return row(name, Status::Fail, "no skill under .grok/skills".into());
    }
    row(name, Status::Pass, format!("{count} skills"))
}
