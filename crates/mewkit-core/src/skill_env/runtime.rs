//! A skill's `requires_runtime` frontmatter key.
//!
//! A narrow line scan rather than a YAML parse: this runs where a skill script
//! is already failing, and the diagnostic should not depend on more than the
//! thing it diagnoses. Accepts the inline form (`[python>=3.9]`) and the block
//! form (`- python>=3.9`). The scan reproduces the npm CLI's, including that a
//! CRLF line ending stops a line matching (JavaScript's `.` excludes `\r`).
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

use super::{js_trim, skill_dir};
use crate::js_regex;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillRuntime {
    /// Raw entries, e.g. `["python>=3.9"]`.
    pub entries: Vec<String>,
    /// Interpreter family of the first entry, e.g. `python`.
    pub interpreter: String,
}

/// JavaScript's `.`: anything except a line terminator.
const ANY_BUT_EOL: &str = r"[^\n\r\x{2028}\x{2029}]";

static KEY_LINE: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(&format!(r"^requires_runtime:\s*({ANY_BUT_EOL}*)$")).expect("a valid pattern")
});
static ITEM_LINE: LazyLock<Regex> = LazyLock::new(|| {
    js_regex::compile(&format!(r"^\s*-\s*({ANY_BUT_EOL}+)$")).expect("a valid pattern")
});
static FAMILY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[a-zA-Z][a-zA-Z0-9_.-]*").expect("a valid pattern"));

/// `replace(/^["']|["']$/g, "")`: one leading and one trailing quote.
fn strip_quotes(text: &str) -> &str {
    let text = text.strip_prefix(['"', '\'']).unwrap_or(text);
    text.strip_suffix(['"', '\'']).unwrap_or(text)
}

pub fn read_skill_runtime(project: &Path, skill: &str) -> Option<SkillRuntime> {
    let text = std::fs::read_to_string(skill_dir(project, skill).join("SKILL.md")).ok()?;
    if !text.starts_with("---") {
        return None;
    }
    let frontmatter = match text[3..].find("\n---") {
        Some(at) => &text[..3 + at],
        None => &text,
    };
    let lines: Vec<&str> = frontmatter.split('\n').collect();
    let mut entries: Vec<String> = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        let Some(caps) = KEY_LINE.captures(line) else {
            continue;
        };
        let inline = js_trim(&caps[1]);
        if inline.starts_with('[') {
            let inner = inline.strip_prefix('[').unwrap_or(inline);
            let inner = inner.strip_suffix(']').unwrap_or(inner);
            for part in inner.split(',') {
                let value = strip_quotes(js_trim(part));
                if !value.is_empty() {
                    entries.push(value.to_string());
                }
            }
        } else if !inline.is_empty() {
            entries.push(strip_quotes(inline).to_string());
        }
        for next in &lines[i + 1..] {
            let Some(item) = ITEM_LINE.captures(next) else {
                break;
            };
            entries.push(strip_quotes(js_trim(&item[1])).to_string());
        }
        break;
    }
    if entries.is_empty() {
        return None;
    }
    let interpreter = FAMILY
        .find(&entries[0])
        .map_or("python", |m| m.as_str())
        .to_lowercase();
    Some(SkillRuntime {
        entries,
        interpreter,
    })
}
