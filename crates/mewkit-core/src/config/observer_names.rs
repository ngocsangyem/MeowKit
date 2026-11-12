//! The observer toggle keys for one project, read from that project's registry.
//!
//! Reading them rather than listing them is what keeps `hooks.<name>` honest: an
//! observer cannot exist without a toggle, a toggle cannot name a handler that
//! is not registered, and adding an observer needs no second edit anywhere.
//!
//! A project with no registry — a clone that was never installed, or an install
//! mid-upgrade — yields an empty list, which makes every `hooks.<name>` key an
//! unknown key. That is the correct answer: nothing is registered, so nothing
//! can be switched off, and the message says the key is not a config key.
use std::fs;
use std::path::Path;

/// `.claude/hooks/handlers.json`, relative to the project root.
pub const REGISTRY_REL: &str = ".claude/hooks/handlers.json";

/// Kebab-case toggle keys, sorted and deduplicated; empty when unreadable.
pub fn observer_names(root: &Path) -> Vec<String> {
    let file = root.join(".claude").join("hooks").join("handlers.json");
    let Ok(source) = fs::read_to_string(&file) else {
        return Vec::new();
    };
    let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&source) else {
        return Vec::new();
    };
    let Some(handlers) = parsed.get("handlers").and_then(|value| value.as_array()) else {
        return Vec::new();
    };
    let mut names: Vec<String> = handlers
        .iter()
        .filter_map(|entry| entry.get("toggleKey").and_then(|key| key.as_str()))
        .filter(|key| !key.is_empty())
        .map(str::to_string)
        .collect();
    names.sort_unstable();
    names.dedup();
    names
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_project_with_no_registry_registers_nothing() {
        assert!(observer_names(Path::new("/nonexistent")).is_empty());
    }

    #[test]
    fn this_repository_registers_its_own_observers() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("..");
        let names = observer_names(&root);
        assert!(
            names.len() > 10,
            "the kit's own registry should list every observer, found {names:?}"
        );
        assert!(names.contains(&"budget-tracker".to_string()));
        // Sorted and deduplicated, because the key table is built from this list
        // and a duplicate would declare one toggle twice.
        let mut sorted = names.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(names, sorted);
    }

    #[test]
    fn unparsable_json_registers_nothing() {
        let dir = tempfile::tempdir().expect("a temporary directory");
        let hooks = dir.path().join(".claude").join("hooks");
        fs::create_dir_all(&hooks).expect("the registry directory");
        fs::write(hooks.join("handlers.json"), "{ not json").expect("the registry");
        assert!(observer_names(dir.path()).is_empty());
    }

    #[test]
    fn a_registry_without_handlers_registers_nothing() {
        let dir = tempfile::tempdir().expect("a temporary directory");
        let hooks = dir.path().join(".claude").join("hooks");
        fs::create_dir_all(&hooks).expect("the registry directory");
        fs::write(hooks.join("handlers.json"), "{\"handlers\": \"none\"}").expect("the registry");
        assert!(observer_names(dir.path()).is_empty());
        assert_eq!(REGISTRY_REL, ".claude/hooks/handlers.json");
    }
}
