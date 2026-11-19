//! The post-install checks for an OMP project the kit was installed into.
//! Read-only. OMP's forms: @oh-my-pi/pi-coding-agent 18.13.3
//! `src/discovery/helpers.ts` (agent frontmatter) and
//! `src/tools/builtin-names.ts` (tool names).
use std::path::Path;

use super::result::{CheckResult, Status};
use super::target_agents_tree::{present, rows};
use super::target_helpers::row;

const HOOK: &str = ".omp/hooks/pre/meowkit.ts";
/// The built-in tool names an agent's `tools` list may hold.
const BUILTIN_TOOLS: &[&str] = &[
    "read",
    "bash",
    "edit",
    "ast_grep",
    "ast_edit",
    "ask",
    "debug",
    "ida",
    "eval",
    "github",
    "glob",
    "grep",
    "find",
    "lsp",
    "checkpoint",
    "rewind",
    "context_notes",
    "new_context",
    "security_scan",
    "task",
    "wait",
    "todo",
    "web_search",
    "write",
    "memory_edit",
    "retain",
    "recall",
    "reflect",
    "learn",
    "manage_skill",
];

/// The hook module is the one file only an OMP install writes.
pub fn detects(dir: &Path) -> bool {
    dir.join(HOOK).is_file()
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    let mut out = rows("OMP", dir);
    out.push(present("OMP", "guard hook module", dir, HOOK));
    out.push(agents(dir));
    out
}

/// OMP skips an agent with no `name` or `description`, and keeps a tool name
/// it does not know as written, where it allows nothing.
fn agents(dir: &Path) -> CheckResult {
    let name = "OMP agents have a name, a description and built-in tool names";
    let root = dir.join(".omp").join("agents");
    let mut count = 0;
    for file in super::dir_order::sorted_names(&root) {
        if !file.ends_with(".md") {
            continue;
        }
        let at = format!(".omp/agents/{file}");
        let text = std::fs::read_to_string(root.join(&file)).unwrap_or_default();
        let frontmatter = text
            .strip_prefix("---\n")
            .and_then(|rest| rest.split_once("\n---"))
            .map(|(head, _)| head)
            .unwrap_or_default();
        let value = |key: &str| {
            frontmatter
                .lines()
                .find_map(|line| line.strip_prefix(key))
                .map(str::trim)
                .filter(|v| !v.is_empty())
        };
        if value("name:").is_none() || value("description:").is_none() {
            return row(
                name,
                Status::Fail,
                format!("{at}: no `name` or no `description`"),
            );
        }
        let tools = value("tools:").unwrap_or_default();
        if let Some(unknown) = tools
            .split(',')
            .map(str::trim)
            .find(|tool| !tool.is_empty() && !BUILTIN_TOOLS.contains(tool))
        {
            return row(
                name,
                Status::Fail,
                format!("{at}: `{unknown}` is not an OMP built-in tool"),
            );
        }
        count += 1;
    }
    if count == 0 {
        return row(name, Status::Fail, "no agent under .omp/agents".into());
    }
    row(name, Status::Pass, format!("{count} agents"))
}
