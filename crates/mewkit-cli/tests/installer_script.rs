//! The rendered installers against a local file server: the pinned archive
//! installs; a tampered, resized or unpinned one installs nothing. `install.sh`
//! runs on Linux and macOS, `install.ps1` on Windows.
mod support;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Output;

use mewkit_core::update::manifest::current_target;
use support::release::{Server, TARGETS, archive, asset_name, node};
use support::temp_home::TempHome;
use support::{code, text};

const VERSION: &str = "9.9.9";
const BODY: &[u8] = b"pretend this is mewkit-next\n";

/// An installer pinned to `served` (stable channel), where the server sends
/// `sent` instead when it is given; returns the server and the rendered dir.
fn setup(sent: Option<Vec<u8>>) -> (Server, tempfile::TempDir) {
    let target = current_target().expect("a published target");
    let pinned = archive(VERSION, target, BODY);
    let path = format!("/dl/{}", asset_name(VERSION, target));
    let server = Server::start(HashMap::from([(
        path.clone(),
        sent.unwrap_or(pinned.clone()),
    )]));
    let sha = mewkit_core::fsx::sha256_hex(&pinned);
    let targets: serde_json::Map<String, serde_json::Value> = TARGETS
        .iter()
        .map(|t| {
            let pin = serde_json::json!({
                "url": format!("{}{path}", server.base), "sha256": sha, "size": pinned.len()
            });
            ((*t).to_owned(), pin)
        })
        .collect();
    let pins =
        serde_json::json!({ "stable": { "version": VERSION, "targets": targets }, "beta": null });
    let dir = tempfile::tempdir().unwrap();
    let pins_file = dir.path().join("pins.json");
    std::fs::write(&pins_file, pins.to_string()).unwrap();
    let out = node(
        "render-installers.mjs",
        &[
            "--pins",
            &pins_file.to_string_lossy(),
            "--out-dir",
            &dir.path().to_string_lossy(),
        ],
    );
    assert_eq!(code(&out), 0, "render: {}", text(&out));
    (server, dir)
}

fn install(env: &TempHome, rendered: &Path, dest: &Path, vars: &[(&str, &str)]) -> Output {
    let mut cmd = if cfg!(windows) {
        let mut c = env.command("pwsh");
        c.args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(rendered.join("install.ps1"));
        c
    } else {
        let mut c = env.command("sh");
        c.arg(rendered.join("install.sh"));
        c
    };
    for var in ["MEWKIT_CHANNEL", "MEWKIT_VERSION", "MEWKIT_INSTALL_DIR"] {
        cmd.env_remove(var);
    }
    cmd.env("MEWKIT_INSTALL_DIR", dest)
        .envs(vars.iter().copied());
    cmd.output().expect("run the installer")
}

fn installed(dest: &Path) -> PathBuf {
    dest.join(if cfg!(windows) {
        "mewkit-next.exe"
    } else {
        "mewkit-next"
    })
}

#[test]
fn the_pinned_archive_installs() {
    let env = TempHome::new();
    let (_server, rendered) = setup(None);
    let dest = env.home().join("bin");
    let out = install(&env, rendered.path(), &dest, &[]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(std::fs::read(installed(&dest)).unwrap(), BODY);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(installed(&dest))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o111, 0o111, "executable: {mode:o}");
    }
    assert!(text(&out).contains("not on your PATH"), "{}", text(&out));
}

#[test]
fn a_tampered_archive_installs_nothing() {
    let env = TempHome::new();
    let target = current_target().unwrap();
    let mut bytes = archive(VERSION, target, BODY);
    let last = bytes.len() - 1;
    bytes[last] ^= 0xff;
    let (_server, rendered) = setup(Some(bytes));
    let dest = env.home().join("bin");
    let out = install(&env, rendered.path(), &dest, &[]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("SHA-256 mismatch"), "{}", text(&out));
    assert!(!dest.exists(), "nothing written");
}

#[test]
fn an_archive_of_another_size_installs_nothing() {
    let env = TempHome::new();
    let target = current_target().unwrap();
    let (_server, rendered) = setup(Some(archive(VERSION, target, b"other bytes entirely")));
    let dest = env.home().join("bin");
    let out = install(&env, rendered.path(), &dest, &[]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("the pin says"), "{}", text(&out));
    assert!(!dest.exists(), "nothing written");
}

#[test]
fn another_version_or_an_unpinned_channel_is_refused_before_any_download() {
    let env = TempHome::new();
    let (server, rendered) = setup(None);
    let dest = env.home().join("bin");
    let out = install(
        &env,
        rendered.path(),
        &dest,
        &[("MEWKIT_VERSION", "v1.0.0")],
    );
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(text(&out).contains("by hand, verified"), "{}", text(&out));
    let out = install(&env, rendered.path(), &dest, &[("MEWKIT_CHANNEL", "beta")]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        text(&out).contains("pins no beta release"),
        "{}",
        text(&out)
    );
    assert_eq!(server.hits(), 0, "no request was made");
    assert!(!dest.exists());
}

#[test]
fn the_committed_installers_are_what_the_committed_pins_render() {
    let out = node("render-installers.mjs", &["--check"]);
    assert_eq!(code(&out), 0, "{}", text(&out));
}
