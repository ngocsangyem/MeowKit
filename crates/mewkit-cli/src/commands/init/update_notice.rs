//! One line after `init` when a newer `mewkit` binary is out.
use std::time::Duration;

use mewkit_core::kit::http::UreqHttp;
use mewkit_core::update;

/// A slow or unreachable GitHub must not hold up an install that is done.
const TIMEOUT: Duration = Duration::from_secs(2);

/// Print the notice to stderr, so stdout (and `--json`) stays parseable.
pub fn show() {
    let running = mewkit_core::VERSION;
    if let Some(latest) = update::newer_stable(&UreqHttp::with_timeout(TIMEOUT), running) {
        eprintln!(
            "note: mewkit {latest} is available ({running} installed); run `mewkit self-update`"
        );
    }
}
