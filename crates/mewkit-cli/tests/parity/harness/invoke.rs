//! Running the two CLIs under the same conditions.
//!
//! "The same conditions" is most of the value here: an inherited `MEOWKIT_*`
//! variable, a developer's real `HOME`, or a `FORCE_COLOR` from the invoking
//! terminal would each make one side differ for a reason that has nothing to do
//! with the port.
use std::io::Write;
use std::path::Path;
use std::process::{Command, Stdio};

use super::prerequisites::Prerequisites;

/// Prefixes of variables that could steer a run, stripped from both CLIs.
const STRIPPED_PREFIXES: [&str; 3] = ["MEOWKIT_", "MEOW_", "MK_"];

/// Variables that change how output is RENDERED or where state lands. Each is
/// removed so the invoking terminal cannot decide a comparison.
const STRIPPED_VARS: [&str; 7] = [
    "FORCE_COLOR",
    "NO_COLOR",
    "CLICOLOR",
    "CLICOLOR_FORCE",
    "CLAUDE_PROJECT_DIR",
    "CLAUDE_CONFIG_DIR",
    "CODEX_HOME",
];

pub struct Run {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

impl Run {
    pub fn describe(&self) -> String {
        format!(
            "exit {}\nstdout:\n{}\nstderr:\n{}",
            self.code, self.stdout, self.stderr
        )
    }
}

fn command(program: &str, project: &Path, home: &Path, env: &[(String, String)]) -> Command {
    assert!(
        home.starts_with(std::env::temp_dir())
            || home.canonicalize().is_ok_and(
                |h| h.starts_with(std::env::temp_dir().canonicalize().unwrap_or_default())
            ),
        "refusing to run: HOME {} is not under the temp dir",
        home.display()
    );
    let mut cmd = Command::new(program);
    for (key, _) in std::env::vars_os() {
        let name = key.to_string_lossy();
        if STRIPPED_PREFIXES.iter().any(|p| name.starts_with(p)) {
            cmd.env_remove(&key);
        }
    }
    for var in STRIPPED_VARS {
        cmd.env_remove(var);
    }
    // The npm CLI colours its errors whenever `CI` is set, even without a TTY;
    // this CLI never colours. NO_COLOR wins over CI, so both print plain text.
    cmd.env_remove("FORCE_COLOR").env("NO_COLOR", "1");
    cmd.current_dir(project)
        .env("HOME", home)
        .env("USERPROFILE", home);
    for (key, value) in env {
        cmd.env(key, value);
    }
    cmd
}

/// Run the command, optionally piping `stdin` into it.
///
/// `None` means an EMPTY stdin, not an inherited one: a command that reads
/// stdin (`note` takes its entry there) must see the same thing on both sides,
/// and a terminal attached to the test runner is not reproducible.
fn finish(mut cmd: Command, what: &str, stdin: Option<&str>) -> Run {
    let Some(text) = stdin else {
        let out = cmd.output().unwrap_or_else(|e| panic!("spawn {what}: {e}"));
        return Run {
            code: out.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
        };
    };
    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap_or_else(|e| panic!("spawn {what}: {e}"));
    child
        .stdin
        .take()
        .expect("a piped stdin")
        .write_all(text.as_bytes())
        .unwrap_or_else(|e| panic!("write the entry to {what}: {e}"));
    let out = child
        .wait_with_output()
        .unwrap_or_else(|e| panic!("wait for {what}: {e}"));
    Run {
        code: out.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&out.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&out.stderr).into_owned(),
    }
}

/// The npm CLI, run the way a user runs it: `node dist/index.js <args>`.
pub fn run_node(
    prerequisites: &Prerequisites,
    project: &Path,
    home: &Path,
    args: &[&str],
    env: &[(String, String)],
    stdin: Option<&str>,
) -> Run {
    let mut cmd = command("node", project, home, env);
    cmd.arg(&prerequisites.ts_cli).args(args);
    finish(cmd, "the npm CLI under node", stdin)
}

/// The binary built for this test run.
pub fn run_rust(
    project: &Path,
    home: &Path,
    args: &[&str],
    env: &[(String, String)],
    stdin: Option<&str>,
) -> Run {
    let mut cmd = command(env!("CARGO_BIN_EXE_mewkit-next"), project, home, env);
    cmd.args(args);
    finish(cmd, "mewkit-next", stdin)
}
