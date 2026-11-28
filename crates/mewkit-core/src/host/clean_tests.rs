//! Tier 1 cleanup stays inside the host directory, never follows a symlink,
//! never runs outside a `clean` verdict and logs every action.
use super::clean::{self, Item};
use super::jobs::{JobDir, Meta};
use super::model::Verdict;
use super::paths::HostPaths;
use super::time_now_ms;

const LATER: i64 = 3 * 24 * 3600 * 1000;

fn ended_job(paths: &HostPaths, id: &str) -> JobDir {
    let job = JobDir::new(paths, id);
    super::paths::create_private_dir(&job.dir).unwrap();
    job.write_meta(&Meta {
        id: id.into(),
        ..Meta::default()
    })
    .unwrap();
    std::fs::write(job.exit(), "0").unwrap();
    std::fs::write(job.log(), "output").unwrap();
    job
}

fn setup() -> (tempfile::TempDir, HostPaths) {
    let home = tempfile::tempdir().unwrap();
    let paths = HostPaths::under_home(home.path());
    paths.ensure().unwrap();
    std::fs::write(paths.stats(), "{\"runs\":1}").unwrap();
    (home, paths)
}

#[test]
fn ended_jobs_dead_tickets_and_rotated_logs_go_and_are_logged() {
    let (_home, paths) = setup();
    let job = ended_job(&paths, "a");
    super::paths::create_private_dir(&paths.dir("queue")).unwrap();
    std::fs::write(paths.dir("queue").join("000000000001.json"), "{}").unwrap();
    std::fs::write(paths.dir("watch.1"), "old log").unwrap();
    let items = clean::plan(&paths, time_now_ms() + LATER);
    let kinds: Vec<&str> = items.iter().map(|i| i.kind).collect();
    assert!(
        kinds.contains(&"job") && kinds.contains(&"ticket") && kinds.contains(&"rotated-log"),
        "{kinds:?}"
    );
    if !clean::REMOVES {
        // Report-only where owners cannot be checked: nothing goes.
        assert_eq!(clean::execute(&paths, &items), 0);
        assert!(job.dir.exists());
        return;
    }
    assert_eq!(clean::execute(&paths, &items), items.len());
    assert!(!job.dir.exists());
    assert!(paths.stats().exists() && paths.version().exists());
    let log = std::fs::read_to_string(paths.dir("clean.log")).unwrap();
    assert_eq!(
        log.lines().filter(|l| l.contains(" removed ")).count(),
        items.len()
    );
}

#[test]
fn a_symlink_inside_an_item_aborts_it_and_the_target_survives() {
    let (_home, paths) = setup();
    let outside = tempfile::tempdir().unwrap();
    let precious = outside.path().join("precious");
    std::fs::write(&precious, "keep").unwrap();
    let job = ended_job(&paths, "b");
    #[cfg(unix)]
    std::os::unix::fs::symlink(&precious, job.dir.join("link")).unwrap();
    #[cfg(windows)]
    if std::os::windows::fs::symlink_file(&precious, job.dir.join("link")).is_err() {
        return; // symlinks need a privilege on Windows
    }
    let items = clean::plan(&paths, time_now_ms() + LATER);
    assert_eq!(clean::execute(&paths, &items), 0);
    assert!(job.dir.exists());
    assert_eq!(std::fs::read_to_string(&precious).unwrap(), "keep");
    assert!(
        !clean::REMOVES
            || std::fs::read_to_string(paths.dir("clean.log"))
                .unwrap()
                .contains("skipped job")
    );
}

#[test]
fn paths_outside_the_allowlist_and_protected_files_are_refused() {
    let (_home, paths) = setup();
    let outside = tempfile::tempdir().unwrap();
    let file = outside.path().join("x");
    std::fs::write(&file, "x").unwrap();
    for path in [
        file.clone(),
        paths.stats(),
        paths.version(),
        paths.root.join("../host/stats.json"),
        paths.root.clone(),
    ] {
        let it = Item {
            path: path.clone(),
            bytes: 0,
            kind: "test",
        };
        assert!(clean::remove(&paths, &it).is_err(), "{}", path.display());
    }
    assert!(file.exists() && paths.stats().exists());
}

#[test]
fn automatic_runs_only_under_clean_when_enabled_and_after_the_cooldown() {
    let (_home, paths) = setup();
    std::fs::write(paths.dir("watch.1"), "old").unwrap();
    let now = time_now_ms();
    assert_eq!(clean::run_auto(&paths, Verdict::Hold, true, now), None);
    assert_eq!(clean::run_auto(&paths, Verdict::Go, true, now), None);
    assert_eq!(clean::run_auto(&paths, Verdict::Clean, false, now), None);
    assert!(paths.dir("watch.1").exists());
    let one = usize::from(clean::REMOVES);
    assert_eq!(
        clean::run_auto(&paths, Verdict::Clean, true, now),
        Some(one)
    );
    std::fs::write(paths.dir("watch.1"), "old").unwrap();
    assert_eq!(
        clean::run_auto(&paths, Verdict::Clean, true, now + 1_000),
        None,
        "cooldown"
    );
    assert_eq!(
        clean::run_auto(&paths, Verdict::Clean, true, now + clean::COOLDOWN_MS),
        Some(one)
    );
    assert!(paths.stats().exists());
}
