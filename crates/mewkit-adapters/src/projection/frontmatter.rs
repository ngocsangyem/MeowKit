//! A skill's `SKILL.md` with the frontmatter a target runtime reads. The
//! authored frontmatter carries kit bookkeeping (owner, phase, keywords);
//! a projected skill keeps the name, the description and what the skill
//! needs installed, plus any key the runtime's overlay adds.
use std::collections::BTreeSet;

use super::{Skill, Target, project_skill_body, project_text};
use crate::contract::EmitError;
use crate::cursor::frontmatter::fields;

/// Authored list-valued keys every target keeps.
const KEPT_LISTS: &[&str] = &["requires_runtime"];

/// `text` as a double-quoted scalar, valid as YAML and as a TOML basic string.
pub fn quoted(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\t' => out.push_str("\\t"),
            // Neither format allows a raw control character in a quoted scalar.
            c if c.is_control() => out.push_str(&format!("\\u{:04X}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// A value the line-based frontmatter reader cannot hand over whole: a block
/// scalar (`>`, `|`), whose text sits on the lines below.
pub(super) fn is_block_scalar(value: &str) -> bool {
    matches!(value, ">" | "|" | ">-" | "|-" | ">+" | "|+")
}

/// A flow list of plain items, `[a, b]`, as `["a", "b"]`. `None` for any
/// other shape (a block list, an item that needs quoting), which this reader
/// cannot split reliably.
fn quoted_list(value: &str) -> Option<String> {
    let inner = value.strip_prefix('[')?.strip_suffix(']')?;
    if inner.contains(['"', '\'', '[', '{']) {
        return None;
    }
    let items: Vec<String> = inner
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(quoted)
        .collect();
    Some(format!("[{}]", items.join(", ")))
}

/// Project `SKILL.md`. `extra` holds the overlay's `key: value` lines for
/// this skill, values already rendered; `amend` is applied to the projected
/// body, never to the frontmatter.
pub fn skill_file(
    source: &str,
    skill: &Skill,
    skills: &BTreeSet<String>,
    target: &Target,
    extra: &[(String, String)],
    amend: impl FnOnce(String) -> Result<String, EmitError>,
) -> Result<String, EmitError> {
    let bad = |why: &str| EmitError::Kit(format!("skill {}: SKILL.md {why}", skill.name));
    let (pairs, body) = fields(source).ok_or_else(|| bad("has no frontmatter"))?;
    let get = |key: &str| {
        pairs
            .iter()
            .find(|(k, v)| k == key && !v.is_empty())
            .map(|(_, v)| v.as_str())
    };
    let description = get("description").ok_or_else(|| bad("has no description"))?;
    if is_block_scalar(description) {
        return Err(bad("has a block-scalar description; write it on one line"));
    }

    let mut out = String::from("---\n");
    let name = format!("{}{}", target.skill_prefix, skill.name);
    out.push_str(&format!("name: {}\n", quoted(&name)));
    let description = project_text(description, skills, target);
    out.push_str(&format!("description: {}\n", quoted(&description)));
    for key in KEPT_LISTS {
        if let Some(value) = get(key) {
            let list = quoted_list(value)
                .ok_or_else(|| bad(&format!("`{key}` is not a flow list of plain items")))?;
            out.push_str(&format!("{key}: {list}\n"));
        }
    }
    for (key, value) in extra {
        out.push_str(&format!("{key}: {value}\n"));
    }
    out.push_str("---\n");
    out.push_str(&amend(project_skill_body(&body, skill, skills, target))?);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::projection::target::CODEX;

    fn cook() -> Skill {
        Skill {
            name: "cook".into(),
            files: ["SKILL.md".to_owned()].into(),
        }
    }

    #[test]
    fn keeps_name_description_and_requirements_and_adds_overlay_keys() {
        let src = "---\nname: mk:cook\ndescription: \"Builds one feature. NOT for mk:autobuild.\"\n\
                   owner: core\nkeywords:\n  - build\nrequires_runtime: [python>=3.9]\n---\n\n# mk:cook\n";
        let extra = [("disable-model-invocation".to_owned(), "true".to_owned())];
        assert_eq!(
            skill_file(src, &cook(), &BTreeSet::new(), &CODEX, &extra, Ok).unwrap(),
            "---\nname: \"mk-cook\"\ndescription: \"Builds one feature. NOT for mk-autobuild.\"\n\
             requires_runtime: [\"python>=3.9\"]\ndisable-model-invocation: true\n---\n\n# mk-cook\n"
        );
    }

    #[test]
    fn a_skill_this_reader_cannot_project_is_refused() {
        let project = |src: &str| skill_file(src, &cook(), &BTreeSet::new(), &CODEX, &[], Ok);
        let err = project("---\nname: mk:cook\n---\n").unwrap_err();
        assert!(err.to_string().contains("no description"));
        let err = project("# cook\n").unwrap_err();
        assert!(err.to_string().contains("no frontmatter"));
        let err = project("---\ndescription: >\n  Builds.\n---\n").unwrap_err();
        assert!(err.to_string().contains("block-scalar"));
        let block = "---\ndescription: x\nrequires_runtime:\n  - a\n  - b\n---\n";
        assert!(
            project(block)
                .unwrap_err()
                .to_string()
                .contains("not a flow list")
        );
    }

    #[test]
    fn quoting_escapes_what_a_double_quoted_scalar_cannot_hold() {
        assert_eq!(quoted("a \"b\" c\\d"), "\"a \\\"b\\\" c\\\\d\"");
        assert_eq!(quoted("a\u{1b}b\rc"), "\"a\\u001Bb\\u000Dc\"");
    }
}
