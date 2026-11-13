//! Argument tolerance for the verbs ported from the npm CLI.
//!
//! The npm CLI parses argv with minimist against one global flag table, so a
//! misspelled flag or a stray word is kept as data and the command runs anyway.
//! Hooks and skills were written against that behaviour, and a port must not
//! turn an invocation that used to run into a usage error. So, for the ported
//! verbs only, argv is rewritten into the subset clap accepts, with minimist's
//! meaning: unknown flags (and the value minimist would give them) are dropped,
//! booleans are last-wins and honour `--x=false` and `--no-x`, and positionals
//! beyond what the command takes are dropped. Everything clap does know passes
//! through, so clap still reports a missing value or an unknown subcommand.
use std::collections::BTreeMap;

use clap::{ArgAction, Command};

use crate::minimist_flags::{ALIASES, is_global_boolean, is_global_flag};

/// The verbs whose argv gets minimist semantics.
pub const PORTED_VERBS: &[&str] = &["note", "orient", "plan", "task", "task-state", "validate"];

/// `argv` as clap should see it. Only rewritten when argv[1] is a ported verb.
pub fn normalise(argv: Vec<String>, root: &Command) -> Vec<String> {
    let Some(verb) = argv.get(1) else { return argv };
    let Some(cmd) = root
        .find_subcommand(verb)
        .filter(|_| PORTED_VERBS.contains(&verb.as_str()))
    else {
        return argv;
    };
    let mut out = argv[..2].to_vec();
    out.extend(rewrite(&argv[2..], cmd));
    out
}

/// minimist's test for "the next token is a flag, so it is not my value".
fn looks_like_flag(token: &str) -> bool {
    let rest = token.strip_prefix("--").or_else(|| token.strip_prefix('-'));
    rest.is_some_and(|r| !r.is_empty() && !r.starts_with('-'))
}

struct Leaf<'a> {
    cmd: &'a Command,
    positionals: usize,
}

impl Leaf<'_> {
    fn arg(&self, long: &str) -> Option<&clap::Arg> {
        self.cmd
            .get_arguments()
            .find(|a| a.get_long() == Some(long))
    }
    fn is_bool(&self, long: &str) -> Option<bool> {
        self.arg(long).map(|a| {
            matches!(
                a.get_action(),
                ArgAction::SetTrue | ArgAction::SetFalse | ArgAction::Count
            )
        })
    }
    /// How many positionals this command still accepts (`usize::MAX` = unbounded).
    fn capacity(&self) -> usize {
        self.cmd
            .get_positionals()
            .map(|a| a.get_num_args().map_or(1, |n| n.max_values()))
            .fold(0usize, usize::saturating_add)
    }
}

/// A flag as minimist reads it: position-independent, its value decided by the
/// global table alone, never by the verb.
enum Flag {
    /// `--x`, `--x true`, `--x=v`, `-y`.
    Set(String, Option<String>),
    /// `--no-x`.
    Off(String),
}

