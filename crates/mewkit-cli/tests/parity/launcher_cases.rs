//! The committed project launcher, written by both CLIs.
//!
//! The binary's `init` writes `.meowkit/bin/mewkit` from its own copy of the
//! npm CLI's `launcherSource()`. Hooks run that file, so the copies must not
//! drift: the same version and kind must give the same bytes.
use std::process::Command;

use mewkit_adapters::claude_code::launcher;

use crate::parity;

/// The npm CLI's launcher for `version`, written as a `"native"` install.
fn ts_launcher(version: &str) -> String {
    let module = parity::repo_root().join("packages/mewkit/dist/core/project-launcher.js");
    let script = "import(require('url').pathToFileURL(process.argv[1]).href)\
        .then(m => process.stdout.write(m.launcherSource(process.argv[2], 'native')))";
    let out = Command::new("node")
        .args(["-e", script])
        .arg(&module)
        .arg(version)
        .output()
        .expect("run node");
    assert!(
        out.status.success(),
        "node failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8(out.stdout).expect("UTF-8 launcher")
}

#[test]
#[ignore = "needs node and the TS build"]
fn the_binary_writes_the_launcher_the_npm_cli_generates() {
    let Some(_) = parity::check("launcher-mirror") else {
        return;
    };
    for version in ["0.1.0", "1.2.3-beta.4"] {
        assert_eq!(
            launcher::source(version),
            ts_launcher(version),
            "the Rust launcher template drifted from launcherSource() for {version}"
        );
    }
}
