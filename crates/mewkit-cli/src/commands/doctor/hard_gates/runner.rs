//! Replays a Claude Code hook exactly as `.claude/settings.json` configures
//! it: the same executable, the same arguments, JSON on stdin.
//!
//! Two registration shapes exist and both are honoured. Exec form puts the
//! executable in `command` and its arguments in `args`, passed through with no
//! shell. Shell form is one `command` string whose first double-quoted token
//! is the script. Reconstructing only one would silently skip every hook
//! registered the other way, which is how a probe set ends up probing nothing.
use std::io::{Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::{Value, json};

/// A healthy hook runs in about a second, but one that shells out to git or the
/// project's own commands can take far longer under load; only a hung hook is
/// killed at this ceiling.
const TIMEOUT: Duration = Duration::from_secs(30);

pub struct HookCommand {
    pub interpreter: String,
    pub script_ref: String,
    pub script: String,
    pub extra_args: Vec<String>,
}

pub struct HookRun {
    pub script: String,
    /// `None` when the hook was killed or did not start.
    pub status: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

fn basename(path: &str) -> String {
    path.rsplit(['/', '\\']).next().unwrap_or(path).to_string()
}

fn parse_entry(entry: &Value) -> Option<HookCommand> {
    let command = entry.get("command").and_then(Value::as_str).unwrap_or("");
    if command.is_empty() {
        return None;
    }
    if let Some(args) = entry.get("args").and_then(Value::as_array) {
        let script_ref = args.first()?.as_str()?.to_string();
        return Some(HookCommand {
            interpreter: command.to_string(),
            script: basename(&script_ref),
            script_ref,
            extra_args: args[1..]
                .iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect(),
        });
    }
    let (interpreter, rest) = command.split_once(char::is_whitespace)?;
    let quoted = rest.trim_start().strip_prefix('"')?;
    let script_ref = quoted
        .split('"')
        .next()
        .filter(|s| !s.is_empty() && quoted.contains('"'))?;
    Some(HookCommand {
        interpreter: interpreter.to_string(),
        script: basename(script_ref),
        script_ref: script_ref.to_string(),
        extra_args: Vec::new(),
    })
}

/// Does a concrete tool satisfy a group's matcher (`Edit|Write`)? A group with
/// no matcher, or a request with no tool, applies unconditionally.
fn matches(matcher: Option<&str>, tool: Option<&str>) -> bool {
    let (Some(m), Some(t)) = (
        matcher.filter(|m| !m.is_empty()),
        tool.filter(|t| !t.is_empty()),
    ) else {
        return true;
    };
    match mewkit_core::js_regex::compile(&format!("^(?:{m})$")) {
        Ok(re) => re.is_match(t),
        Err(_) => m == t,
    }
}

pub fn parse_hook_commands(settings: &Value, event: &str, tool: Option<&str>) -> Vec<HookCommand> {
    let mut out = Vec::new();
    for group in settings["hooks"][event].as_array().into_iter().flatten() {
        if !matches(group.get("matcher").and_then(Value::as_str), tool) {
            continue;
        }
        out.extend(
            group["hooks"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(parse_entry),
        );
    }
    out
}

fn expand(text: &str, project: &str) -> String {
    text.replace("${CLAUDE_PROJECT_DIR}", project)
        .replace("$CLAUDE_PROJECT_DIR", project)
}

pub struct Request<'a> {
    pub project: &'a Path,
    pub event: &'a str,
    pub tool: Option<&'a str>,
    pub tool_input: Value,
    pub only: Option<&'a str>,
}

/// Run every matching configured command and return one result per command, in
/// settings order.
pub fn run_configured_hook(settings: &Value, req: &Request) -> Vec<HookRun> {
    let project = req.project.to_string_lossy().into_owned();
    let input = json!({
        "hook_event_name": req.event,
        "tool_name": req.tool.unwrap_or(""),
        "tool_input": req.tool_input,
        "session_id": "hook-runner",
        "cwd": project,
        "transcript_path": "",
    })
    .to_string();
    parse_hook_commands(settings, req.event, req.tool)
        .into_iter()
        .filter(|c| req.only.is_none_or(|o| c.script == o))
        .map(|c| {
            let mut args = vec![expand(&c.script_ref, &project)];
            args.extend(c.extra_args.iter().map(|a| expand(a, &project)));
            let mut run = spawn(&c.interpreter, &args, req.project, &project, &input);
            run.script = c.script;
            run
        })
        .collect()
}

fn spawn(program: &str, args: &[String], cwd: &Path, project: &str, input: &str) -> HookRun {
    let failed = || HookRun {
        script: String::new(),
        status: None,
        stdout: String::new(),
        stderr: String::new(),
    };
    let Ok(mut child) = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .env("CLAUDE_PROJECT_DIR", project)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    else {
        return failed();
    };
    // Drain both pipes on their own threads: a hook that writes more than a
    // pipe buffer before reading stdin would otherwise deadlock against us.
    let mut stdin = child.stdin.take();
    let payload = input.to_string();
    let writer = std::thread::spawn(move || {
        if let Some(s) = stdin.as_mut() {
            let _ = s.write_all(payload.as_bytes());
        }
    });
    let mut out = child.stdout.take();
    let mut err = child.stderr.take();
    let read_out = std::thread::spawn(move || {
        let mut s = String::new();
        if let Some(o) = out.as_mut() {
            let _ = o.read_to_string(&mut s);
        }
        s
    });
    let read_err = std::thread::spawn(move || {
        let mut s = String::new();
        if let Some(e) = err.as_mut() {
            let _ = e.read_to_string(&mut s);
        }
        s
    });
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.code(),
            Ok(None) if started.elapsed() < TIMEOUT => {
                std::thread::sleep(Duration::from_millis(10))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
        }
    };
    let _ = writer.join();
    HookRun {
        script: String::new(),
        status,
        stdout: read_out.join().unwrap_or_default(),
        stderr: read_err.join().unwrap_or_default(),
    }
}
