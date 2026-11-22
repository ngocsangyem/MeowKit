//! The post-install checks for an Antigravity project the kit was installed
//! into. Read-only. Antigravity's forms: https://antigravity.google/docs/skills,
//! /docs/rules, /docs/subagents and /docs/hooks, read 2026-11-22 (documentation
//! only; no install of the runtime was available to probe).
use std::path::Path;

use super::result::{CheckResult, Status};
use super::target_agents_tree::rows;
use super::target_helpers::row;

/// The kit's rule files all start with this; a rule file the user wrote
/// beside them is not judged here.
const RULE_PREFIX: &str = "meowkit-";
/// A rule file past this many bytes is truncated by Antigravity.
const MAX_RULE_BYTES: u64 = 24_000;
/// The values of `trigger` Antigravity accepts; any other discards the rule.
const TRIGGERS: [&str; 4] = ["always_on", "model_decision", "glob", "manual"];
/// The values of an agent's `model`.
const MODELS: [&str; 3] = ["inherit", "flash", "pro"];
/// The tool names the kit writes into an agent's `tools`: the runtime's own
/// names, from the hooks page's tool list.
const TOOLS: [&str; 11] = [
    "view_file",
    "grep_search",
    "find_by_name",
    "run_command",
    "write_to_file",
    "replace_file_content",
    "search_web",
    "read_url_content",
    "invoke_subagent",
    "send_message",
    "ask_question",
];

/// The kit's skills are the one thing every Antigravity install writes: the
/// folder name is shared with Codex, Pi and OMP, so only a `mk-` skill counts.
pub fn detects(dir: &Path) -> bool {
    super::dir_order::sorted_names(&dir.join(".agents/skills"))
        .iter()
        .any(|folder| folder.starts_with("mk-"))
}

pub fn check(dir: &Path) -> Vec<CheckResult> {
    let mut out = rows("Antigravity", dir);
    out.push(rules(dir));
    out.push(agents(dir));
    out.push(guards(dir));
    out
}

/// The frontmatter lines of `text`, or `None` when it has no frontmatter.
fn frontmatter(text: &str) -> Option<&str> {
    text.strip_prefix("---\n")
        .and_then(|rest| rest.split_once("\n---"))
        .map(|(head, _)| head)
}

fn value<'a>(front: &'a str, key: &str) -> Option<&'a str> {
    front
        .lines()
        .find_map(|line| line.strip_prefix(key)?.strip_prefix(':'))
        .map(|v| v.trim().trim_matches('"'))
        .filter(|v| !v.is_empty())
}

/// Antigravity silently discards a rule file with no valid `trigger`, and cuts
/// one over 24,000 bytes; each kit rule file must avoid both.
fn rules(dir: &Path) -> CheckResult {
    let name = "Antigravity rule files have a valid trigger and fit the size cut";
    let root = dir.join(".agents/rules");
    let mut count = 0;
    for file in super::dir_order::sorted_names(&root) {
        if !file.starts_with(RULE_PREFIX) || !file.ends_with(".md") {
            continue;
        }
        let at = format!(".agents/rules/{file}");
        let path = root.join(&file);
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        if size > MAX_RULE_BYTES {
            return row(
                name,
                Status::Fail,
                format!("{at}: {size} bytes, over the {MAX_RULE_BYTES}-byte cut"),
            );
        }
        let text = std::fs::read_to_string(&path).unwrap_or_default();
        let Some(front) = frontmatter(&text) else {
            return row(
                name,
                Status::Fail,
                format!("{at}: no frontmatter, so Antigravity discards the rule"),
            );
        };
        let Some(trigger) = value(front, "trigger") else {
            return row(
                name,
                Status::Fail,
                format!("{at}: no `trigger`, so Antigravity discards the rule"),
            );
        };
        if !TRIGGERS.contains(&trigger) {
            return row(
                name,
                Status::Fail,
                format!(
                    "{at}: `trigger: {trigger}` is not one of {}",
                    TRIGGERS.join(", ")
                ),
            );
        }
        if trigger == "model_decision" && value(front, "description").is_none() {
            return row(name, Status::Fail, format!("{at}: no `description`"));
        }
        if trigger == "glob" && value(front, "globs").or(value(front, "glob")).is_none() {
            return row(name, Status::Fail, format!("{at}: no `globs`"));
        }
        count += 1;
    }
    if count == 0 {
        return row(
            name,
            Status::Fail,
            "no meowkit rule under .agents/rules".into(),
        );
    }
    row(name, Status::Pass, format!("{count} rule files"))
}

/// Every kit agent prompt in `.agents/meowkit/agents/` has a definition in
/// `.agents/agents/` with a name, a description, a model Antigravity knows
/// and tool names from its own list: a name that does not match may make an
/// agent hang.
fn agents(dir: &Path) -> CheckResult {
    let name = "Antigravity agents have a name, a description, a known model and known tools";
    let mut count = 0;
    for file in super::dir_order::sorted_names(&dir.join(".agents/meowkit/agents")) {
        if !file.ends_with(".md") {
            continue;
        }
        let at = format!(".agents/agents/{file}");
        let Ok(text) = std::fs::read_to_string(dir.join(&at)) else {
            return row(name, Status::Fail, format!("{at}: not installed"));
        };
        let front = frontmatter(&text).unwrap_or_default();
        if value(front, "name").is_none() || value(front, "description").is_none() {
            return row(
                name,
                Status::Fail,
                format!("{at}: no `name` or no `description`"),
            );
        }
        let model = value(front, "model").unwrap_or_default();
        if !MODELS.contains(&model) {
            return row(
                name,
                Status::Fail,
                format!("{at}: `model: {model}` is not one of {}", MODELS.join(", ")),
            );
        }
        let tools = value(front, "tools").unwrap_or_default();
        let list = tools.trim_start_matches('[').trim_end_matches(']');
        if let Some(unknown) = list
            .split(',')
            .map(str::trim)
            .find(|tool| !tool.is_empty() && !TOOLS.contains(tool))
        {
            return row(
                name,
                Status::Fail,
                format!("{at}: `{unknown}` is not an Antigravity tool the kit writes"),
            );
        }
        count += 1;
    }
    if count == 0 {
        return row(
            name,
            Status::Fail,
            "no agent prompt under .agents/meowkit/agents".into(),
        );
    }
    row(name, Status::Pass, format!("{count} agents"))
}

/// The kit installs no Antigravity hook. A project whose `.agents/hooks.json`
/// is the user's own is left alone; the row says what is and is not running.
fn guards(dir: &Path) -> CheckResult {
    let name = "Antigravity guards";
    if dir.join(".agents/hooks.json").is_file() {
        return row(
            name,
            Status::Warn,
            "guards not installed by the kit; .agents/hooks.json is yours and is not checked here"
                .into(),
        );
    }
    row(
        name,
        Status::Warn,
        "guards not installed: no privacy guard and no ship check run on Antigravity".into(),
    )
}
