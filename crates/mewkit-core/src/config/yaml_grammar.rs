//! The deliberately small YAML dialect the project config is written in, parsed
//! by hand.
//!
//! A full YAML parser speaks all of YAML: anchors, block scalars, sequences,
//! flow collections, document markers. The config does not, and the reason is
//! the other reader — a hook has no dependencies at all and parses this file by
//! hand, so anything a library would accept and the hand reader would not is a
//! divergence waiting to be discovered in the one session where it matters: a
//! fresh clone with a gate about to fire.
//!
//! So this layer is the subset, enforced line by line with the same error
//! identifiers `.claude/hooks/lib/yaml-subset.cjs` uses, and it yields the
//! values itself rather than handing the text to a YAML library afterwards. One
//! parser cannot disagree with itself about a spelling, and the fixture corpus
//! under `tests/config/fixtures/` holds it to the hook reader's verdicts.
//!
//! Output is FLAT (`budget.cap`), the shape both readers compare in. Nothing is
//! partial: a file outside the subset yields an error carrying the line number,
//! never the keys that happened to come before the bad one.
use super::config_scalar::scalar;
use super::config_values::ConfigValues;
use super::scalar_spelling::is_key_shaped;

/// The one key allowed to start with `$`. It is a pointer to the published JSON
/// Schema rather than a setting, and it is what makes an editor validate the
/// file as it is typed — so it has to be a live line, not a comment.
pub const SCHEMA_KEY: &str = "$schema";

/// A line the grammar refuses, with the identifier both readers report.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GrammarError {
    pub code: &'static str,
    pub line: usize,
    pub message: String,
}

pub(super) fn fail<T>(code: &'static str, line: usize, message: String) -> Result<T, GrammarError> {
    Err(GrammarError {
        code,
        line,
        message,
    })
}

/// Normalise a BOM and CRLF away, so line numbers and keys match either source.
pub fn normalize(source: &str) -> String {
    let body = source.strip_prefix('\u{feff}').unwrap_or(source);
    body.replace("\r\n", "\n").replace('\r', "\n")
}

/// Strip a trailing `#` comment that is not inside a quoted scalar.
pub fn strip_comment(text: &str) -> &str {
    let mut quote: Option<char> = None;
    let mut previous: Option<char> = None;
    for (index, ch) in text.char_indices() {
        match quote {
            Some(open) => {
                if ch == open {
                    quote = None;
                }
            }
            None => {
                if ch == '"' || ch == '\'' {
                    quote = Some(ch);
                } else if ch == '#' && previous.is_none_or(char::is_whitespace) {
                    return &text[..index];
                }
            }
        }
        previous = Some(ch);
    }
    text
}

/// The flat values of a config file, or the first line outside the subset.
pub fn parse_config_subset(source: &str) -> Result<ConfigValues, GrammarError> {
    let text = normalize(source);
    let mut values = ConfigValues::new();
    let mut seen: Vec<String> = Vec::new();
    let mut parent = String::new();

    for (index, line) in text.split('\n').enumerate() {
        let line_no = index + 1;
        if line.contains('\t') {
            return fail(
                "tab-indentation",
                line_no,
                "tabs are not allowed; indent with two spaces".to_string(),
            );
        }
        let body = strip_comment(line);
        if body.trim().is_empty() {
            continue;
        }

        let indent = body.chars().count() - body.trim_start().chars().count();
        if !indent.is_multiple_of(2) {
            return fail(
                "odd-indentation",
                line_no,
                format!("indentation must be a multiple of two spaces, found {indent}"),
            );
        }
        let depth = indent / 2;
        if depth > 1 {
            return fail(
                "nesting-too-deep",
                line_no,
                "the config grammar allows two levels; this line is a third".to_string(),
            );
        }

        let trimmed = body.trim();
        if trimmed.starts_with("- ") || trimmed == "-" {
            return fail(
                "sequence-not-supported",
                line_no,
                "lists are not part of the config grammar".to_string(),
            );
        }
        if trimmed.starts_with("---") {
            return fail(
                "document-marker-not-supported",
                line_no,
                "document markers are not part of the config grammar".to_string(),
            );
        }

        let Some(split) = trimmed.find(':').filter(|at| *at >= 1) else {
            return fail(
                "not-a-key",
                line_no,
                format!(
                    "expected \"key: value\", found {}",
                    serde_json::to_string(trimmed).unwrap_or_else(|_| format!("\"{trimmed}\""))
                ),
            );
        };
        let key = trimmed[..split].trim();
        // A dot in a key is how a dotted PATH is spelled, not part of a key's
        // name. Written flat, `budget.cap: 5` is one key to the hand reader and
        // a nested pair to a full parser, so the flat spelling is refused on
        // both sides instead.
        if key != SCHEMA_KEY && key.contains('.') {
            let (head, tail) = key.split_once('.').unwrap_or((key, ""));
            return fail(
                "dotted-key",
                line_no,
                format!(
                    "{key} is a path, not a key; write it nested — \"{head}:\" on its own line, then \"  {tail}: …\" indented under it"
                ),
            );
        }
        if key != SCHEMA_KEY && !is_key_shaped(key) {
            return fail(
                "bad-key",
                line_no,
                format!(
                    "{} is not a valid config key",
                    serde_json::to_string(key).unwrap_or_else(|_| format!("\"{key}\""))
                ),
            );
        }

        if depth == 0 {
            parent.clear();
        } else if parent.is_empty() {
            return fail(
                "orphan-nesting",
                line_no,
                format!("{key} is indented but no parent key opened a map"),
            );
        }

        let path = if depth == 0 {
            key.to_string()
        } else {
            format!("{parent}.{key}")
        };
        if seen.iter().any(|been| been == &path) {
            return fail(
                "duplicate-key",
                line_no,
                format!("{path} is set more than once"),
            );
        }

        let rest = trimmed[split + 1..].trim();
        if rest.is_empty() {
            if depth == 1 {
                return fail(
                    "nesting-too-deep",
                    line_no,
                    format!("{path} opens a third level; the grammar allows two"),
                );
            }
            parent = key.to_string();
            seen.push(path);
            continue;
        }

        let value = scalar(rest, line_no, &path)?;
        seen.push(path.clone());
        values.insert(path, value);
    }

    Ok(values)
}

/// The first grammar violation, or `None` when the text is inside the subset.
pub fn check_grammar(source: &str) -> Option<GrammarError> {
    parse_config_subset(source).err()
}

#[cfg(test)]
#[path = "yaml_grammar_tests.rs"]
mod yaml_grammar_tests;
