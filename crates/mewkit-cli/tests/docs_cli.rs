//! The user docs and the CLI agree.
//!
//! Two checks. Every `mewkit <verb> [<sub>] [--flag]` the docs site, the landing page, the
//! README and `CLAUDE.md` tell a reader to run resolves against the binary's own `--help`,
//! flags included. And the "Every flag" tables on the CLI reference page are generated from
//! that same help, so they list exactly what the binary accepts.
//! `MEWKIT_BLESS=1 cargo test -p mewkit-cli --test docs_cli` rewrites the tables. Help text
//! therefore lands on a page the docs prose lint holds to its strict tier (no em dashes), so
//! clap doc comments avoid them. A third check keeps the retired `npx mewkit` form from
//! coming back outside the history pages and the README's deprecation notice.

mod cli_surface;

use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use cli_surface::Node;
use cli_surface::references::scan;

const DOCS: &[&str] = &[
    "packages/docs/content",
    "packages/landing",
    "README.md",
    "CLAUDE.md",
];
/// History and the move off the npm CLI name commands as they were, not as they are.
const HISTORY: &[&str] = &[
    "packages/docs/content/docs/changelog",
    "packages/docs/content/docs/migration",
];
const REFERENCE_PAGE: &str = "packages/docs/content/docs/cli/index.mdx";
const START: &str = "{/* GENERATED:cli-flags START */}";
const END: &str = "{/* GENERATED:cli-flags END */}";

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
}

/// Make clap's help text safe in an MDX table cell: `|` always splits a cell, and outside
/// code spans `<`, `>`, `{` and `}` would be read as JSX.
fn cell(text: &str) -> String {
    text.split('`')
        .enumerate()
        .map(|(i, part)| {
            let part = part.replace('|', "\\|");
            if i % 2 == 1 {
                part
            } else {
                part.replace('<', "&lt;")
                    .replace('>', "&gt;")
                    .replace('{', "\\{")
                    .replace('}', "\\}")
            }
        })
        .collect::<Vec<_>>()
        .join("`")
}

/// `(flag, value, description)` for each option, help and version left out. clap prints a
/// description beside the flag, or on the following lines when the flags are too wide.
fn options(help: &str) -> Vec<(String, Option<String>, String)> {
    let mut out: Vec<(String, Option<String>, String)> = Vec::new();
    let mut inside = false;
    for line in help.lines() {
        if line.starts_with("Options:") {
            inside = true;
            continue;
        }
        if !inside || line.trim().is_empty() {
            continue;
        }
        if !line.starts_with(' ') {
            break;
        }
        let trimmed = line.trim_start();
        if trimmed.starts_with('-') && line.len() - trimmed.len() <= 6 {
            let spec = trimmed.split("  ").next().unwrap_or(trimmed);
            let desc = trimmed[spec.len()..].trim().to_string();
            let long = spec.rsplit(", ").next().unwrap_or(spec);
            let (flag, value) = match long.split_once(' ') {
                Some((f, v)) => (f.to_string(), Some(v.to_string())),
                None => (long.to_string(), None),
            };
            out.push((flag, value, desc));
        } else if let Some(last) = out.last_mut() {
            last.2 = format!("{} {}", last.2, trimmed).trim().to_string();
        }
    }
    out.retain(|(f, _, _)| f != "--help" && f != "--version");
    out
}

fn render_node(out: &mut String, node: &Node) {
    let about = node.help.lines().next().unwrap_or("").trim();
    let _ = write!(
        out,
        "### `mewkit {}`\n\n{}\n\n",
        node.path.join(" "),
        cell(about)
    );
    let subs: Vec<String> = if node.children.is_empty() {
        node.positional_subverbs()
    } else {
        node.children
            .iter()
            .map(|c| c.path.last().unwrap().clone())
            .collect()
    };
    if !subs.is_empty() {
        let list: Vec<String> = subs.iter().map(|s| format!("`{s}`")).collect();
        let _ = write!(out, "Subcommands: {}.\n\n", list.join(", "));
    }
    let opts = options(&node.help);
    if !opts.is_empty() {
        out.push_str("| Flag | What it does |\n|---|---|\n");
        for (flag, value, desc) in opts {
            let value = value.map_or(String::new(), |v| format!(" `{v}`"));
            let _ = writeln!(out, "| `{flag}`{value} | {} |", cell(&desc));
        }
        out.push('\n');
    }
    for child in &node.children {
        render_node(out, child);
    }
}

