//! What a `task` subcommand produced, per stream.
//!
//! Two streams and a verdict rather than a `Result`, because this verb can
//! succeed PARTLY: `task new --activate` reports the file it created on stdout
//! and can still fail at the durable activation that follows, which belongs on
//! stderr with a non-zero exit. The npm CLI prints both, in that order, and a
//! caller watching only one stream must see the same thing from either CLI.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct TaskOutput {
    pub stdout: String,
    pub stderr: String,
    /// Whether the command failed, which the caller turns into the exit code.
    pub failed: bool,
}

impl TaskOutput {
    /// A run that produced output and succeeded.
    pub fn ok(stdout: String) -> Self {
        Self {
            stdout,
            stderr: String::new(),
            failed: false,
        }
    }

    /// A refusal: nothing on stdout, the reason on stderr, exit non-zero.
    pub fn refused(stderr: String) -> Self {
        Self {
            stdout: String::new(),
            stderr,
            failed: true,
        }
    }
}
