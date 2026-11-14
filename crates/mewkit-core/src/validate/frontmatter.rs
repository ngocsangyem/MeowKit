//! `validate --frontmatter`: every SKILL.md against the schema and the runtime
//! contract.
//!
//! Two severities. An ERROR is a schema violation or a broken runtime contract
//! and fails the check; a WARN is a missing recommended or advisory field,
//! reported and only fatal under `--strict`. Port of
//! `core/check-skill-frontmatter.ts` plus `core/skill-runtime-contract.ts`.
//!
//! The schema is compiled in for the same reason the governance schema is: it
//! describes what this validator accepts, so it changes when the validator
//! changes. Read from a project it would be a second copy that can disagree
//! with the code reading it.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;
use serde_json::{Map, Value};

use super::json_schema_lite::{format_violation, validate_against_schema};
use super::runtime_contract::{RUNTIME_KEY, documented_python_scripts, runtime_contract_errors};

const SKILL_SCHEMA: &str = include_str!("../../schemas/skill-schema.json");

/// Recommended-but-not-required fields. Missing ⇒ WARN.
const RECOMMENDED_FIELDS: [&str; 1] = ["when_to_use"];

/// External-service env-var anchors that mark a SKILL.md body as an
/// external-service entrypoint. Anchored to the `MEOW_`/`MEOWKIT_` forms, NOT a
/// bare `GEMINI_API_KEY`: the real key is `MEOWKIT_GEMINI_API_KEY`, and the
/// bare form appears only inside a legacy-fallback description string.
static EXTERNAL_SERVICE: LazyLock<Vec<Regex>> = LazyLock::new(|| {
    [
        r"\bMEOW_JIRA_",
        r"\bMEOW_CONFLUENCE_",
        r"\bMEOWKIT_GEMINI_API_KEY\b",
        r"\bMEOWKIT_MINIMAX_API_KEY\b",
    ]
    .iter()
    .map(|source| crate::js_regex::compile(source).expect("a static service pattern"))
    .collect()
});

#[derive(Clone, Debug, Default)]
pub struct FrontmatterReport {
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    /// Skills that passed every check.
    pub valid: usize,
    /// Set when the tree could not be read at all.
    pub fatal: Option<String>,
}

/// True when a skill is an external-service entrypoint: its body references an
/// external-service env var, OR its frontmatter marks a user-invocable
/// Jira/Confluence leaf.
pub fn is_external_service_entrypoint(meta: &Map<String, Value>, body: &str) -> bool {
    if EXTERNAL_SERVICE
        .iter()
        .any(|pattern| pattern.is_match(body))
    {
        return true;
    }
    // A non-user-invocable internal is excluded from the frontmatter path.
    if meta.get("user-invocable") == Some(&Value::Bool(false)) {
        return false;
    }
    match meta.get("owner").and_then(Value::as_str) {
        Some("jira") | Some("confluence") => return true,
        _ => {}
    }
    meta.get("agent")
        .and_then(Value::as_str)
        .is_some_and(|agent| agent.starts_with("jira-") || agent.starts_with("confluence-"))
}

/// Advisory WARNs for the tool-contract fields. Never an ERROR: the fields are
/// still being adopted, and a blocking check on a calibration field stops every
/// unrelated change.
pub fn tool_contract_warnings(meta: &Map<String, Value>, body: &str) -> Vec<String> {
    let mut warnings = Vec::new();
    if is_external_service_entrypoint(meta, body) && !meta.contains_key("requires_external_service")
    {
        warnings
            .push("external-service entrypoint missing 'requires_external_service'".to_string());
    }
    if meta.contains_key("requires_external_service") && !meta.contains_key("default_enabled") {
        warnings
            .push("'requires_external_service' present but 'default_enabled' missing".to_string());
    }
    warnings
}

fn skill_names(skills_root: &Path) -> Vec<String> {
    let mut names: Vec<String> = super::dir_order::sorted_entries(skills_root)
        .iter()
        .filter(|entry| entry.path().is_dir())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .filter(|name| !name.starts_with('.'))
        .filter(|name| skills_root.join(name).join("SKILL.md").exists())
        .collect();
    names.sort();
    names
}

/// Validate every `*/SKILL.md` under `<root>/.claude/skills`.
pub fn check_skill_frontmatter(root: &Path) -> FrontmatterReport {
    let skills_root = root.join(".claude").join("skills");
    if !skills_root.exists() {
        return FrontmatterReport {
            fatal: Some(format!("No skills dir at {}", skills_root.display())),
            ..FrontmatterReport::default()
        };
    }
    let schema: Map<String, Value> = serde_json::from_str::<Value>(SKILL_SCHEMA)
        .ok()
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    let mut report = FrontmatterReport::default();

    for name in skill_names(&skills_root) {
        let skill_dir = skills_root.join(&name);
        let skill_md = skill_dir.join("SKILL.md");
        let rel =
            format!(".claude/skills/{name}/SKILL.md").replace('/', std::path::MAIN_SEPARATOR_STR);
        let text = std::fs::read(&skill_md)
            .map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
            .unwrap_or_default();
        let Some((block, body)) = crate::yaml_doc::split_frontmatter(&text) else {
            report.errors.push(format!("{rel}: no YAML frontmatter"));
            continue;
        };
        let parsed = match crate::yaml_doc::parse_value(block) {
            Ok(value) => value,
            Err(error) => {
                report
                    .errors
                    .push(format!("{rel}: YAML parse error: {error}"));
                continue;
            }
        };
        let Some(meta) = parsed.as_object() else {
            report
                .errors
                .push(format!("{rel}: frontmatter is not an object"));
            continue;
        };

        // The runtime contract runs BEFORE the schema: a field confusion also
        // trips the schema's enum, and that generic message is exactly the one
        // that leaves an author guessing which of the two fields they wanted.
        let mut contract_errors = runtime_contract_errors(meta);
        let scripts = documented_python_scripts(&skill_dir);
        if !scripts.is_empty() && !meta.contains_key(RUNTIME_KEY) {
            let listed: Vec<String> = scripts.iter().take(3).cloned().collect();
            contract_errors.push(format!(
                "ships {} on its documented path but declares no '{RUNTIME_KEY}'",
                listed.join(", ")
            ));
        }
        if !contract_errors.is_empty() {
            for message in contract_errors {
                report.errors.push(format!("{rel}: {message}"));
            }
            continue;
        }

        let violations = validate_against_schema(&parsed, &schema, &[]);
        if let Some(first) = violations.first() {
            report
                .errors
                .push(format!("{rel}: {}", format_violation(first)));
            continue;
        }

        for field in RECOMMENDED_FIELDS {
            if !meta.contains_key(field) {
                report
                    .warnings
                    .push(format!("{rel}: recommended field '{field}' missing"));
            }
        }
        for warning in tool_contract_warnings(meta, body) {
            report.warnings.push(format!("{rel}: {warning}"));
        }
        report.valid += 1;
    }
    report
}

#[cfg(test)]
#[path = "frontmatter_tests.rs"]
mod frontmatter_tests;
