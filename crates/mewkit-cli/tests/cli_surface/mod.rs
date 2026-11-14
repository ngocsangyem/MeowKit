//! The CLI surface as clap declares it, read from the built binary's own `--help`.
//!
//! Driving the binary keeps `src/` untouched (it is a binary crate with no library
//! target) and reads exactly what a user sees. Hidden commands never print in help and
//! the not-ported fallback is an `external_subcommand`, so both are excluded without
//! any special casing.
#![allow(dead_code)]

use std::collections::BTreeMap;
use std::process::Command;

const BIN: &str = env!("CARGO_BIN_EXE_mewkit");

/// One command in the tree: the path from the root, its raw help, its children.
pub struct Node {
    pub path: Vec<String>,
    pub help: String,
    pub children: Vec<Node>,
}

impl Node {
    /// Whether the help declares positional arguments (`note <KIND>`): a word after
    /// such a command is a value, not a subcommand.
    pub fn takes_argument(&self) -> bool {
        self.help.lines().any(|l| l.trim_end() == "Arguments:")
    }

    /// The values a verb accepts in a free-text `[SUBCOMMAND]` positional.
    ///
    /// Those verbs model their sub-verb as a plain positional rather than a clap
    /// subcommand, so `Commands:` lists nothing for them. Their help names each accepted
    /// value in backticks on that argument's description, which is the one place the
    /// binary states them; reading it keeps the check from going blind on those verbs.
    pub fn positional_subverbs(&self) -> Vec<String> {
        let mut text = String::new();
        let mut inside = false;
        for line in self.help.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("[SUBCOMMAND]") {
                inside = true;
            } else if inside
                && (trimmed.starts_with('[') || !line.starts_with(' ') && !trimmed.is_empty())
            {
                break;
            }
            if inside {
                text.push_str(trimmed);
                text.push(' ');
            }
        }
        text.split('`')
            .skip(1)
            .step_by(2)
            .filter(|t| {
                t.starts_with(|c: char| c.is_ascii_lowercase())
                    && t.chars()
                        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
            })
            .map(str::to_string)
            .collect()
    }
}

fn help_of(path: &[String]) -> String {
    let out = Command::new(BIN)
        .args(path)
        .arg("--help")
        // Pin the wrap width: help text is committed, so it cannot follow the terminal.
        .env_remove("COLUMNS")
        .env("NO_COLOR", "1")
        .output()
        .expect("run mewkit --help");
    assert!(out.status.success(), "`--help` failed for {path:?}");
    let help = String::from_utf8(out.stdout).expect("help is utf-8");
    // clap names the program in usage lines from argv[0], which on Windows carries the
    // `.exe` suffix; the committed manual is platform-neutral, so drop it and fold CRLF.
    help.replace("\r\n", "\n").replace("mewkit.exe", "mewkit")
}

/// Names under the `Commands:` heading: the lines indented exactly two spaces.
fn child_names(help: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut in_commands = false;
    for line in help.lines() {
        if line.starts_with("Commands:") {
            in_commands = true;
        } else if in_commands && line.trim().is_empty() {
            break;
        } else if in_commands
            && line.starts_with("  ")
            && !line.starts_with("   ")
            && let Some(name) = line.split_whitespace().next()
            && name != "help"
        {
            names.push(name.to_string());
        }
    }
    names
}

fn build(path: Vec<String>) -> Node {
    let help = help_of(&path);
    let children = child_names(&help)
        .into_iter()
        .map(|name| {
            let mut p = path.clone();
            p.push(name);
            build(p)
        })
        .collect();
    Node {
        path,
        help,
        children,
    }
}

/// The root's visible verbs, each with its subtree.
pub fn verbs() -> Vec<Node> {
    child_names(&help_of(&[]))
        .into_iter()
        .map(|name| build(vec![name]))
        .collect()
}

/// Verb -> declared subcommands, plus the verbs that take a positional argument.
pub struct Surface {
    pub subcommands: BTreeMap<String, Vec<String>>,
    pub takes_argument: Vec<String>,
    /// Verb -> values of its free-text `[SUBCOMMAND]` positional, when it has one.
    pub positional_subverbs: BTreeMap<String, Vec<String>>,
}

pub fn surface() -> Surface {
    let mut subcommands = BTreeMap::new();
    let mut takes_argument = Vec::new();
    let mut positional_subverbs = BTreeMap::new();
    for verb in verbs() {
        let name = verb.path[0].clone();
        if verb.takes_argument() {
            takes_argument.push(name.clone());
        }
        let values = verb.positional_subverbs();
        if !values.is_empty() {
            positional_subverbs.insert(name.clone(), values);
        }
        subcommands.insert(
            name,
            verb.children.iter().map(|c| c.path[1].clone()).collect(),
        );
    }
    Surface {
        subcommands,
        takes_argument,
        positional_subverbs,
    }
}
