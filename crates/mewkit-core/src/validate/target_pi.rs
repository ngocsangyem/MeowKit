//! The post-install checks for a Pi project the kit was installed into.
//! Read-only. Pi's forms: packages/coding-agent/docs/extensions.md and
//! skills.md of @earendil-works/pi-coding-agent 1.5.2.
use std::path::Path;

use super::result::{CheckResult, Status};
use super::target_agents_tree::{present, rows};
use super::target_helpers::row;

const EXTENSION: &str = ".pi/extensions/meowkit.ts";

/// The extension is the one file only a Pi install writes.
pub fn detects(dir: &Path) -> bool {
    dir.join(EXTENSION).is_file()
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    let mut out = rows("Pi", dir);
    out.push(present("Pi", "guard extension", dir, EXTENSION));
    // Pi takes the first skill of a name it finds and warns about the other.
    let name = "Pi has one skills folder from the kit";
    let twice = dir.join(".pi/skills").is_dir()
        && super::dir_order::sorted_names(&dir.join(".pi/skills"))
            .iter()
            .any(|folder| dir.join(".agents/skills").join(folder).is_dir());
    out.push(if twice {
        row(
            name,
            Status::Fail,
            "a skill is in .pi/skills and in .agents/skills".into(),
        )
    } else {
        row(name, Status::Pass, ".agents/skills only".into())
    });
    out
}
