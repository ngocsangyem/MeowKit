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
