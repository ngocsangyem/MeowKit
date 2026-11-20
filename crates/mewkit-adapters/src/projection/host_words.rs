//! Words that name the authoring host: environment variables, the context
//! file, the product name and model ids.
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

/// Whether the `needle` between `before` and `after` is part of a proper name.
fn in_proper_name(before: &str, needle: &str, after: &str) -> bool {
    PROPER_NAMES.iter().any(|name| {
        name.match_indices(needle).any(|(at, _)| {
            before.ends_with(&name[..at]) && after.starts_with(&name[at + needle.len()..])
        })
    })
}

/// `CLAUDE_PLUGIN_DATA` and `$CLAUDE_PROJECT_DIR` (braced or not).
pub fn environment(text: &str, target: &Target) -> String {
    let text = text.replace("CLAUDE_PLUGIN_DATA", target.plugin_data_var);
    replace_each(&text, "CLAUDE_PROJECT_DIR", |before, after| {
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
            "\"${PLUGIN_DATA:-x}\" cd \"$(git rev-parse --show-toplevel)\" && ls $(git rev-parse --show-toplevel)/a; ${X:-$(git rev-parse --show-toplevel)}; per-`CLAUDE_PROJECT_DIR`"
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
