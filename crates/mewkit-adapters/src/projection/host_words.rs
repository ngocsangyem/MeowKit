//! Words that name the authoring host: environment variables, the context
//! file, the product name, model ids and the tools only that host provides.
use super::Target;
use super::scan::{Hit, first, is_word, last, replace_each, run};

const MODEL_FAMILIES: &[&str] = &["opus", "sonnet", "haiku", "fable"];

/// Names that hold the authoring host's name without meaning the runtime the
/// text runs on: other products, URLs, source documents, a diagram style and
/// the files and ids named after it. They read the same on every target.
const PROPER_NAMES: &[&str] = &[
    "[Claude Code](https://claude.com/claude-code)",
    "claude.com",
    "claude.ai",
    "Claude Desktop",
    "Support/Claude",
    "Claude/GPT",
    "non-Claude",
    "Claude-XML",
    "Claude-specific",
    "claude-prompting-best-practices",
    "everything-claude-code",
    "claude-cowork",
    "claude-md",
    "Claude Official",
    "claude-official",
    "arrow-claude",
];

/// Variables only the authoring host sets, beyond the two `environment` gives
/// a target form, as what they stand for. Each is matched as a whole word, so
/// `CLAUDE_MODEL` does not match inside `CLAUDE_MODEL_ID`.
const HOST_VARS: &[(&str, &str)] = &[
    (
        "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS",
        "the host's agent-teams mode",
    ),
    ("CLAUDE_MODEL_ID", "the host's model variable"),
    ("CLAUDE_MODEL", "the host's model variable"),
    ("CLAUDE_PROJECT_DIR", "the project root"),
    ("CLAUDE_SKILL_DIR", "the skill's own directory"),
];

/// Tools only the authoring host provides, as the step they take. The
/// question wording matches what the shared hooks say on other runtimes.
const HOST_TOOLS: &[(&str, &str)] = &[
    ("AskUserQuestion", "a question to the user"),
    ("TodoWrite", "the to-do list"),
    ("TaskCreate", "a new task"),
    ("TaskUpdate", "a task update"),
    ("TaskGet", "a task read"),
    ("TaskList", "the shared task list"),
    ("TaskClaim", "a task claim"),
    ("SendMessage", "a message"),
];

/// Each whole-word `name` outside a shell expansion becomes `phrase`. A
/// `=value` after it goes with it (`X=1` is enabled), code quotes around it
/// are dropped as a pair, and a call's argument list is kept after a space.
/// Joined to a word by a hyphen (`per-X`), the phrase drops its article and
/// joins by hyphens too.
fn phrase_each(text: &str, name: &str, phrase: &str) -> String {
    replace_each(text, name, |before, after| {
        let joined = last(before).is_some_and(|c| is_word(c) || c == '$' || c == '{');
        if joined || first(after).is_some_and(is_word) {
            return None;
        }
        let value = after
            .strip_prefix('=')
            .map_or(0, |rest| 1 + run(rest, is_word).len());
        let rest = &after[value..];
        let quoted = before.ends_with('`') && rest.starts_with('`');
        let call = if rest.starts_with('(') { " " } else { "" };
        let hyphened = before[..before.len() - usize::from(quoted)].ends_with('-');
        let phrase = if hyphened {
            let bare = phrase.split_once(' ').map_or(phrase, |(_, rest)| rest);
            bare.replace(' ', "-")
        } else {
            phrase.to_owned()
        };
        Some(
            Hit::new(format!("{phrase}{call}"))
                .before(usize::from(quoted))
                .after(value + usize::from(quoted)),
        )
    })
}

/// The authoring host's own tools, named as the step they take.
pub fn host_tools(text: &str) -> String {
    HOST_TOOLS
        .iter()
        .fold(text.to_owned(), |text, (name, phrase)| {
            phrase_each(&text, name, phrase)
        })
}

/// Whether the `needle` between `before` and `after` is part of a proper name.
fn in_proper_name(before: &str, needle: &str, after: &str) -> bool {
    PROPER_NAMES.iter().any(|name| {
        name.match_indices(needle).any(|(at, _)| {
            before.ends_with(&name[..at]) && after.starts_with(&name[at + needle.len()..])
        })
    })
}

/// `CLAUDE_PLUGIN_DATA` and `$CLAUDE_PROJECT_DIR` (braced or not) take the
/// target's form; any other host variable named in prose, what it stands for.
pub fn environment(text: &str, target: &Target) -> String {
    let text = text.replace("CLAUDE_PLUGIN_DATA", target.plugin_data_var);
    let text = replace_each(&text, "CLAUDE_PROJECT_DIR", |before, after| {
        // A closing brace belongs to the variable only when it opened one:
        // in `${X:-$CLAUDE_PROJECT_DIR}` it closes the outer expansion.
        let (sigil, brace) = if before.ends_with("${") {
            (2, usize::from(after.starts_with('}')))
        } else if before.ends_with('$') {
            (1, 0)
        } else {
            return None;
        };
        Some(
            Hit::new(target.project_root_expr)
                .before(sigil)
                .after(brace),
        )
    });
    HOST_VARS.iter().fold(text, |text, (name, phrase)| {
        phrase_each(&text, name, phrase)
    })
}

