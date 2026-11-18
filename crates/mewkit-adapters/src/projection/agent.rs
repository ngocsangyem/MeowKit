//! An authored agent (`.claude/agents/<name>.md`: YAML frontmatter and a
//! Markdown system prompt) in the form a target runtime loads.
use std::collections::BTreeSet;

use super::frontmatter::{is_block_scalar, quoted};
use super::scan::{Hit, first, is_word, last, replace_each};
use super::{Target, project_text};
use crate::contract::EmitError;
use crate::cursor::frontmatter::fields;

/// What every target takes from an authored agent file.
struct Authored {
    name: String,
    description: String,
    /// The id the target pins for the authored model tier.
    model: &'static str,
    prompt: String,
}

fn authored(
    file: &str,
    source: &str,
    skills: &BTreeSet<String>,
    target: &Target,
) -> Result<Authored, EmitError> {
    let bad = |why: String| EmitError::Kit(format!("agent {file}: {why}"));
    let (pairs, body) = fields(source).ok_or_else(|| bad("no frontmatter".into()))?;
    let get = |key: &str| {
        pairs
            .iter()
            .find(|(k, v)| k == key && !v.is_empty())
            .map(|(_, v)| v.as_str())
            .ok_or_else(|| bad(format!("no `{key}`")))
    };
    let tier = get("model")?;
    let model = target
        .model_pins
        .iter()
        .find(|(t, _)| *t == tier)
        .map(|(_, id)| *id)
        .ok_or_else(|| bad(format!("model `{tier}` has no pin for this runtime")))?;
    let name = get("name")?;
    // The name is the file name and is written unquoted.
    if file.strip_suffix(".md") != Some(name) {
        return Err(bad(format!("`name` is `{name}`, not the file's name")));
    }
    let description = get("description")?;
    if is_block_scalar(description) {
        return Err(bad("block-scalar description; write it on one line".into()));
    }
    let text = |authored: &str| routed(&project_text(authored, skills, target), target);
    Ok(Authored {
        name: name.to_owned(),
        description: text(description),
        model,
        prompt: text(body.trim_start_matches('\n')),
    })
}

/// The word `orchestrator` names an agent; a runtime that loads none has its
/// main session do that work, and the text says so.
fn routed(text: &str, target: &Target) -> String {
    let Some(router) = target.router else {
        return text.to_owned();
    };
    replace_each(text, "orchestrator", |before, after| {
        let inside = |c: Option<char>| c.is_some_and(|c| is_word(c) || c == '-');
        // A file name (`agents/orchestrator.md`) still names the file.
        let file_name = before.ends_with('/')
            || after
                .strip_prefix('.')
                .is_some_and(|rest| rest.starts_with(|c: char| c.is_ascii_alphanumeric()));
        (!inside(last(before)) && !inside(first(after)) && !file_name).then(|| Hit::new(router))
    })
}

/// A Codex agent file: `name`, `description`, the model pinned for the
/// authored tier, the overlay's keys, and the system prompt as
/// `developer_instructions`. `extra` values are already rendered as TOML.
///
/// The authored `tools` list is not carried over: a Codex agent file has no
/// tool list, so an agent that must not write gets `sandbox_mode` from the
/// overlay instead.
pub fn codex_agent(
    file: &str,
    source: &str,
    skills: &BTreeSet<String>,
    target: &Target,
    extra: &[(String, String)],
    amend: impl FnOnce(String) -> Result<String, EmitError>,
) -> Result<String, EmitError> {
    let agent = authored(file, source, skills, target)?;
    let mut out = format!("name = {}\n", quoted(&agent.name));
    out.push_str(&format!("description = {}\n", quoted(&agent.description)));
    out.push_str(&format!("model = {}\n", quoted(agent.model)));
    for (key, value) in extra {
        out.push_str(&format!("{key} = {value}\n"));
    }
    // A TOML basic multi-line string: backslashes escape, three quotes close
    // it, and no control character but tab and newline may appear raw.
    let mut prompt = String::new();
    for c in amend(agent.prompt)?.replace("\"\"\"", "\"\"\u{0}").chars() {
        match c {
            '\\' => prompt.push_str("\\\\"),
            '\u{0}' => prompt.push_str("\\\""),
            '\n' | '\t' => prompt.push(c),
            c if c.is_control() => prompt.push_str(&format!("\\u{:04X}", c as u32)),
            c => prompt.push(c),
        }
    }
    out.push_str("developer_instructions = \"\"\"\n");
    out.push_str(&prompt);
    if !prompt.ends_with('\n') {
        out.push('\n');
    }
    out.push_str("\"\"\"\n");
    Ok(out)
}

