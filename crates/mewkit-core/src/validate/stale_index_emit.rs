//! Rewrite the declared count tokens to match the inventory.
//!
//! Only the number tokens in README and index headers change; curated index
//! prose and rows are never touched. A missing completeness row is reported by
//! the check and never auto-filled, so this cannot invent documentation.
use std::path::Path;

use regex::Regex;

use super::stale_index::CountSpec;
use super::stale_index_specs::count_specs;

/// Each file whose count tokens are stale, with its corrected body. Paths are
/// repo-relative and `/`-separated; an up-to-date file is absent.
pub fn rewrite_count_tokens(repo_root: &Path) -> Vec<(String, String)> {
    // Group the specs by file so each is read and rewritten once.
    let mut by_source: Vec<(&'static str, Vec<CountSpec>)> = Vec::new();
    for spec in count_specs(repo_root) {
        match by_source
            .iter_mut()
            .find(|(source, _)| *source == spec.source)
        {
            Some((_, specs)) => specs.push(spec),
            None => by_source.push((spec.source, vec![spec])),
        }
    }
    let mut changed = Vec::new();
    for (source, specs) in by_source {
        let path = source
            .split('/')
            .fold(repo_root.to_path_buf(), |acc, part| acc.join(part));
        let Ok(bytes) = std::fs::read(path) else {
            continue;
        };
        let body = String::from_utf8_lossy(&bytes).into_owned();
        let mut next = body.clone();
        for spec in &specs {
            let pattern: Regex =
                crate::js_regex::compile(spec.pattern).expect("a static count pattern");
            let actual = spec.actual.to_string();
            next = pattern
                .replace_all(&next, |caps: &regex::Captures| {
                    caps[0].replacen(&caps[1], &actual, 1)
                })
                .into_owned();
        }
        if next != body {
            changed.push((source.to_string(), next));
        }
    }
    changed
}
