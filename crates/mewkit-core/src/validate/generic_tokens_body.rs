//! Reading a skill BODY: the lines after the frontmatter, and the two brand
//! mentions that are not brand prose.
//!
//! A `mewkit` command and a `.meowkit/` path both name something a skill has to
//! name exactly to be followed; the rule is about vendor NAMES in prose.
use std::sync::LazyLock;

use regex::Regex;

static FENCE: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"^\s*```").expect("a static fence pattern"));

static TRAILING_WORD: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile(r"^\s+\S+").expect("a static trailing-word pattern"));

static NPX_PREFIX: LazyLock<Regex> =
    LazyLock::new(|| crate::js_regex::compile_ci(r"\bnpx\s+$").expect("a static npx pattern"));

static SHELL_COMMAND: LazyLock<Regex> = LazyLock::new(|| {
    crate::js_regex::compile(r"^\s*(?:[$>]\s*)?(?:npx\s+)?mewkit\b")
        .expect("a static shell-command pattern")
});

pub(super) struct BodyLine {
    pub(super) text: String,
    pub(super) line: usize,
    pub(super) code_fence: bool,
}

/// The lines after the frontmatter, each tagged with whether it sits inside a
/// fenced block — a `mewkit` command inside a fence is a command, not a brand.
pub(super) fn body_lines(content: &str) -> Vec<BodyLine> {
    // `split(/\r?\n/)`: a CRLF pair is ONE separator, so the `\r` is trimmed
    // rather than folded to a newline — folding would double every line.
    let lines: Vec<&str> = content
        .split('\n')
        .map(|line| line.trim_end_matches('\r'))
        .collect();
    let body_start = if lines.first() == Some(&"---") {
        lines
            .iter()
            .skip(1)
            .position(|line| *line == "---")
            .map(|index| index + 2)
            .unwrap_or(0)
    } else {
        0
    };
    let mut code_fence = false;
    lines
        .iter()
        .skip(body_start)
        .enumerate()
        .map(|(index, text)| {
            if FENCE.is_match(text) {
                code_fence = !code_fence;
            }
            BodyLine {
                text: (*text).to_string(),
                line: body_start + index + 1,
                code_fence,
            }
        })
        .collect()
}

/// A brand mention that is really the CLI being invoked.
pub(super) fn is_cli_brand_mention(
    line: &str,
    index: usize,
    token: &str,
    code_fence: bool,
) -> bool {
    let before = &line[..index];
    let after = &line[index + token.len()..];
    let lowercase_command = token == "mewkit" && TRAILING_WORD.is_match(after);
    (lowercase_command && NPX_PREFIX.is_match(before))
        || (lowercase_command && before.matches('`').count() % 2 == 1)
        || (code_fence && SHELL_COMMAND.is_match(line))
}

/// `.meowkit/…` is a filesystem path, not brand prose.
///
/// The rule exists to keep bodies free of product NAMES. The runtime-state tree
/// is a directory a skill has to name exactly to be followed, and the
/// dot-prefixed, slash-terminated form cannot be anything else.
pub(super) fn is_state_tree_path(line: &str, index: usize, token: &str) -> bool {
    line[..index].ends_with('.') && line[index + token.len()..].starts_with('/')
}
