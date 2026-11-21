//! Run one headless turn of a runtime inside a sandbox, with a deadline.
//!
//! The command line never widens the runtime's permissions: Claude Code gets
//! an explicit tool allowlist and no web tools; Codex gets a read-only sandbox
//! unless the case's tools need writes. Model and output format are pinned so
//! two reports of the same suite ran the same command.

use std::fs::File;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use super::transcript::Runtime;

/// Tools a case gets when it names none: enough to load and read a skill.
pub const DEFAULT_TOOLS: [&str; 4] = ["Skill", "Read", "Glob", "Grep"];
const WRITE_TOOLS: [&str; 4] = ["Write", "Edit", "MultiEdit", "Bash"];

pub struct RunSpec<'a> {
    pub runtime: Runtime,
    pub model: &'a str,
    pub prompt: &'a str,
    pub tools: &'a [String],
    pub max_turns: u32,
}

/// Program and arguments for one run; the working directory is set by the caller.
pub fn command_line(spec: &RunSpec<'_>) -> (String, Vec<String>) {
    let tools: Vec<String> = if spec.tools.is_empty() {
        DEFAULT_TOOLS.iter().map(|t| (*t).to_owned()).collect()
    } else {
        spec.tools.to_vec()
    };
    let s = |v: &str| v.to_owned();
    match spec.runtime {
        Runtime::ClaudeCode => {
            let mut args = vec![
                s("-p"),
                s(spec.prompt),
                s("--model"),
                s(spec.model),
                s("--output-format"),
                s("stream-json"),
                s("--verbose"),
                s("--setting-sources"),
                s("project"),
                s("--max-turns"),
                spec.max_turns.to_string(),
                s("--disallowedTools"),
                s("WebFetch"),
                s("WebSearch"),
                s("--allowedTools"),
            ];
            args.extend(tools);
            (s("claude"), args)
        }
        Runtime::Codex => {
            let writes = tools.iter().any(|t| WRITE_TOOLS.contains(&t.as_str()));
            let sandbox = if writes {
                "workspace-write"
            } else {
                "read-only"
            };
            let args = vec![
                s("exec"),
                s("--json"),
                s("--model"),
                s(spec.model),
                s("-s"),
                s(sandbox),
                s("--skip-git-repo-check"),
                s(spec.prompt),
            ];
            (s("codex"), args)
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ChildError {
    #[error("could not start {program}: {source}")]
    Spawn {
        program: String,
        source: std::io::Error,
    },
    #[error("timed out after {0}s")]
    Timeout(u64),
    #[error("i/o while running the child: {0}")]
    Io(#[from] std::io::Error),
}

/// Run `program` in `cwd` with exactly `env`, stdin closed, and return what it
/// printed on stdout. The child is killed at the deadline.
pub fn run_child(
    program: &str,
    args: &[String],
    env: &[(String, String)],
    cwd: &Path,
    out_file: &Path,
    timeout: Duration,
) -> Result<String, ChildError> {
    let stdout = File::create(out_file)?;
    let mut child = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .env_clear()
        .envs(env.iter().map(|(k, v)| (k, v)))
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(Stdio::null())
        .spawn()
        .map_err(|source| ChildError::Spawn {
            program: program.to_owned(),
            source,
        })?;
    let started = Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            break;
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(ChildError::Timeout(timeout.as_secs()));
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    Ok(String::from_utf8_lossy(&std::fs::read(out_file)?).into_owned())
}

/// How long to wait before retry `attempt` (1-based): 2s, then 8s.
pub fn backoff(attempt: u32) -> Duration {
    Duration::from_secs(2u64 * 4u64.pow(attempt.saturating_sub(1)))
}

/// Attempts per run: the first plus two retries.
pub const MAX_ATTEMPTS: u32 = 3;
