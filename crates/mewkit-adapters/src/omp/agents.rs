//! OMP agent definitions: the prompt every reader of the shared tree gets,
//! with the tool list OMP takes.
//!
//! OMP reads `name`, `description` and `tools` from an agent's frontmatter
//! and uses `tools` as the agent's allow-list; a name it does not know is
//! kept as written, where it matches nothing
//! (@oh-my-pi/pi-coding-agent 18.13.3 `src/discovery/helpers.ts`,
//! `src/tools/builtin-names.ts`). So only names from that file are written.
use std::path::Path;

use crate::agents_tree::KIT_DIR;
use crate::contract::{EmitError, Op, Plan};
use crate::cursor::frontmatter::fields;
use crate::kit_files::{self, rel};

/// An authored tool name and OMP's built-in of the same purpose.
const TOOLS: &[(&str, &str)] = &[
    ("Read", "read"),
    ("Grep", "grep"),
    ("Glob", "glob"),
    ("Bash", "bash"),
    ("Write", "write"),
    ("Edit", "edit"),
    ("WebSearch", "web_search"),
    ("Task", "task"),
    ("AskUserQuestion", "ask"),
];

/// One `.omp/agents/<name>.md` per agent prompt in `plan`, and the authored
/// tool names that have no OMP built-in.
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
        let (tools, unknown) = tools_of(&authored);
        for name in unknown {
            if !dropped.contains(&name) {
                dropped.push(name);
            }
        }
        let definition = with_tools(prompt, &tools);
        // Left without its list, OMP would give the agent its default tools,
        // more than the agent was authored with.
        if !tools.is_empty() && definition == prompt {
            return Err(EmitError::Kit(format!(
                "{path}: no frontmatter to add tools to"
            )));
        }
        ops.push(Op::WriteFile {
            path: rel(&format!(".omp/agents/{file}"))?,
            bytes: definition.into_bytes(),
            mode: None,
        });
    }
    dropped.sort();
    Ok((ops, dropped))
}

/// The OMP names for an authored agent's `tools`, and the authored names left
/// out. `Task(Explore)` names the delegate tool with a limit OMP has no form for.
fn tools_of(authored: &str) -> (Vec<&'static str>, Vec<String>) {
    let line = fields(authored)
        .and_then(|(pairs, _)| pairs.into_iter().find(|(k, _)| k == "tools"))
        .map(|(_, v)| v)
        .unwrap_or_default();
    let mut tools = Vec::new();
    let mut unknown = Vec::new();
    for name in line.split(',').map(str::trim).filter(|n| !n.is_empty()) {
        let bare = name.split('(').next().unwrap_or(name);
        match TOOLS.iter().find(|(from, _)| *from == bare) {
            Some((_, to)) if !tools.contains(to) => tools.push(*to),
            Some(_) => {}
            None => unknown.push(name.to_owned()),
        }
    }
    (tools, unknown)
}

/// `prompt` with a `tools` line closing its frontmatter. An agent that
/// authored no tools gets none here either, which OMP reads as its defaults.
fn with_tools(prompt: &str, tools: &[&str]) -> String {
    if tools.is_empty() {
        return prompt.to_owned();
    }
    prompt.replacen(
        "\n---\n",
        &format!("\ntools: {}\n---\n", tools.join(", ")),
        1,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_tools_are_renamed_and_the_rest_reported() {
        let authored = "---\nname: a\ndescription: d\ntools: Read, Bash, WebFetch, Task(Explore), TaskCreate, Read\nmodel: sonnet\n---\n\nBody\n";
        let (tools, unknown) = tools_of(authored);
        assert_eq!(tools, ["read", "bash", "task"]);
        assert_eq!(unknown, ["WebFetch", "TaskCreate"]);
        assert_eq!(
            with_tools(
                "---\nname: a\ndescription: \"d\"\n---\n\nBody\n---\n",
                &tools
            ),
            "---\nname: a\ndescription: \"d\"\ntools: read, bash, task\n---\n\nBody\n---\n"
        );
    }

    #[test]
    fn an_agent_with_no_tools_keeps_omps_defaults() {
        let (tools, unknown) = tools_of("---\nname: a\ndescription: d\n---\n\nBody\n");
        assert!(tools.is_empty() && unknown.is_empty());
        assert_eq!(
            with_tools("---\nname: a\n---\n\nB\n", &tools),
            "---\nname: a\n---\n\nB\n"
        );
    }
}
