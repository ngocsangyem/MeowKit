//! The environment names the config replaced.
//!
//! Each was readable from the environment in v2 and is read nowhere now. The
//! second field is the config key that took it over, or empty when nothing
//! replaced it. An enforcement mode must never switch itself off in silence, so
//! a shell still exporting one of these is told about it.
//!
//! `env-name-classification.json` at the repository root is the source of truth
//! — the table below is its `toggle` and `drop` rows, minus the exempt ones, and
//! the test at the bottom derives the same list from that file so the copy
//! cannot drift from it unnoticed.

/// `(name, replacement)`; the replacement is `""` when nothing replaced it.
pub const REMOVED_ENV_NAMES: &[(&str, &str)] = &[
    ("MEOW_JIRA_BASE_URL", ""),
    ("MEOW_PROFILE", ""),
    ("MEOWKIT_ACTIVE_AGENTS", ""),
    ("MEOWKIT_ACTIVE_PLAN", ""),
    ("MEOWKIT_BUDGET_BLOCK", "budget.block"),
    ("MEOWKIT_BUDGET_CAP", "budget.cap"),
    ("MEOWKIT_BUDGET_WARN", "budget.warn"),
    ("MEOWKIT_BUILD_VERIFY", "hooks.build-verify"),
    ("MEOWKIT_BUILD_VERIFY_DEBUG", ""),
    ("MEOWKIT_BUILD_VERIFY_TIMEOUT", "buildVerify.timeoutMs"),
    ("MEOWKIT_COMPLEXITY", ""),
    ("MEOWKIT_HARNESS_MODE", ""),
    ("MEOWKIT_HARNESS_RESUME_STEP", ""),
    ("MEOWKIT_LOOP_DETECT", "hooks.loop-detection"),
    (
        "MEOWKIT_MAX_PROJECT_CONTEXT_BYTES",
        "projectContext.maxBytes",
    ),
    ("MEOWKIT_MEMORY_BUDGET", ""),
    ("MEOWKIT_MEMORY_PRUNE", ""),
    ("MEOWKIT_MEMORY_PRUNE_AGE_DAYS", ""),
    ("MEOWKIT_MEMORY_STALENESS_MONTHS", ""),
    ("MEOWKIT_PRECOMPLETION", "hooks.pre-completion-check"),
    ("MEOWKIT_SUGGESTED_PLAN", ""),
    ("MEOWKIT_SUMMARY_MODE", ""),
    ("MEOWKIT_TDD_FLAG_DETECTOR", "hooks.tdd-flag-detector"),
];

/// The config key that replaced `name`, or `None` when the name is still read.
/// An empty string means the name was dropped with nothing taking it over.
pub fn replacement_for(name: &str) -> Option<&'static str> {
    REMOVED_ENV_NAMES
        .iter()
        .find(|(removed, _)| *removed == name)
        .map(|(_, replacement)| *replacement)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The one name that still outranks its config key is not in the list: it is
    /// read, and telling a user to unset it would switch an enforcement mode off.
    #[test]
    fn the_names_still_read_are_absent() {
        for name in [
            "MEOWKIT_TDD",
            "MEOWKIT_AUTOBUILD_MODE",
            "MEOWKIT_GATE1_PRESENCE_ONLY",
        ] {
            assert!(replacement_for(name).is_none(), "{name} is still read");
        }
    }

    #[test]
    fn a_dropped_name_has_no_replacement_and_a_replaced_one_does() {
        assert_eq!(replacement_for("MEOWKIT_BUDGET_CAP"), Some("budget.cap"));
        assert_eq!(replacement_for("MEOWKIT_COMPLEXITY"), Some(""));
    }

    /// The compiled-in table is the classification file's own rows. Deriving the
    /// expectation from that file rather than from a second copy is what makes a
    /// stale table a failure here instead of a wrong `doctor` message later.
    #[test]
    fn the_table_matches_the_classification_file() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..");
        let source = std::fs::read_to_string(root.join("env-name-classification.json"))
            .expect("env-name-classification.json");
        let table: serde_json::Value = serde_json::from_str(&source).expect("valid JSON");

        let exempt: Vec<&str> = table
            .get("removalExempt")
            .and_then(serde_json::Value::as_object)
            .map(|map| {
                map.keys()
                    .map(String::as_str)
                    .filter(|k| *k != "comment")
                    .collect()
            })
            .unwrap_or_default();

        let mut expected: Vec<(String, String)> = table["names"]
            .as_array()
            .expect("names is an array")
            .iter()
            .filter(|row| matches!(row["class"].as_str(), Some("toggle" | "drop")))
            .filter(|row| !exempt.contains(&row["name"].as_str().unwrap_or_default()))
            .map(|row| {
                let key = row["key"].as_str().unwrap_or_default();
                let replaced_by = row
                    .get("replacedBy")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default();
                (
                    row["name"].as_str().unwrap_or_default().to_string(),
                    if key.is_empty() { replaced_by } else { key }.to_string(),
                )
            })
            .collect();
        expected.sort();

        let mut actual: Vec<(String, String)> = REMOVED_ENV_NAMES
            .iter()
            .map(|(name, replacement)| ((*name).to_string(), (*replacement).to_string()))
            .collect();
        actual.sort();

        assert_eq!(
            actual, expected,
            "the compiled table and env-name-classification.json disagree"
        );
    }
}
