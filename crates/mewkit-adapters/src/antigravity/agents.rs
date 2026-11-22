//! Antigravity agent definitions: the prompt every reader of the shared tree
//! gets, with the frontmatter Antigravity reads.
//!
//! An agent file is `.agents/agents/<name>.md` with `name`, `description`,
//! `tools` (an explicit list), `model` (`inherit`, `flash` or `pro`) and
//! `mainAgent` / `subagent` (booleans, both default true)
//! (https://antigravity.google/docs/subagents, read 2026-11-22). The page
//! warns that a tool name that does not match may make the agent hang, so only
//! names from the runtime's own tool list are written
//! (https://antigravity.google/docs/hooks, read 2026-11-22); the rest are left
//! out and reported. That each of those names is the same tool in an agent's
//! `tools` list as in a hook matcher is an assumption: the pages show four of
//! them in `tools` and list the rest only as matcher names.
use std::path::Path;

use crate::agents_tree::KIT_DIR;
use crate::contract::{EmitError, Op, Plan};
use crate::cursor::frontmatter::fields;
use crate::kit_files::{self, rel};

/// An authored tool name and Antigravity's tool of the same purpose.
const TOOLS: &[(&str, &str)] = &[
    ("Read", "view_file"),
    ("Grep", "grep_search"),
    ("Glob", "find_by_name"),
    ("Bash", "run_command"),
    ("Write", "write_to_file"),
    ("Edit", "replace_file_content"),
    ("WebSearch", "search_web"),
    ("WebFetch", "read_url_content"),
    ("Task", "invoke_subagent"),
    ("SendMessage", "send_message"),
    ("AskUserQuestion", "ask_question"),
];

/// The `model` for an authored tier. The page names no model behind `flash`
/// and `pro`, so the tiers map by size: the smallest to `flash`, the largest
/// to `pro`, and the middle one follows the session.
const MODELS: &[(&str, &str)] = &[
    ("haiku", "flash"),
    ("sonnet", "inherit"),
    ("opus", "pro"),
    ("fable", "pro"),
];

/// One `.agents/agents/<name>.md` per agent prompt in `plan`, and the authored
/// tool names that have no Antigravity tool.
pub fn definitions(kit_dir: &Path, plan: &Plan) -> Result<(Vec<Op>, Vec<String>), EmitError> {
    let prompts = format!("{KIT_DIR}/agents/");
    let mut ops = Vec::new();
    let mut dropped: Vec<String> = Vec::new();
    for op in &plan.ops {
        let Op::WriteFile { path, bytes, .. } = op else {
            continue;
        };
        let Some(file) = path.as_str().strip_prefix(&prompts) else {
            continue;
        };
        let prompt = std::str::from_utf8(bytes)
            .map_err(|_| EmitError::Kit(format!("{path} is not UTF-8")))?;
        let authored = kit_files::read_text(&kit_dir.join(".claude/agents").join(file))?;
        let (tools, unknown, model) = of_authored(file, &authored)?;
        for name in unknown {
            if !dropped.contains(&name) {
                dropped.push(name);
            }
        }
        let definition = with_keys(prompt, &tools, model);
        if definition == prompt {
            return Err(EmitError::Kit(format!(
                "{path}: no frontmatter to add tools and model to"
            )));
        }
        ops.push(Op::WriteFile {
            path: rel(&format!(".agents/agents/{file}"))?,
            bytes: definition.into_bytes(),
            mode: None,
        });
    }
    dropped.sort();
    Ok((ops, dropped))
}

/// The Antigravity tools for an authored agent's `tools`, the authored names
/// left out, and the model for its tier. `Task(Explore)` names the delegate
/// tool with a limit Antigravity has no form for.
fn of_authored(
    file: &str,
    authored: &str,
) -> Result<(Vec<&'static str>, Vec<String>, &'static str), EmitError> {
    let pairs = fields(authored)
        .map(|(pairs, _)| pairs)
        .ok_or_else(|| EmitError::Kit(format!("agent {file}: no frontmatter")))?;
    let get = |key: &str| {
        pairs
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.as_str())
            .unwrap_or_default()
    };
    let tier = get("model");
    let model = MODELS
        .iter()
        .find(|(t, _)| *t == tier)
        .map(|(_, m)| *m)
        .ok_or_else(|| EmitError::Kit(format!("agent {file}: model `{tier}` has no pin")))?;
    let mut tools = Vec::new();
    let mut unknown = Vec::new();
    for name in get("tools")
        .split(',')
        .map(str::trim)
        .filter(|n| !n.is_empty())
    {
        let bare = name.split('(').next().unwrap_or(name);
        match TOOLS.iter().find(|(from, _)| *from == bare) {
            Some((_, to)) if !tools.contains(to) => tools.push(*to),
            Some(_) => {}
            None => unknown.push(name.to_owned()),
        }
    }
    Ok((tools, unknown, model))
}

/// `prompt` with `tools` and `model` lines closing its frontmatter. An agent
/// that authored no tools gets no list, which Antigravity reads as its
/// default.
fn with_keys(prompt: &str, tools: &[&str], model: &str) -> String {
    let mut keys = String::new();
    if !tools.is_empty() {
        keys.push_str(&format!("\ntools: [{}]", tools.join(", ")));
    }
    // The kit's agents are for delegation, not for starting a session with.
    keys.push_str(&format!(
        "\nmodel: {model}\nmainAgent: false\nsubagent: true"
    ));
    prompt.replacen("\n---\n", &format!("{keys}\n---\n"), 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_tools_are_renamed_and_the_rest_reported() {
        let authored = "---\nname: a\ndescription: d\ntools: Read, Bash, WebFetch, Task(Explore), TaskCreate, Read\nmodel: sonnet\n---\n\nBody\n";
        let (tools, unknown, model) = of_authored("a.md", authored).unwrap();
        assert_eq!(
            tools,
            [
                "view_file",
                "run_command",
                "read_url_content",
                "invoke_subagent"
            ]
        );
        assert_eq!(unknown, ["TaskCreate"]);
        assert_eq!(model, "inherit");
        assert_eq!(
            with_keys(
                "---\nname: a\ndescription: \"d\"\n---\n\nBody\n---\n",
                &tools,
                model
            ),
            "---\nname: a\ndescription: \"d\"\ntools: [view_file, run_command, read_url_content, invoke_subagent]\nmodel: inherit\nmainAgent: false\nsubagent: true\n---\n\nBody\n---\n"
        );
    }

    #[test]
    fn an_unpinned_tier_is_refused() {
        let err = of_authored("a.md", "---\nname: a\nmodel: gpt\n---\n").unwrap_err();
        assert!(err.to_string().contains("model `gpt` has no pin"));
    }
}