fn render() -> String {
    let mut out = format!(
        "{START}\n\n_Generated from `mewkit --help`. Run `MEWKIT_BLESS=1 cargo test -p mewkit-cli \
         --test docs_cli` after changing a command; do not edit this table by hand._\n\n\
         Every command takes `--help`; `mewkit --version` prints the version.\n\n"
    );
    for verb in cli_surface::verbs() {
        render_node(&mut out, &verb);
    }
    format!("{}\n\n{END}", out.trim_end())
}

#[test]
fn every_flag_table_matches_the_binary() {
    let path = repo_root().join(REFERENCE_PAGE);
    let page = fs::read_to_string(&path)
        .expect("read cli/index.mdx")
        .replace("\r\n", "\n");
    let (start, end) = (
        page.find(START).expect("start marker"),
        page.find(END).expect("end marker") + END.len(),
    );
    let rendered = render();
    if std::env::var("MEWKIT_BLESS").is_ok_and(|v| v == "1") {
        let page = format!("{}{rendered}{}", &page[..start], &page[end..]);
        fs::write(&path, page).expect("write cli/index.mdx");
        return;
    }
    let first_diff = page[start..end]
        .lines()
        .zip(rendered.lines())
        .enumerate()
        .find(|(_, (a, b))| a != b)
        .map(|(i, (a, b))| format!("block line {}:\n  committed: {a}\n  rendered:  {b}", i + 1))
        .unwrap_or_else(|| "the blocks differ in length".to_string());
    assert!(
        page[start..end] == rendered,
        "{REFERENCE_PAGE}'s flag tables are stale.\n{first_diff}\n\
         Fix: MEWKIT_BLESS=1 cargo test -p mewkit-cli --test docs_cli"
    );
}

#[test]
fn every_docs_command_and_flag_resolves() {
    let s = scan(&repo_root(), DOCS, HISTORY, true);
    assert!(
        s.calls > 100,
        "scanned only {} references; scope broken?",
        s.calls
    );
    assert!(
        s.findings.is_empty(),
        "{} docs reference(s) the binary would not run as written:\n{}",
        s.findings.len(),
        s.findings.join("\n")
    );
}

#[test]
fn a_planted_bad_flag_is_caught() {
    let dir = tempfile::tempdir().expect("tempdir");
    fs::write(
        dir.path().join("a.md"),
        "Run `mewkit plan approve x --by me --sign`, then `mk upgrade --check | head`.\n\
         `mewkit budget --monthly --nope` and `mewkit task new --type feature \"x\"`.\n",
    )
    .expect("write");
    let s = scan(dir.path(), &["a.md"], &[], true);
    assert_eq!(
        s.findings,
        [
            "a.md:1: `mewkit plan approve` has no `--sign`",
            "a.md:2: `mewkit budget` has no `--nope`",
        ]
    );
}

#[test]
fn the_retired_npx_form_is_not_taught() {
    let root = repo_root();
    let mut files = Vec::new();
    for tree in DOCS.iter().filter(|t| **t != "README.md") {
        cli_surface::references::files(&root, tree, HISTORY, &mut files);
    }
    let hits: Vec<String> = files
        .iter()
        .flat_map(|f| {
            let text = fs::read_to_string(f).unwrap_or_default();
            let rel = f.strip_prefix(&root).unwrap_or(f).display().to_string();
            text.lines()
                .enumerate()
                .filter(|(_, l)| l.contains("npx mewkit"))
                .map(|(i, _)| format!("{rel}:{}", i + 1))
                .collect::<Vec<_>>()
        })
        .collect();
    assert!(
        hits.is_empty(),
        "`npx mewkit` is retired; write `mewkit`:\n{}",
        hits.join("\n")
    );
}
