//! The YAML frontmatter of Cursor rules and agents, read line by line: the
//! bundle writes flat `key: value` pairs, and only their keys and scalar
//! values matter here.
use crate::contract::EmitError;

/// `text` with a leading BOM dropped and CRLF line ends made LF, so a kit
/// checked out on Windows parses like any other.
fn normalize(text: &str) -> std::borrow::Cow<'_, str> {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    if text.contains('\r') {
        text.replace("\r\n", "\n").into()
    } else {
        text.into()
    }
}

/// `(frontmatter, body)` when `text` opens with a `---` fenced block; the
/// closing fence may end the file.
fn split(text: &str) -> Option<(&str, &str)> {
    let rest = text.strip_prefix("---\n")?;
    if let Some(body) = rest.strip_prefix("---\n") {
        return Some(("", body));
    }
    if rest == "---" {
        return Some(("", ""));
    }
    match rest.find("\n---\n") {
        Some(end) => Some((&rest[..=end], &rest[end + 5..])),
        None => rest.strip_suffix("\n---").map(|front| (front, "")),
    }
}

fn is_top(line: &str) -> bool {
    !line.is_empty() && !line.starts_with([' ', '\t', '-', '#'])
}

/// Top-level `key: value` pairs. A key with nothing after the colon takes
/// its value from the indented or `- ` lines under it (block style).
fn pairs(front: &str) -> Vec<(&str, String)> {
    let lines: Vec<&str> = front.lines().collect();
    let mut out = Vec::new();
    for (i, line) in lines.iter().enumerate() {
        let Some((key, value)) = line.split_once(':').filter(|_| is_top(line)) else {
            continue;
        };
        let mut value = scalar(value);
        if value.is_empty() {
            value = lines[i + 1..]
                .iter()
                .take_while(|l| !is_top(l))
                .map(|l| scalar(l.trim_start_matches([' ', '\t', '-'])))
                .collect::<Vec<_>>()
                .join(" ");
        }
        out.push((key.trim(), value));
    }
    out
}

/// A YAML scalar as plain text: trailing ` #` comment and one level of
/// quotes removed; `''`, `""` and `[]` read as empty.
fn scalar(raw: &str) -> String {
    let v = raw.trim();
    let v = match v.chars().next() {
        // A quoted value ends at its closing quote; anything after is a comment.
        Some(q @ ('"' | '\'')) => v[1..].split(q).next().unwrap_or(""),
        _ => v.split(" #").next().unwrap_or(v).trim_end(),
    };
    if v == "[]" {
        String::new()
    } else {
        v.to_owned()
    }
}

/// How Cursor applies a rule, decided by its frontmatter.
#[derive(Debug, PartialEq, Eq)]
pub enum RuleType {
    Always,
    SpecificFiles,
    Intelligently,
    Manually,
}

/// The one rule type an `.mdc` file's frontmatter yields. Frontmatter that
/// mixes two (globs with `alwaysApply: true`, or globs with a description)
/// is refused: Cursor would silently ignore part of it.
pub fn rule_type(path: &str, text: &str) -> Result<RuleType, EmitError> {
    let bad = |why: &str| EmitError::Kit(format!("Cursor rule {path}: {why}"));
    let text = normalize(text);
    let (front, _) = split(&text).ok_or_else(|| bad("no frontmatter"))?;
    let mut always = false;
    let (mut globs, mut description) = (false, false);
    for (key, value) in pairs(front) {
        match key {
            "alwaysApply" => {
                always = match value.as_str() {
                    "true" => true,
                    "false" => false,
                    _ => return Err(bad("`alwaysApply` is not true or false")),
                }
            }
            "globs" => globs = !value.is_empty(),
            "description" => description = !value.is_empty(),
            _ => {}
        }
    }
    match (always, globs, description) {
        (true, true, _) => Err(bad("`globs` is ignored under `alwaysApply: true`")),
        (true, false, _) => Ok(RuleType::Always),
        (false, true, true) => Err(bad("both `globs` and `description`: two rule types")),
        (false, true, false) => Ok(RuleType::SpecificFiles),
        (false, false, true) => Ok(RuleType::Intelligently),
        (false, false, false) => Ok(RuleType::Manually),
    }
}

