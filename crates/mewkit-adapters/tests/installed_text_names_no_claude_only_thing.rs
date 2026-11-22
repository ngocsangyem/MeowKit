//! Text an install writes for a runtime other than Claude Code does not name
//! Claude Code, a tool only Claude Code provides, a `CLAUDE_*` variable or a
//! `.claude/` path. The Claude Code install keeps the text as authored.
//!
//! Checked: the prose an agent reads (Markdown, the agent TOML files, the
//! blocks merged into a context file). Hook and script code is not prose: it
//! reads `CLAUDE_*` variables on purpose, as a fallback when it runs there.
mod support;

use mewkit_adapters::contract::{Op, Runtime, Scope};
use mewkit_adapters::registry::{emitted, emitter};
use support::{kit, request};

/// Claude-only tokens, matched as whole words.
const TOKENS: &[&str] = &[
    "Claude Code",
    "Claude",
    "AskUserQuestion",
    "TodoWrite",
    "TaskCreate",
    "TaskUpdate",
    "TaskGet",
    "TaskList",
    "TaskClaim",
    "SendMessage",
];

/// Names that hold "Claude" and mean another product, a model family or a
/// source document, not the runtime the text runs on.
const PROPER_NAMES: &[&str] = &[
    "[Claude Code](https://claude.com/claude-code)",
    "Claude Desktop",
    "Support/Claude",
    "Claude Official",
    "Claude/GPT",
    "non-Claude",
    "Claude-XML",
    "Claude-specific",
];

fn prose(path: &str) -> bool {
    [".md", ".mdc", ".toml"]
        .iter()
        .any(|ext| path.ends_with(ext))
}

fn word(b: Option<&u8>) -> bool {
    b.is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'_')
}

/// Every Claude-only token in `line`, outside a proper name.
fn leaks(line: &str) -> Vec<String> {
    let mut masked = line.to_owned();
    for name in PROPER_NAMES {
        masked = masked.replace(name, &"#".repeat(name.len()));
    }
    let bytes = masked.as_bytes();
    let mut found = Vec::new();
    for token in TOKENS {
        for (at, _) in masked.match_indices(token) {
            let end = at + token.len();
            if !word(at.checked_sub(1).and_then(|i| bytes.get(i))) && !word(bytes.get(end)) {
                found.push((*token).to_owned());
            }
        }
    }
    for (at, _) in masked.match_indices("CLAUDE_") {
        if !word(at.checked_sub(1).and_then(|i| bytes.get(i))) {
            let len = masked[at..]
                .find(|c: char| !(c.is_ascii_uppercase() || c == '_'))
                .unwrap_or(masked.len() - at);
            found.push(masked[at..at + len].to_owned());
        }
    }
    if masked.contains(".claude/") {
        found.push(".claude/".to_owned());
    }
    found
}

#[test]
fn installed_text_names_no_claude_only_thing() {
    let dir = tempfile::tempdir().unwrap();
    let scope = Scope::project(dir.path());
    let kit = kit();
    let mut found = Vec::new();
    for runtime in emitted().into_iter().filter(|r| *r != Runtime::ClaudeCode) {
        let plan = emitter(runtime)
            .unwrap()
            .prepare(&request(&kit, &scope, &[], &[]))
            .unwrap();
        for op in &plan.ops {
            let (path, text) = match op {
                Op::WriteFile { path, bytes, .. } if prose(path.as_str()) => {
                    match std::str::from_utf8(bytes) {
                        Ok(text) => (path.as_str(), text),
                        Err(_) => continue,
                    }
                }
                Op::MergeBlock { path, content, .. } => (path.as_str(), content.as_str()),
                _ => continue,
            };
            for (n, line) in text.lines().enumerate() {
                for token in leaks(line) {
                    found.push(format!(
                        "{}: {path}:{}: `{token}` in {}",
                        runtime.name(),
                        n + 1,
                        line.trim()
                    ));
                }
            }
        }
    }
    found.sort();
    found.dedup();
    assert!(
        found.is_empty(),
        "map these in the install-time projection:\n{}",
        found.join("\n")
    );
}

#[test]
fn the_leak_check_tells_a_runtime_word_from_a_proper_name() {
    for leak in [
        "run it in Claude Code",
        "ask Claude",
        "use `AskUserQuestion`",
        "TaskUpdate(taskId)",
        "`CLAUDE_MODEL` is unset",
        "read .claude/rules/x.md",
    ] {
        assert_eq!(leaks(leak).len().min(1), 1, "{leak}");
    }
    for fine in [
        "Generated with [Claude Code](https://claude.com/claude-code)",
        "For Claude Desktop: ~/Library/Application Support/Claude/x.json",
        "Style 6: Claude Official",
        "On non-Claude providers",
        "claude-prompting-best-practices",
        "MY_CLAUDE_MODEL",
        "MyTaskList",
    ] {
        assert!(leaks(fine).is_empty(), "{fine}");
    }
}
