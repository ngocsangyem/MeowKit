//! The rule files the kit writes into `.agents/rules/`, and the form
//! Antigravity requires of them (https://antigravity.google/docs/rules, read
//! 2026-11-22):
//! - only the `.md` files directly in the folder are scanned;
//! - every file starts with frontmatter whose `trigger` is `always_on`,
//!   `model_decision`, `glob` or `manual`, and a file without one is silently
//!   discarded;
//! - `description` is required for `model_decision`, `globs` for `glob`;
//! - a file is cut at 24,000 bytes.
//!
//! A rule file that breaks one of these would install and then never load, so
//! the emitter refuses it before anything is written. The 20,000-token budget
//! for the always-on rules together is not checked: the kit's rule files are
//! on demand, and its always-on text is the `AGENTS.md` block, whose own cap
//! is in [`crate::agents_block`].
use crate::contract::{EmitError, Op, Plan};
use crate::cursor::frontmatter::fields;

/// The folder Antigravity scans for rule files.
pub const DIR: &str = ".agents/rules";
/// A rule file past this size is truncated by Antigravity.
pub const MAX_BYTES: usize = 24_000;
/// The values of `trigger` Antigravity accepts.
pub const TRIGGERS: [&str; 4] = ["always_on", "model_decision", "glob", "manual"];

/// Why `text`, to be installed at `path`, is not a rule file Antigravity
/// would load; `Ok` when it is one.
pub fn check(path: &str, text: &str) -> Result<(), String> {
    let name = path
        .strip_prefix(DIR)
        .and_then(|rest| rest.strip_prefix('/'))
        .ok_or_else(|| format!("{path} is not in {DIR}"))?;
    if name.contains('/') || !name.ends_with(".md") {
        return Err(format!("{path}: only a .md file directly in {DIR} is read"));
    }
    if text.len() > MAX_BYTES {
        return Err(format!(
            "{path}: {} bytes, over the {MAX_BYTES}-byte cut",
            text.len()
        ));
    }
    let (pairs, _) = fields(text)
        .ok_or_else(|| format!("{path}: no frontmatter, so Antigravity discards the rule"))?;
    let value = |key: &str| {
        pairs
            .iter()
            .find(|(k, v)| k == key && !v.is_empty())
            .map(|(_, v)| v.as_str())
    };
    let trigger = value("trigger")
        .ok_or_else(|| format!("{path}: no `trigger`, so Antigravity discards the rule"))?;
    if !TRIGGERS.contains(&trigger) {
        return Err(format!(
            "{path}: `trigger: {trigger}` is not one of {}, so Antigravity discards the rule",
            TRIGGERS.join(", ")
        ));
    }
    if trigger == "model_decision" && value("description").is_none() {
        return Err(format!(
            "{path}: a model_decision rule needs a `description`"
        ));
    }
    if trigger == "glob" && value("globs").or_else(|| value("glob")).is_none() {
        return Err(format!("{path}: a glob rule needs `globs`"));
    }
    Ok(())
}

/// Refuse a plan that writes a rule file Antigravity would not load.
pub fn check_plan(plan: &Plan) -> Result<(), EmitError> {
    for op in &plan.ops {
        let Op::WriteFile { path, bytes, .. } = op else {
            continue;
        };
        if !path.as_str().starts_with(&format!("{DIR}/")) {
            continue;
        }
        let text = std::str::from_utf8(bytes)
            .map_err(|_| EmitError::Kit(format!("{path} is not UTF-8")))?;
        check(path.as_str(), text).map_err(EmitError::Kit)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const GOOD: &str = "---\ntrigger: model_decision\ndescription: When shipping.\n---\n\nBody\n";

    #[test]
    fn a_rule_with_a_valid_trigger_and_its_field_is_accepted() {
        assert!(check(".agents/rules/a.md", GOOD).is_ok());
        let glob = "---\ntrigger: glob\nglobs: src/**\n---\nBody\n";
        assert!(check(".agents/rules/a.md", glob).is_ok());
        assert!(check(".agents/rules/a.md", "---\ntrigger: always_on\n---\nB\n").is_ok());
    }

    #[test]
    fn a_rule_without_a_trigger_or_frontmatter_is_refused() {
        let err = check(".agents/rules/a.md", "---\ndescription: d\n---\nBody\n").unwrap_err();
        assert!(err.contains("no `trigger`"), "{err}");
        let err = check(".agents/rules/a.md", "Body only\n").unwrap_err();
        assert!(err.contains("no frontmatter"), "{err}");
    }

    #[test]
    fn an_unknown_trigger_and_a_missing_companion_field_are_refused() {
        let err = check(".agents/rules/a.md", "---\ntrigger: always\n---\nB\n").unwrap_err();
        assert!(err.contains("is not one of"), "{err}");
        let err = check(
            ".agents/rules/a.md",
            "---\ntrigger: model_decision\n---\nB\n",
        )
        .unwrap_err();
        assert!(err.contains("needs a `description`"), "{err}");
        let err = check(".agents/rules/a.md", "---\ntrigger: glob\n---\nB\n").unwrap_err();
        assert!(err.contains("needs `globs`"), "{err}");
    }

    #[test]
    fn a_file_over_the_cut_or_below_the_folder_is_refused() {
        let big = format!("{GOOD}{}", "x".repeat(MAX_BYTES));
        let err = check(".agents/rules/a.md", &big).unwrap_err();
        assert!(err.contains("over the 24000-byte cut"), "{err}");
        let at_the_cut = format!("{GOOD}{}", "x".repeat(MAX_BYTES - GOOD.len()));
        assert_eq!(at_the_cut.len(), MAX_BYTES);
        assert!(check(".agents/rules/a.md", &at_the_cut).is_ok());
        let err = check(".agents/rules/sub/a.md", GOOD).unwrap_err();
        assert!(err.contains("directly in"), "{err}");
        assert!(check(".agents/rules/a.txt", GOOD).is_err());
    }
}
