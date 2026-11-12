//! The flat map a config file parses to, and the three value types it holds.
//!
//! Flat (`budget.cap`) rather than nested, because the hook reader that parses
//! the same file by hand emits flat paths too: two shapes that print alike can
//! still differ in a value's type, and comparing dotted path to dotted path is
//! what makes the two readers checkable against each other.
//!
//! Insertion ORDER is part of the contract. The rules below reject a file on its
//! first offending key, so a map that reordered keys would name a different key
//! than the reader the hooks run — the same file, two different error messages.
//! Hence a vector of pairs with replace-in-place semantics rather than a sorted
//! or hashed map.
use std::fmt;

/// A config scalar: the grammar has booleans, whole numbers and strings.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ConfigValue {
    Bool(bool),
    Int(i64),
    Str(String),
}

impl ConfigValue {
    /// The value as a message would print it, matching `JSON.stringify` — so a
    /// string is quoted and a number is not, which is how the user tells the
    /// spelling `7` from the spelling `"7"` in a wrong-type message.
    pub fn literal(&self) -> String {
        match self {
            Self::Bool(value) => value.to_string(),
            Self::Int(value) => value.to_string(),
            Self::Str(value) => {
                serde_json::to_string(value).unwrap_or_else(|_| format!("\"{value}\""))
            }
        }
    }

    /// The text of a string value. A caller that needs a boolean or a number
    /// matches on the variant: the rules below have to distinguish "not a
    /// string" from "a string that is wrong", and an accessor per type would
    /// hide that difference.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::Str(value) => Some(value),
            _ => None,
        }
    }
}

impl fmt::Display for ConfigValue {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Bool(value) => write!(f, "{value}"),
            Self::Int(value) => write!(f, "{value}"),
            Self::Str(value) => write!(f, "{value}"),
        }
    }
}

impl From<bool> for ConfigValue {
    fn from(value: bool) -> Self {
        Self::Bool(value)
    }
}

impl From<i64> for ConfigValue {
    fn from(value: i64) -> Self {
        Self::Int(value)
    }
}

impl From<&str> for ConfigValue {
    fn from(value: &str) -> Self {
        Self::Str(value.to_string())
    }
}

impl From<String> for ConfigValue {
    fn from(value: String) -> Self {
        Self::Str(value)
    }
}

/// Dotted path to scalar, in the order the keys were first written.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ConfigValues {
    entries: Vec<(String, ConfigValue)>,
}

impl ConfigValues {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set one key. An existing key keeps its position and takes the new value,
    /// so a higher precedence level overrides without reordering the file.
    pub fn insert(&mut self, key: impl Into<String>, value: impl Into<ConfigValue>) {
        let key = key.into();
        let value = value.into();
        match self.entries.iter_mut().find(|(name, _)| *name == key) {
            Some(slot) => slot.1 = value,
            None => self.entries.push((key, value)),
        }
    }

    pub fn get(&self, key: &str) -> Option<&ConfigValue> {
        self.entries
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value)
    }

    pub fn iter(&self) -> impl Iterator<Item = (&str, &ConfigValue)> {
        self.entries
            .iter()
            .map(|(key, value)| (key.as_str(), value))
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// The keys, sorted — for a report or an assertion that does not care which
    /// key was written first.
    pub fn sorted_keys(&self) -> Vec<&str> {
        let mut keys: Vec<&str> = self.entries.iter().map(|(key, _)| key.as_str()).collect();
        keys.sort_unstable();
        keys
    }
}

impl<K: Into<String>, V: Into<ConfigValue>> FromIterator<(K, V)> for ConfigValues {
    fn from_iter<I: IntoIterator<Item = (K, V)>>(iter: I) -> Self {
        let mut values = Self::new();
        for (key, value) in iter {
            values.insert(key, value);
        }
        values
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_overwrite_keeps_the_original_position() {
        let mut values = ConfigValues::new();
        values.insert("tdd", true);
        values.insert("budget.cap", 5_i64);
        values.insert("tdd", false);
        assert_eq!(
            values.iter().map(|(key, _)| key).collect::<Vec<_>>(),
            vec!["tdd", "budget.cap"]
        );
        assert_eq!(values.get("tdd"), Some(&ConfigValue::Bool(false)));
    }

    #[test]
    fn a_literal_prints_the_way_a_message_quotes_it() {
        assert_eq!(ConfigValue::Int(7).literal(), "7");
        assert_eq!(ConfigValue::Bool(true).literal(), "true");
        // Printed, a string is itself; quoted in a message, it is distinguishable
        // from the number with the same digits.
        assert_eq!(ConfigValue::Str("7".into()).to_string(), "7");
        assert_eq!(ConfigValue::Str("7".into()).literal(), "\"7\"");
        assert_eq!(ConfigValue::Str("TURBO".into()).literal(), "\"TURBO\"");
    }
}
