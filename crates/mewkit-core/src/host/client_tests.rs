//! Attaching to a live job: the same argv in the same directory of the same
//! tree attaches; the same argv in another directory starts its own job.
use std::path::Path;
use std::process::Command;

use super::client::prepare;
use super::locks;
use super::paths::HostPaths;
use super::queue::Priority;

fn git(dir: &Path, args: &[&str]) -> bool {
    Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .is_ok_and(|o| o.status.success())
}

#[test]
fn the_same_command_in_another_directory_does_not_attach() {
    let repo = tempfile::tempdir().unwrap();
    let root = repo.path().canonicalize().unwrap();
    for sub in ["a", "b"] {
        std::fs::create_dir_all(root.join(sub)).unwrap();
        std::fs::write(root.join(sub).join("f.txt"), sub).unwrap();
    }
    let committed = git(&root, &["init", "-q"])
        && git(&root, &["add", "."])
        && git(
            &root,
            &[
                "-c",
                "user.name=t",
                "-c",
                "user.email=t@t",
                "commit",
                "-qm",
                "init",
            ],
        );
    if !committed {
        eprintln!("skipped: git missing");
        return;
    }
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let argv: Vec<String> = ["cargo", "test"].iter().map(|s| (*s).to_string()).collect();

    let first = prepare(&paths, &argv, &root.join("a"), Priority::Normal).unwrap();
    assert!(!first.attached);
    // A held alive lock is what makes the job live, as its supervisor would.
    let _alive = locks::try_hold(&first.job.alive()).unwrap().expect("lock");
    drop(first.key_lock);

    let same = prepare(&paths, &argv, &root.join("a"), Priority::Normal).unwrap();
    assert!(same.attached, "same command, same directory attaches");
    assert_eq!(same.job.id, first.job.id);

    let other = prepare(&paths, &argv, &root.join("b"), Priority::Normal).unwrap();
    assert!(
        !other.attached,
        "same argv in another member must not attach"
    );
    assert_ne!(other.job.id, first.job.id);
}

#[test]
fn another_environment_is_another_command_but_volatile_variables_are_not() {
    use super::client::env_hash;
    let vars = |pairs: &[(&str, &str)]| -> Vec<(std::ffi::OsString, std::ffi::OsString)> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).into(), (*v).into()))
            .collect()
    };
    let base = env_hash(vars(&[("PATH", "/bin"), ("GOOS", "linux")]).into_iter());
    let other = env_hash(vars(&[("PATH", "/bin"), ("GOOS", "darwin")]).into_iter());
    let noisy = env_hash(
        vars(&[
            ("GOOS", "linux"),
            ("PWD", "/x"),
            ("SHLVL", "3"),
            ("PATH", "/bin"),
            ("CLAUDE_CODE_SESSION_ID", "s1"),
            ("CLAUDE_PID", "42"),
            ("TMPDIR", "/w/.tmp/agent-a"),
            ("POSH_SESSION_ID", "p"),
            ("SSH_AUTH_SOCK", "/tmp/sock"),
        ])
        .into_iter(),
    );
    assert_ne!(base, other, "GOOS changes the build");
    assert_eq!(base, noisy, "order and per-session variables do not");
}

#[test]
fn concurrent_callers_of_one_command_make_one_job() {
    let repo = tempfile::tempdir().unwrap();
    let root = repo.path().canonicalize().unwrap();
    std::fs::write(root.join("f.txt"), "x").unwrap();
    let ok = git(&root, &["init", "-q"])
        && git(&root, &["add", "."])
        && git(
            &root,
            &[
                "-c",
                "user.name=t",
                "-c",
                "user.email=t@t",
                "commit",
                "-qm",
                "c",
            ],
        );
    if !ok {
        eprintln!("skipped: git missing");
        return;
    }
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    let callers: Vec<_> = (0..3)
        .map(|_| {
            let (paths, root) = (paths.clone(), root.clone());
            std::thread::spawn(move || {
                let argv = vec!["cargo".to_string(), "test".into()];
                let p = prepare(&paths, &argv, &root, Priority::Normal).unwrap();
                // Stand in for the supervisor: take the job, then let the
                // next caller look. Keep it live until every caller is done.
                let alive = if p.attached {
                    None
                } else {
                    locks::try_hold(&p.job.alive()).unwrap()
                };
                drop(p.key_lock);
                std::thread::sleep(std::time::Duration::from_millis(300));
                drop(alive);
                p.job.id
            })
        })
        .collect();
    let mut ids: Vec<String> = callers.into_iter().map(|c| c.join().unwrap()).collect();
    ids.dedup();
    assert_eq!(ids.len(), 1, "{ids:?}");
}