/// A Markdown agent file (Cursor): frontmatter with `name`, `description`,
/// the pinned model and the overlay's keys, then the system prompt. Authored
/// keys the runtime does not document (`tools`, `memory`, `color`) are left
/// behind.
pub fn markdown_agent(
    file: &str,
    source: &str,
    skills: &BTreeSet<String>,
    target: &Target,
    extra: &[(String, String)],
    amend: impl FnOnce(String) -> Result<String, EmitError>,
) -> Result<String, EmitError> {
    let agent = authored(file, source, skills, target)?;
    let mut out = format!("---\nname: {}\n", agent.name);
    out.push_str(&format!("description: {}\n", quoted(&agent.description)));
    out.push_str(&format!("model: {}\n", agent.model));
    for (key, value) in extra {
        out.push_str(&format!("{key}: {value}\n"));
    }
    out.push_str("---\n\n");
    out.push_str(&amend(agent.prompt)?);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::target::{CODEX, CURSOR};

    const TESTER: &str = "---\nname: tester\ndescription: Writes tests. Use after mk:cook.\n\
                          tools: Read, Bash\nmodel: sonnet\nmemory: project\n---\n\n\
                          You are the Tester. Read `CLAUDE.md`; run `a\\b` and \"\"\"x\"\"\".\n";

    #[test]
    fn a_codex_agent_is_toml_with_the_pinned_model_and_overlay_keys() {
        let extra = [("model_reasoning_effort".to_owned(), "\"medium\"".to_owned())];
        let toml = codex_agent("tester.md", TESTER, &BTreeSet::new(), &CODEX, &extra, Ok).unwrap();
        assert_eq!(
            toml,
            "name = \"tester\"\ndescription = \"Writes tests. Use after mk-cook.\"\n\
             model = \"gpt-6.1-sol\"\nmodel_reasoning_effort = \"medium\"\n\
             developer_instructions = \"\"\"\n\
             You are the Tester. Read `AGENTS.md`; run `a\\\\b` and \"\"\\\"x\"\"\\\".\n\"\"\"\n"
        );
        let doc: toml_edit::DocumentMut = toml.parse().unwrap();
        assert_eq!(
            doc["developer_instructions"].as_str().unwrap(),
            "You are the Tester. Read `AGENTS.md`; run `a\\b` and \"\"\"x\"\"\".\n"
        );
    }

    #[test]
    fn a_markdown_agent_keeps_the_documented_keys_only() {
        let extra = [("readonly".to_owned(), "true".to_owned())];
        let md =
            markdown_agent("tester.md", TESTER, &BTreeSet::new(), &CURSOR, &extra, Ok).unwrap();
        assert!(md.starts_with(
            "---\nname: tester\ndescription: \"Writes tests. Use after mk-cook.\"\n\
             model: composer-2.5[fast=true]\nreadonly: true\n---\n\nYou are the Tester."
        ));
    }

    #[test]
    fn the_router_agent_is_named_as_the_main_session_where_none_is_loaded() {
        let text = "escalate to orchestrator; the orchestrator's job; mk:workflow-orchestrator; \
                    agents/orchestrator.md; ask the orchestrator.";
        assert_eq!(
            routed(text, &CODEX),
            "escalate to main session; the main session's job; mk:workflow-orchestrator; \
             agents/orchestrator.md; ask the main session."
        );
    }

    #[test]
    fn an_unpinned_tier_or_a_missing_key_is_refused() {
        let project =
            |file: &str, src: &str| codex_agent(file, src, &BTreeSet::new(), &CODEX, &[], Ok);
        let unpinned = TESTER.replace("model: sonnet", "model: inherit");
        let err = project("tester.md", &unpinned).unwrap_err();
        assert!(err.to_string().contains("`inherit` has no pin"));
        let nameless = TESTER.replace("name: tester\n", "");
        let err = project("tester.md", &nameless).unwrap_err();
        assert!(err.to_string().contains("no `name`"));
        let err = project("other.md", TESTER).unwrap_err();
        assert!(err.to_string().contains("not the file's name"));
    }

    #[test]
    fn a_control_character_or_an_amended_passage_cannot_break_the_toml() {
        let source = TESTER.replace("You are the Tester.", "You are\u{1b} the Tester.");
        let amend = |text: String| Ok(text.replace("run `a\\b`", "open \"C:\\dir\" \"\"\""));
        let toml = codex_agent("tester.md", &source, &BTreeSet::new(), &CODEX, &[], amend).unwrap();
        let doc: toml_edit::DocumentMut = toml.parse().unwrap();
        let prompt = doc["developer_instructions"].as_str().unwrap();
        assert!(prompt.starts_with("You are\u{1b} the Tester."));
        assert!(prompt.contains("open \"C:\\dir\" \"\"\" and"));
    }
}