/// `text` with every frontmatter key outside `keep` removed, plus the names
/// removed. Text without frontmatter is returned as is.
pub fn keep_keys(text: &str, keep: &[&str]) -> (String, Vec<String>) {
    let normal = normalize(text);
    let Some((front, body)) = split(&normal) else {
        return (text.to_owned(), Vec::new());
    };
    let mut out = String::from("---\n");
    let mut dropped = Vec::new();
    let mut keeping = true;
    for line in front.lines() {
        if is_top(line)
            && let Some((key, _)) = line.split_once(':')
        {
            keeping = keep.contains(&key.trim());
            if !keeping {
                dropped.push(key.trim().to_owned());
            }
        }
        if keeping {
            out.push_str(line);
            out.push('\n');
        }
    }
    if dropped.is_empty() {
        return (text.to_owned(), dropped);
    }
    out.push_str("---\n");
    out.push_str(body);
    (out, dropped)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kind(front: &str) -> Result<RuleType, EmitError> {
        rule_type("r.mdc", &format!("---\n{front}---\n\nbody\n"))
    }

    #[test]
    fn each_frontmatter_yields_one_rule_type() {
        assert_eq!(kind("alwaysApply: true\n").unwrap(), RuleType::Always);
        assert_eq!(
            kind("globs: [\"**/*.ts\"]\nalwaysApply: false\n").unwrap(),
            RuleType::SpecificFiles
        );
        assert_eq!(
            kind("description: read when planning\nalwaysApply: false\n").unwrap(),
            RuleType::Intelligently
        );
        assert_eq!(kind("alwaysApply: false\n").unwrap(), RuleType::Manually);
        assert!(kind("alwaysApply: true\nglobs: a/**\n").is_err());
        assert!(kind("globs: a/**\ndescription: x\n").is_err());
        assert!(kind("alwaysApply: yes\n").is_err());
        assert!(rule_type("r.mdc", "no frontmatter\n").is_err());
    }

    #[test]
    fn crlf_bom_eof_fence_quotes_comments_and_block_values_parse() {
        let crlf = "\u{feff}---\r\nalwaysApply: true\r\n---\r\nbody\r\n";
        assert_eq!(rule_type("r.mdc", crlf).unwrap(), RuleType::Always);
        assert_eq!(
            rule_type("r.mdc", "---\nalwaysApply: true\n---").unwrap(),
            RuleType::Always
        );
        assert_eq!(
            kind("alwaysApply: \"true\" # always\n").unwrap(),
            RuleType::Always
        );
        assert_eq!(
            kind("globs:\n  - \"**/*.ts\"\nalwaysApply: false\n").unwrap(),
            RuleType::SpecificFiles
        );
        assert!(kind("globs:\n  - a/**\ndescription: x\n").is_err());
        assert!(kind("alwaysApply: true\nglobs:\n  - a/**\n").is_err());
        assert_eq!(
            kind("description: >\n  read when planning\n").unwrap(),
            RuleType::Intelligently
        );
        assert_eq!(
            kind("globs: ''\ndescription: ''\n").unwrap(),
            RuleType::Manually
        );
    }

    #[test]
    fn keep_keys_drops_unknown_keys_and_their_continuation_lines() {
        let text = "---\nname: a\ntools:\n  - Read\n  - Bash\nmodel: inherit\n---\nbody\n";
        let (out, dropped) = keep_keys(text, &["name", "model"]);
        assert_eq!(out, "---\nname: a\nmodel: inherit\n---\nbody\n");
        assert_eq!(dropped, ["tools"]);
        let clean = "---\nname: a\n---\nbody\n";
        assert_eq!(keep_keys(clean, &["name"]), (clean.to_owned(), vec![]));
        let crlf = "---\r\nname: a\r\n# note: kept\r\ntools: x\r\n---\r\nbody\r\n";
        let (out, dropped) = keep_keys(crlf, &["name"]);
        assert_eq!(out, "---\nname: a\n# note: kept\n---\nbody\n");
        assert_eq!(dropped, ["tools"]);
    }
}
