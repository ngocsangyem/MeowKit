//! The verification class of a command (test, typecheck, lint, build), the
//! same answer the completion check's `classifyCommand` gives in
//! `.claude/hooks/lib/core/completion-check.cjs`. The `regex` crate has no
//! look-around, so the hook's two look-ahead checks are written out by hand.
use std::sync::LazyLock;

use regex::Regex;

static CLASSES: LazyLock<Vec<(&'static str, Regex)>> = LazyLock::new(|| {
    [
        ("test", r"^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?test\b|vitest\b|jest\b|mocha\b|ava\b|pytest\b|python3?\s+-m\s+(?:pytest|unittest)\b|cargo\s+(?:test|nextest)\b|go\s+test\b|node\s+--test\b|swift\s+test\b|playwright\s+test\b|rspec\b|phpunit\b|make\s+test\b|(?:ba)?sh\s+\S*test\S*\.sh\b)"),
        ("typecheck", r"^(?:tsc\b.*--noEmit\b|vue-tsc\b|(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?(?:typecheck|type-check|tsc)\b|mypy\b|pyright\b|cargo\s+check\b)"),
        ("lint", r"^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?lint\b|eslint\b|biome\s+(?:check|lint)\b|ruff\s+check\b|cargo\s+clippy\b|golangci-lint\b|rubocop\b|swiftlint\b)"),
        // `make` is handled in `is_build_make`: the hook excludes `make -n`.
        ("build", r"^(?:(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?build\b|tsc\b|cargo\s+build\b|go\s+build\b|swift\s+build\b|vite\s+build\b|next\s+build\b)"),
    ]
    .into_iter()
    .map(|(name, re)| (name, Regex::new(re).expect("static pattern")))
    .collect()
});

static PREFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^(?:(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)+|(?:npx|bunx|pnpm\s+exec|pnpm\s+dlx|yarn\s+dlx|uv\s+run|poetry\s+run)\s+)")
        .expect("static pattern")
});
static MAKE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^make\b").expect("static pattern"));
static DRY_RUN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\s+-n").expect("static pattern"));
static CD_ONLY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^cd\s+\S+$").expect("static pattern"));

/// A lone `&` (not part of `&&`) or a lone `|` (not part of `||`).
fn has_lone(chars: &[char], c: char) -> bool {
    (0..chars.len())
        .any(|i| chars[i] == c && (i == 0 || chars[i - 1] != c) && chars.get(i + 1) != Some(&c))
}

/// A command whose exit status could come from something other than the
/// runner (`;`, `||`, a pipe, backgrounding, a subshell) is never classified.
fn exit_status_is_indirect(text: &str) -> bool {
    let chars: Vec<char> = text.chars().collect();
    text.contains([';', '`'])
        || text.contains("||")
        || text.contains("$(")
        || has_lone(&chars, '|')
        || has_lone(&chars, '&')
}

pub fn classify(command: &str) -> Option<&'static str> {
    let text = command.trim();
    if text.is_empty() || exit_status_is_indirect(text) {
        return None;
    }
    for raw in text.split("&&") {
        let mut segment = raw.trim().to_string();
        if CD_ONLY.is_match(&segment) {
            segment.clear();
        }
        if segment.is_empty() {
            continue;
        }
        loop {
            let next = PREFIX.replace(&segment, "").into_owned();
            if next == segment {
                break;
            }
            segment = next;
        }
        for (name, re) in CLASSES.iter() {
            if re.is_match(&segment) {
                return Some(name);
            }
        }
        if MAKE.is_match(&segment) && !DRY_RUN.is_match(&segment[4..]) {
            return Some("build");
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::classify;

    #[test]
    fn classes_match_the_hook() {
        for (cmd, want) in [
            ("cargo test -p x", Some("test")),
            ("RUST_LOG=1 cargo test", Some("test")),
            ("npx vitest run", Some("test")),
            ("cd crates && cargo clippy", Some("lint")),
            ("tsc --noEmit", Some("typecheck")),
            ("tsc", Some("build")),
            ("make", Some("build")),
            ("make test", Some("test")),
            ("make -n", None),
            ("npm test | tail", None),
            ("npm test || true", None),
            ("npm test &", None),
            ("echo $(cargo test)", None),
            ("ls", None),
        ] {
            assert_eq!(classify(cmd), want, "{cmd}");
        }
    }
}
