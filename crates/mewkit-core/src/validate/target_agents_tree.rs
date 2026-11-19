//! Rows shared by the runtimes that install the `.agents/` tree (Pi, OMP):
//! the instruction file, the guard script and its config, and the skills.
use std::path::Path;

use super::result::{CheckResult, Status};
use super::target_helpers::row;

const GUARD_DIR: &str = ".agents/meowkit/hooks";

pub fn present(label: &str, what: &str, dir: &Path, rel: &str) -> CheckResult {
    let name = format!("{label} {what} present");
    if dir.join(rel).is_file() {
        row(&name, Status::Pass, rel.to_owned())
    } else {
        row(&name, Status::Fail, format!("Missing: {rel}"))
    }
}

/// `AGENTS.md`, the guard and the skills, each named for `label`.
pub fn rows(label: &str, dir: &Path) -> Vec<CheckResult> {
    vec![
        present(label, "AGENTS.md", dir, "AGENTS.md"),
        guard(label, dir),
        skills(label, dir),
    ]
}

/// The guard refuses to run unless the config beside it names this tree.
fn guard(label: &str, dir: &Path) -> CheckResult {
    let name = format!("{label} guard script is installed and configured");
    // The script and the decisions it loads: without one of them it answers
    // nothing, and the module that runs it then blocks every call.
    let files = [
        "guard.cjs",
        "lib/hook-runtime.cjs",
        "lib/core/privacy.cjs",
        "lib/core/pre-ship.cjs",
    ];
    if let Some(file) = files
        .iter()
        .find(|f| !dir.join(GUARD_DIR).join(f).is_file())
    {
        return row(&name, Status::Fail, format!("Missing: {GUARD_DIR}/{file}"));
    }
    let config = std::fs::read_to_string(dir.join(GUARD_DIR).join("hook-runtime-config.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok());
    match config {
        Some(config) if config["runtime"] == "agents" => {
            row(&name, Status::Pass, "runtime config names this tree".into())
        }
        _ => row(
            &name,
            Status::Fail,
            format!(
                "{GUARD_DIR}/hook-runtime-config.json is missing or names another tree, so the guard blocks every call"
            ),
        ),
    }
}

/// A skill is a folder holding a `SKILL.md` with a `name` and a `description`;
/// Pi loads none without a description, and both runtimes list it by `name`.
fn skills(label: &str, dir: &Path) -> CheckResult {
    let name = format!("{label} skills each have a name and a description");
    let root = dir.join(".agents").join("skills");
    let mut count = 0;
    for folder in super::dir_order::sorted_names(&root) {
        // A folder the kit did not install is the user's own and is not judged here.
        if !root.join(&folder).is_dir() || !folder.starts_with("mk-") {
            continue;
        }
        let at = format!(".agents/skills/{folder}/SKILL.md");
        let Ok(text) = std::fs::read_to_string(root.join(&folder).join("SKILL.md")) else {
            return row(&name, Status::Fail, format!("{at}: not readable"));
        };
        let frontmatter = text
            .strip_prefix("---\n")
            .and_then(|rest| rest.split_once("\n---"))
            .map(|(head, _)| head)
            .unwrap_or_default();
        let has = |key: &str| {
            frontmatter
                .lines()
                .any(|line| line.strip_prefix(key).is_some_and(|v| !v.trim().is_empty()))
        };
        if !has("name:") || !has("description:") {
            return row(
                &name,
                Status::Fail,
                format!("{at}: no `name` or no `description`"),
            );
        }
        count += 1;
    }
    if count == 0 {
        return row(&name, Status::Fail, "no skill under .agents/skills".into());
    }
    row(&name, Status::Pass, format!("{count} skills"))
}
