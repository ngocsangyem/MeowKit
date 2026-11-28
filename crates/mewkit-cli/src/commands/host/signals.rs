//! How a waiting `host run` / `host jobs wait` answers signals. SIGTERM and
//! SIGHUP (an agent runtime ending the tool call) detach: the caller prints
//! the not-finished block and exits 75 while the job keeps running. SIGINT
//! from an interactive terminal is the user's Ctrl-C and cancels the job;
//! without a terminal it detaches like SIGTERM. Windows keeps the default
//! handling for now.
use std::io::IsTerminal;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mewkit_core::host::jobs::JobDir;

/// How long a cancelled job gets to stop before the caller reports it as
/// still running (the supervisor's own TERM-to-KILL grace is shorter).
pub const CANCEL_GRACE: std::time::Duration = std::time::Duration::from_secs(15);

#[derive(Default)]
pub struct Signals {
    detach: Arc<AtomicBool>,
    interrupt: Arc<AtomicBool>,
}

impl Signals {
    /// Install the handlers; a handler that cannot be installed leaves that
    /// signal's default behaviour, never an error.
    pub fn install() -> Self {
        let s = Self::default();
        #[cfg(unix)]
        {
            use signal_hook::consts::{SIGHUP, SIGINT, SIGTERM};
            use signal_hook::flag::register;
            let _ = register(SIGTERM, Arc::clone(&s.detach));
            let _ = register(SIGHUP, Arc::clone(&s.detach));
            let _ = register(SIGINT, Arc::clone(&s.interrupt));
        }
        s
    }

    /// True once any handled signal arrived: stop waiting.
    pub fn arrived(&self) -> bool {
        self.detach.load(Ordering::SeqCst) || self.interrupt.load(Ordering::SeqCst)
    }

    /// When the user pressed Ctrl-C at a terminal, ask the job to stop and
    /// return true; the caller then waits for it to end.
    pub fn cancel_if_interactive(&self, job: &JobDir) -> bool {
        if !self.interrupt.load(Ordering::SeqCst) || !std::io::stdin().is_terminal() {
            return false;
        }
        mewkit_core::fsx::atomic_write(&job.cancel(), b"1", Some(0o600)).is_ok()
    }
}
