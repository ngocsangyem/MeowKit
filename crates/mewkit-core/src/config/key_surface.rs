//! The KEYS a config may set, with the type each one holds.
//!
//! Split from [`super::schema`], which owns what a config may not SAY (the
//! refused namespaces, the protected hooks, the state-only keys). Both halves
//! are re-exported through that module, so a caller still has one import.
//!
//! Order is the declaration order of `schema.ts`, because the stub writes the
//! keys in it and the rules report the first offending key in it.

pub const AUTOBUILD_MODES: &[&str] = &["MINIMAL", "FULL", "LEAN"];
pub const TELEMETRY_MODES: &[&str] = &["off", "community", "anonymous"];

/// One commented stub line per key, so an uncommented file is the user's
/// choices.
pub const KEY_DOC: &[(&str, &str)] = &[
    (
        "tdd",
        "strict test-first mode. MEOWKIT_TDD in the environment still outranks this.",
    ),
    (
        "autobuild.mode",
        "density preset. Sets density only; it cannot bypass the contract gate.",
    ),
    (
        "budget.cap",
        "overrides the hard block, in USD — lower or higher than budget.block.",
    ),
    (
        "budget.warn",
        "estimated session cost in USD at which a warning is printed.",
    ),
    (
        "budget.block",
        "estimated session cost in USD at which work is blocked.",
    ),
    (
        "buildVerify.timeoutMs",
        "how long the post-write build check may take.",
    ),
    (
        "projectContext.maxBytes",
        "ceiling on the project-context file injected at session start.",
    ),
    ("workflow.telemetry", "off, community or anonymous."),
    (
        "workflow.proactive",
        "whether skills volunteer suggestions.",
    ),
];

/// The type a key's value must have.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ValueKind {
    Boolean,
    Integer,
    String,
}

/// One key's type, and the values it is restricted to when it has an enum.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct KeySpec {
    pub kind: ValueKind,
    pub allowed: Option<&'static [&'static str]>,
}

impl KeySpec {
    const fn boolean() -> Self {
        Self {
            kind: ValueKind::Boolean,
            allowed: None,
        }
    }

    const fn integer() -> Self {
        Self {
            kind: ValueKind::Integer,
            allowed: None,
        }
    }

    const fn one_of(allowed: &'static [&'static str]) -> Self {
        Self {
            kind: ValueKind::String,
            allowed: Some(allowed),
        }
    }
}

/// The scalar half of the surface, with the type for each key.
pub const SCALAR_KEYS: &[(&str, KeySpec)] = &[
    ("tdd", KeySpec::boolean()),
    ("autobuild.mode", KeySpec::one_of(AUTOBUILD_MODES)),
    ("budget.cap", KeySpec::integer()),
    ("budget.warn", KeySpec::integer()),
    ("budget.block", KeySpec::integer()),
    ("buildVerify.timeoutMs", KeySpec::integer()),
    ("projectContext.maxBytes", KeySpec::integer()),
    ("workflow.telemetry", KeySpec::one_of(TELEMETRY_MODES)),
    ("workflow.proactive", KeySpec::boolean()),
];

/// Every legal dotted key for one project: the scalars above plus one toggle per
/// registered observer, in that order.
pub fn known_keys(observer_names: &[String]) -> Vec<(String, KeySpec)> {
    let mut keys: Vec<(String, KeySpec)> = SCALAR_KEYS
        .iter()
        .map(|(key, spec)| ((*key).to_string(), *spec))
        .collect();
    for name in observer_names {
        keys.push((format!("hooks.{name}"), KeySpec::boolean()));
    }
    keys
}

/// The one-line explanation a stub carries above a key.
pub fn key_doc(key: &str) -> Option<&'static str> {
    super::schema::lookup(KEY_DOC, key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_scalar_key_is_documented() {
        for (key, _) in SCALAR_KEYS {
            assert!(key_doc(key).is_some(), "{key} has no stub explanation");
        }
    }

    #[test]
    fn the_three_budget_keys_are_documented_in_usd() {
        for key in ["budget.cap", "budget.warn", "budget.block"] {
            let doc = key_doc(key).expect(key);
            assert!(doc.contains("USD"), "{key}: {doc}");
            assert!(!doc.contains("token"), "{key}: {doc}");
            assert!(!doc.contains("percent"), "{key}: {doc}");
        }
    }

    #[test]
    fn an_observer_gets_one_boolean_toggle_each() {
        let names = vec!["budget-tracker".to_string(), "post-write".to_string()];
        let keys = known_keys(&names);
        assert_eq!(keys.len(), SCALAR_KEYS.len() + 2);
        for name in &names {
            let key = format!("hooks.{name}");
            let spec = keys.iter().find(|(k, _)| *k == key).map(|(_, spec)| *spec);
            assert_eq!(spec, Some(KeySpec::boolean()), "{key}");
        }
    }
}
