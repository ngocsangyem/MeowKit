//! Text an install writes into a user's project, on every runtime, does not
//! name the kit's brand in prose. Paths, identifiers and URLs that carry the
//! name (`.meowkit/`, `meowkit-core.md`, `MEOWKIT_TDD`, the repo URL, the
//! `meowkit:` frontmatter key) are functional and stay.
mod support;

use mewkit_adapters::contract::{Op, Scope};
use mewkit_adapters::registry::{emitted, emitter};
use support::{kit, request};

const BRAND: &str = "meowkit";

/// Whether the occurrence of the brand at byte `at` in `line` is a path,
/// identifier or URL rather than prose.
fn functional(line: &str, at: usize) -> bool {
    let bytes = line.as_bytes();
    let end = at + BRAND.len();
    let before = at.checked_sub(1).map(|i| bytes[i]);
    let after = bytes.get(end).copied();
    // A URL: the whitespace-delimited token holding the occurrence.
    let start = line[..at].rfind(char::is_whitespace).map_or(0, |i| i + 1);
    let stop = line[end..]
        .find(char::is_whitespace)
        .map_or(line.len(), |i| end + i);
    if line[start..stop].contains("://") {
        return true;
    }
    // Paths and identifiers are lowercase; `MeowKit-managed` is prose.
    if &line[at..end] != BRAND {
        return false;
    }
    // `.meowkit`, `/meowkit`, `-meowkit`; `meowkit-core.md`, `meowkit/`,
    // `meowkit.ts`.
    if matches!(before, Some(b'.' | b'/' | b'-')) || matches!(after, Some(b'-' | b'/')) {
        return true;
    }
    if after == Some(b'.') && bytes.get(end + 1).is_some_and(u8::is_ascii_alphabetic) {
        return true;
    }
    // The frontmatter namespace key, and a quoted lowercase name: the package
    // name in metadata, a path segment in code.
    if line.trim_start().starts_with("meowkit:") {
        return true;
    }
    let quoted = matches!(
        (before, after),
        (Some(b'"'), Some(b'"')) | (Some(b'\''), Some(b'\''))
    );
    if quoted {
        return true;
    }
    false
}

/// Every prose occurrence of the brand in `text`, as `line: text`.
fn branded(text: &str) -> Vec<String> {
    let mut hits = Vec::new();
    for (n, line) in text.lines().enumerate() {
        let lower = line.to_ascii_lowercase();
        let bytes = lower.as_bytes();
        let mut from = 0;
        while let Some(i) = lower[from..].find(BRAND) {
            let at = from + i;
            let end = at + BRAND.len();
            let word = |b: Option<&u8>| b.is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'_');
            let whole =
                !word(at.checked_sub(1).and_then(|j| bytes.get(j))) && !word(bytes.get(end));
            if whole && !functional(line, at) {
                hits.push(format!("{}: {}", n + 1, line.trim()));
            }
            from = end;
        }
    }
    hits
}

#[test]
fn installed_text_does_not_name_the_brand_in_prose() {
    let dir = tempfile::tempdir().unwrap();
    let scope = Scope::project(dir.path());
    let kit = kit();
    let mut found = Vec::new();
    for runtime in emitted() {
        let plan = emitter(runtime)
            .unwrap()
            .prepare(&request(&kit, &scope, &[], &[]))
            .unwrap();
        for op in &plan.ops {
            let (path, text) = match op {
                Op::WriteFile { path, bytes, .. } => match std::str::from_utf8(bytes) {
                    Ok(text) => (path.as_str(), text.to_owned()),
                    Err(_) => continue,
                },
                Op::MergeBlock { path, content, .. } => (path.as_str(), content.clone()),
                Op::MergeEntries { path, entries, .. } => (
                    path.as_str(),
                    serde_json::to_string_pretty(entries).unwrap(),
                ),
                _ => continue,
            };
            for hit in branded(&text) {
                found.push(format!("{}: {path}:{hit}", runtime.name()));
            }
        }
    }
    found.sort();
    found.dedup();
    assert!(
        found.is_empty(),
        "drop the brand from installed prose (keep paths and identifiers):\n{}",
        found.join("\n")
    );
}

#[test]
fn the_brand_check_tells_prose_from_identifiers() {
    for prose in [
        "MeowKit ship check",
        "the meowkit convention",
        "# MEOWKIT CURSOR HOOK",
    ] {
        assert_eq!(branded(prose).len(), 1, "{prose}");
    }
    for functional in [
        "state lives in .meowkit/",
        "see meowkit-core.md",
        "MEOWKIT_TDD=1",
        "https://github.com/ngocsangyem/MeowKit",
        "meowkit:",
        r#"  "name": "meowkit","#,
        "path.join(gitDir, 'meowkit', 'ship-check')",
        "edit .agents/meowkit/AGENTS.md or meowkit.ts",
    ] {
        assert!(branded(functional).is_empty(), "{functional}");
    }
}
