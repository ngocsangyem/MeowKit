//! Exit codes and the one error type commands return.
use std::fmt;

/// Everything went as asked.
pub const OK: u8 = 0;
/// Something failed; nothing was left half-applied.
pub const FAILED: u8 = 1;
/// The command line was wrong (clap uses 2 as well).
pub const USAGE: u8 = 2;
/// A dry run found changes it would make.
pub const PENDING: u8 = 3;
/// Files the user edited were kept; `--force` replaces or removes them.
pub const KEPT_EDITS: u8 = 6;

/// A failed command: what to print and how to exit.
#[derive(Debug)]
pub struct Failure {
    pub code: u8,
    pub message: String,
}

impl Failure {
    pub fn usage(message: impl Into<String>) -> Self {
        Self {
            code: USAGE,
            message: message.into(),
        }
    }

    pub fn failed(message: impl Into<String>) -> Self {
        Self {
            code: FAILED,
            message: message.into(),
        }
    }
}

impl fmt::Display for Failure {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

macro_rules! failed_from {
    ($($t:ty),*) => {$(
        impl From<$t> for Failure {
            fn from(e: $t) -> Self {
                Self::failed(e.to_string())
            }
        }
    )*};
}

failed_from!(
    std::io::Error,
    mewkit_core::kit::KitError,
    mewkit_core::exec::ExecError,
    mewkit_core::ownership::IndexError,
    mewkit_core::fsx::PathError,
    mewkit_adapters::EmitError
);
