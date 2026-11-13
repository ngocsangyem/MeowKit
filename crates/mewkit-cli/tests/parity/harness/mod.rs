//! The parity case: build it, run it, and let it assert.
//!
//! The surface is wider than today's cases use, on purpose: the next verbs
//! (`note`, `task`, `task-state`, `plan`, `validate`) are ported against this
//! same harness, and a porter who has to reach into a private module to write a
//! case will write a second harness instead. Hence the two allows — the API is
//! for every porter, not only for the cases that exist now.
#![allow(dead_code, unused_imports)]

mod compare;
mod fixture;
mod invoke;
mod normalise;
mod prerequisites;

pub use fixture::{Tree, copy_fixture, snapshot};
pub use invoke::{Run, run_node, run_rust};
pub use normalise::Normaliser;
pub use prerequisites::{Prerequisites, check, repo_root};

/// One declared difference between the two CLIs, with the reason it is allowed.
struct Allowance {
    reason: &'static str,
    kind: AllowanceKind,
}

enum AllowanceKind {
    /// Replace every match of a pattern on BOTH sides before comparing.
    Redact {
        pattern: regex::Regex,
        replacement: String,
    },
    IgnoreStdout,
    IgnoreStderr,
}

/// A parity case under construction.
pub struct Case {
    name: &'static str,
    fixture: Option<&'static str>,
    args: Vec<String>,
    env: Vec<(String, String)>,
    stdin: Option<String>,
    expected_writes: Vec<String>,
    allowances: Vec<Allowance>,
}

/// Start a case. The name appears in every failure message, so make it say
/// which behaviour is being compared.
pub fn case(name: &'static str) -> Case {
    Case {
        name,
        fixture: None,
        args: Vec::new(),
        env: Vec::new(),
        stdin: None,
        expected_writes: Vec::new(),
        allowances: Vec::new(),
    }
}

impl Case {
    /// The fixture directory under `tests/parity/fixtures/` to copy into both
    /// projects. Omit it for a case that needs an empty project.
    pub fn fixture(mut self, name: &'static str) -> Self {
        self.fixture = Some(name);
        self
    }

    /// The arguments after the program name, for both CLIs.
    pub fn args(mut self, args: &[&str]) -> Self {
        self.args = args.iter().map(|a| (*a).to_string()).collect();
        self
    }

    /// One environment variable, applied to both CLIs. Everything the harness
    /// does not set is stripped or fixed, so a case that depends on the
    /// environment has to say so here.
    pub fn env(mut self, key: &str, value: &str) -> Self {
        self.env.push((key.to_string(), value.to_string()));
        self
    }

    /// Text piped to both CLIs on stdin. Omit it for a command that reads
    /// none — stdin is then EMPTY on both sides rather than inherited, so a
    /// command that reads it cannot block on the test runner's terminal.
    pub fn stdin(mut self, text: &str) -> Self {
        self.stdin = Some(text.to_string());
        self
    }

    /// Paths (relative to the project) both CLIs must have written.
    ///
    /// The tree comparison alone cannot tell "both wrote the same file" from
    /// "neither wrote anything": a write-path case that regresses to writing
    /// NOTHING on both sides would pass it. This is how such a case states what
    /// it is actually about.
    pub fn writes(mut self, paths: &[&str]) -> Self {
        self.expected_writes = paths.iter().map(|p| (*p).to_string()).collect();
        self
    }

    /// Declare a value the two engines cannot be expected to agree on, with the
    /// reason. Applied to both sides' output and written files before the
    /// comparison. A pattern that matches NOTHING fails the case: an allowance
    /// must not outlive the difference it was written for.
    pub fn redact(mut self, pattern: &str, replacement: &str, reason: &'static str) -> Self {
        self.allowances.push(Allowance {
            reason,
            kind: AllowanceKind::Redact {
                pattern: regex::Regex::new(pattern).expect("a valid redaction pattern"),
                replacement: replacement.to_string(),
            },
        });
        self
    }

    /// Declare that stdout is NOT compared, with the reason. The exit code,
    /// stderr and the file tree still are.
    pub fn ignore_stdout(mut self, reason: &'static str) -> Self {
        self.allowances.push(Allowance {
            reason,
            kind: AllowanceKind::IgnoreStdout,
        });
        self
    }

    /// Declare that stderr is NOT compared, with the reason.
    pub fn ignore_stderr(mut self, reason: &'static str) -> Self {
        self.allowances.push(Allowance {
            reason,
            kind: AllowanceKind::IgnoreStderr,
        });
        self
    }

    /// Run both CLIs and assert they agree. Panics with the first disagreement
    /// and both sides' output.
    ///
    /// Returns the two runs, so a case can additionally assert something about
    /// the agreed-upon output (that an exit code is the documented one, say).
    pub fn run(self) -> Option<(Run, Run)> {
        let prerequisites = check(self.name)?;
        let scratch = tempfile::Builder::new()
            .prefix("mewkit-parity-")
            .tempdir()
            .expect("create the parity scratch dir");
        let home = scratch.path().join("home");
        let ts_project = scratch.path().join("ts");
        let rust_project = scratch.path().join("rust");
        for dir in [&home, &ts_project, &rust_project] {
            std::fs::create_dir_all(dir).expect("create a parity directory");
        }
        if let Some(fixture) = self.fixture {
            copy_fixture(fixture, &ts_project);
            copy_fixture(fixture, &rust_project);
        }

        let args: Vec<&str> = self.args.iter().map(String::as_str).collect();
        let stdin = self.stdin.as_deref();
        let ts = run_node(&prerequisites, &ts_project, &home, &args, &self.env, stdin);
        let rust = run_rust(&rust_project, &home, &args, &self.env, stdin);

        let mut normaliser = Normaliser::new(&ts_project, &rust_project, scratch.path());
        for allowance in &self.allowances {
            if let AllowanceKind::Redact {
                pattern,
                replacement,
            } = &allowance.kind
            {
                normaliser.declare(pattern.clone(), replacement.clone(), allowance.reason);
            }
        }
        self.compare(&mut normaliser, &ts, &rust, &ts_project, &rust_project);
        Some((ts, rust))
    }
}