/// The context file and product name, then a pinned model id, then the bare
/// host word in either case.
pub fn host_name(text: &str, target: &Target) -> String {
    let text = text.replace("CLAUDE.md", target.context_file);
    let text = replace_each(&text, "Claude Code", |before, after| {
        (!in_proper_name(before, "Claude Code", after)).then(|| Hit::new(target.host_name))
    });
    let text = replace_each(&text, "claude-", |_, after| {
        let family = MODEL_FAMILIES.iter().find(|f| after.starts_with(**f))?;
        let version = after[family.len()..].strip_prefix('-')?;
        let digits = run(version, |c| c.is_ascii_digit() || c == '-').trim_end_matches('-');
        first(digits)
            .is_some_and(|c| c.is_ascii_digit())
            .then(|| Hit::new("<model-id>").after(family.len() + 1 + digits.len()))
    });
    let text = replace_each(&text, "Claude", |before, after| {
        let inside_word = last(before).is_some_and(is_word) || first(after).is_some_and(is_word);
        (!inside_word && !in_proper_name(before, "Claude", after))
            .then(|| Hit::new(target.host_name))
    });
    let letter = |c: char| c.is_ascii_alphabetic() || c == '_';
    replace_each(&text, "claude", |before, after| {
        let inside_word = last(before).is_some_and(letter) || first(after).is_some_and(letter);
        (!inside_word && !in_proper_name(before, "claude", after))
            .then(|| Hit::new(target.host_word))
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::target::CODEX;

    #[test]
    fn environment_variables_take_the_target_form() {
        let src = "\"${CLAUDE_PLUGIN_DATA:-x}\" cd \"$CLAUDE_PROJECT_DIR\" && ls ${CLAUDE_PROJECT_DIR}/a; ${X:-$CLAUDE_PROJECT_DIR}; per-`CLAUDE_PROJECT_DIR`";
        assert_eq!(
            environment(src, &CODEX),
            "\"${PLUGIN_DATA:-x}\" cd \"$(git rev-parse --show-toplevel)\" && ls $(git rev-parse --show-toplevel)/a; ${X:-$(git rev-parse --show-toplevel)}; per-project-root"
        );
    }

    #[test]
    fn a_host_variable_in_prose_reads_as_what_it_stands_for() {
        let src = "**When:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is enabled. \
                   2. `CLAUDE_MODEL` (legacy); CLAUDE_MODEL_ID; `CLAUDE_SKILL_DIR` in `${…}` form; \
                   ${CLAUDE_MODEL:-x}; MY_CLAUDE_MODEL";
        assert_eq!(
            environment(src, &CODEX),
            "**When:** the host's agent-teams mode is enabled. \
             2. the host's model variable (legacy); the host's model variable; \
             the skill's own directory in `${…}` form; ${CLAUDE_MODEL:-x}; MY_CLAUDE_MODEL"
        );
    }

    #[test]
    fn a_host_tool_reads_as_the_step_it_takes() {
        let src = "Check `TaskList`, claim via `TaskUpdate`; \
                   TaskUpdate(taskId, status=\"completed\") then SendMessage to lead; \
                   use AskUserQuestion; TodoWrite; MyTaskList";
        assert_eq!(
            host_tools(src),
            "Check the shared task list, claim via a task update; \
             a task update (taskId, status=\"completed\") then a message to lead; \
             use a question to the user; the to-do list; MyTaskList"
        );
    }

    #[test]
    fn the_host_is_renamed_and_a_model_id_is_not_carried_over() {
        let src = "Claude Code reads CLAUDE.md. Claude reviews; run `claude -p`; \
                   \"model\": \"claude-opus-5-5\"; claude-sonnet-5-latest; claude_code; Claudette";
        assert_eq!(
            host_name(src, &CODEX),
            "Codex reads AGENTS.md. Codex reviews; run `codex -p`; \
             \"model\": \"<model-id>\"; <model-id>-latest; claude_code; Claudette"
        );
    }

    #[test]
    fn a_proper_name_that_holds_the_host_name_is_kept() {
        let src = "Generated with [Claude Code](https://claude.com/claude-code); Claude Desktop \
                   reads ~/Library/Application Support/Claude/claude_desktop_config.json; \
                   see claude-prompting-best-practices and [Style 6](style-6-claude-official.md): \
                   Claude Official Warm. On non-Claude providers Claude differs; open claude.ai.";
        assert_eq!(
            host_name(src, &CODEX),
            "Generated with [Claude Code](https://claude.com/claude-code); Claude Desktop \
             reads ~/Library/Application Support/Claude/claude_desktop_config.json; \
             see claude-prompting-best-practices and [Style 6](style-6-claude-official.md): \
             Claude Official Warm. On non-Claude providers Codex differs; open claude.ai."
        );
    }
}