fn rewrite(tokens: &[String], verb: &Command) -> Vec<String> {
    let (flags, positionals, tail) = split(tokens);
    let mut leaf = Leaf {
        cmd: verb,
        positionals: 0,
    };
    let mut out = Vec::new();
    for token in positionals {
        if leaf.positionals == 0 && leaf.cmd.find_subcommand(&token).is_some() {
            let sub = leaf.cmd.find_subcommand(&token).expect("checked");
            out.push(token);
            leaf = Leaf {
                cmd: sub,
                positionals: 0,
            };
        } else if (leaf.cmd.has_subcommands() && leaf.positionals == 0 && leaf.capacity() == 0)
            || leaf.positionals < leaf.capacity()
        {
            // Wanted, or an unknown sub-verb that clap should name, as the npm CLI does.
            out.push(token);
            leaf.positionals += 1;
        }
    }
    // Flags are matched against the command the positionals selected, so a
    // flag written before its sub-verb (`plan --json status`) still reaches it.
    let mut bools: BTreeMap<String, bool> = BTreeMap::new();
    for flag in flags {
        match flag {
            Flag::Set(name, _) if name == "help" => out.push("--help".to_string()),
            Flag::Off(base) => {
                if leaf.is_bool(&base) == Some(true) || leaf.arg(&format!("no-{base}")).is_some() {
                    bools.insert(base, false);
                }
            }
            Flag::Set(name, value) => match leaf.is_bool(&name) {
                Some(true) => {
                    let on = value.as_deref().is_none_or(|v| v != "false");
                    bools.insert(name, on);
                }
                Some(false) => out.push(format!("--{name}={}", value.unwrap_or_default())),
                None => {}
            },
        }
    }
    for (name, on) in bools {
        if on {
            out.push(format!("--{name}"));
        } else if leaf.arg(&format!("no-{name}")).is_some() {
            out.push(format!("--no-{name}"));
        }
    }
    // Booleans go before `--`, which must stay last for clap to see it.
    out.extend(tail);
    out
}

/// minimist's tokenizer: flags (with the values they take), positionals, and
/// everything from `--` on.
fn split(tokens: &[String]) -> (Vec<Flag>, Vec<String>, Vec<String>) {
    let (mut flags, mut positionals) = (Vec::new(), Vec::new());
    let mut i = 0;
    while i < tokens.len() {
        let token = &tokens[i];
        let next = tokens.get(i + 1);
        i += 1;
        if token == "--" {
            return (flags, positionals, tokens[i - 1..].to_vec());
        }
        if let Some(body) = token.strip_prefix("--").filter(|b| !b.is_empty()) {
            let (flag, used) = long_flag(body, next);
            flags.push(flag);
            i += used;
        } else if let Some(letters) = token.strip_prefix('-').filter(|l| !l.is_empty()) {
            i += short_flags(letters, next, &mut flags);
        } else {
            positionals.push(token.clone());
        }
    }
    (flags, positionals, Vec::new())
}

/// One `--name[=value]` and how many FOLLOWING tokens it consumed.
fn long_flag(body: &str, next: Option<&String>) -> (Flag, usize) {
    if let Some((name, value)) = body.split_once('=') {
        let value = if is_global_boolean(name) {
            (value != "false").to_string()
        } else {
            value.to_string()
        };
        return (Flag::Set(name.to_string(), Some(value)), 0);
    }
    // minimist reads `--no-x` as x=false before looking anything up.
    if let Some(base) = body.strip_prefix("no-") {
        return (Flag::Off(base.to_string()), 0);
    }
    let name = body.to_string();
    if is_global_boolean(body) {
        return match next.filter(|n| *n == "true" || *n == "false") {
            Some(word) => (Flag::Set(name, Some(word.clone())), 1),
            None => (Flag::Set(name, None), 0),
        };
    }
    match next.filter(|n| !looks_like_flag(n)) {
        Some(value) => (Flag::Set(name, Some(value.clone())), 1),
        // A declared string flag with no value is "", an undeclared one is true.
        None if is_global_flag(body) => (Flag::Set(name, Some(String::new())), 0),
        None => (Flag::Set(name, None), 0),
    }
}

/// A `-abc` cluster through the alias table. An unknown last letter takes the
/// next token as its value, as minimist does; unknown letters are dropped.
fn short_flags(letters: &str, next: Option<&String>, flags: &mut Vec<Flag>) -> usize {
    let mut used = 0;
    let count = letters.chars().count();
    for (idx, letter) in letters.chars().enumerate() {
        match ALIASES.iter().find(|(s, _)| *s == letter) {
            Some((_, long)) => flags.push(Flag::Set((*long).to_string(), None)),
            None if idx + 1 == count && next.is_some_and(|n| !looks_like_flag(n)) => used = 1,
            None => {}
        }
    }
    used
}

#[cfg(test)]
#[path = "argv_compat_tests.rs"]
mod tests;
