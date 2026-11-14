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
const BODY: &[u8] = b"pretend this is mewkit\n";

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

/// Far longer than `BODY`, so its archive cannot land on the pinned size by chance (gzip
/// sizes of two short bodies can coincide).
const OTHER_BODY: &[u8] =
    b"other bytes entirely: a body several times the length of the real one, \
so the compressed archive is certainly a different size from the pinned archive";

/// The installer's output with whitespace folded: PowerShell wraps an error at the console
/// width and prefixes each continuation line with `|`, so a phrase can straddle a break.
fn said(out: &Output) -> String {
    text(out)
        .split_whitespace()
        .filter(|w| *w != "|")
        .collect::<Vec<_>>()
        .join(" ")
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
    named(dest, "mewkit")
}

fn named(dest: &Path, name: &str) -> PathBuf {
    dest.join(format!("{name}{}", std::env::consts::EXE_SUFFIX))
}

#[test]
fn the_pinned_archive_installs() {
    let env = TempHome::new();
    let (_server, rendered) = setup(None);
    let dest = env.home().join("bin");
    let out = install(&env, rendered.path(), &dest, &[]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(std::fs::read(installed(&dest)).unwrap(), BODY);
    // `mk` and the pre-rename `mewkit-next` run the same binary: a link on Unix, a copy
    // on Windows. Reading through either yields the installed bytes.
    for alias in ["mk", "mewkit-next"] {
        assert_eq!(std::fs::read(named(&dest, alias)).unwrap(), BODY, "{alias}");
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(installed(&dest))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o111, 0o111, "executable: {mode:o}");
    }
    assert!(said(&out).contains("not on your PATH"), "{}", text(&out));
}

/// `mk` is short enough that another tool may own it: the installer must not clobber it.
#[cfg(unix)]
#[test]
fn an_mk_owned_by_another_tool_is_left_alone() {
    use std::os::unix::fs::PermissionsExt;
    let env = TempHome::new();
    let (_server, rendered) = setup(None);
    let dest = env.home().join("bin");
    std::fs::create_dir_all(&dest).unwrap();
    let foreign = b"#!/bin/sh\necho 'mk 4.2 (some other tool)'\n";
    std::fs::write(dest.join("mk"), foreign).unwrap();
    std::fs::set_permissions(dest.join("mk"), std::fs::Permissions::from_mode(0o755)).unwrap();
    let out = install(&env, rendered.path(), &dest, &[]);
    assert_eq!(code(&out), 0, "{}", text(&out));
    assert_eq!(std::fs::read(dest.join("mk")).unwrap(), foreign);
    assert!(
        said(&out).contains("is not mewkit; left as it is"),
        "{}",
        text(&out)
    );
    assert_eq!(std::fs::read(named(&dest, "mewkit-next")).unwrap(), BODY);
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
    assert!(said(&out).contains("SHA-256 mismatch"), "{}", text(&out));
    assert!(!dest.exists(), "nothing written");
}

#[test]
fn an_archive_of_another_size_installs_nothing() {
    let env = TempHome::new();
    let target = current_target().unwrap();
    let (_server, rendered) = setup(Some(archive(VERSION, target, OTHER_BODY)));
    let dest = env.home().join("bin");
    let out = install(&env, rendered.path(), &dest, &[]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(said(&out).contains("the pin says"), "{}", text(&out));
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
    assert!(said(&out).contains("by hand, verified"), "{}", text(&out));
    let out = install(&env, rendered.path(), &dest, &[("MEWKIT_CHANNEL", "beta")]);
    assert_eq!(code(&out), 1, "{}", text(&out));
    assert!(
        said(&out).contains("pins no beta release"),
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
