use super::*;

#[test]
fn the_published_lock_file_carries_the_cross_language_shape() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("telemetry/.trace-log.lock");
    let held = SidecarLock::acquire(&path).unwrap();
    let content = fs::read_to_string(&path).unwrap();
    let mut lines = content.split('\n');
    assert_eq!(
        lines.next().unwrap().parse::<u32>().unwrap(),
        std::process::id()
    );
    let stamp: i64 = lines.next().unwrap().parse().unwrap();
    assert!((now_millis() - stamp).abs() < 60_000, "stamp {stamp}");
    assert_eq!(lines.next(), Some(""), "content must end with a newline");
    drop(held);
    assert!(!path.exists(), "the lock is released on drop");
}

#[test]
fn a_fresh_lock_is_not_reclaimable_and_a_stale_one_is() {
    let now = now_millis();
    assert!(!is_reclaimable(&format!("4242\n{now}\n")));
    assert!(is_reclaimable(&format!(
        "4242\n{}\n",
        now - STALE_MS - 1_000
    )));
}

/// A half-written lock reads as `""` for a moment, and treating that as
/// reclaimable let a waiter take a lock a live process held.
#[test]
fn an_unreadable_lock_counts_as_held() {
    for content in ["", "\n", "not a lock", "4242\n", "4242\nlater\n"] {
        assert!(!is_reclaimable(content), "content {content:?}");
    }
}

#[test]
fn a_stale_lock_is_taken_over() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(".trace-log.lock");
    let stale = now_millis() - STALE_MS - 1_000;
    fs::write(&path, format!("4242\n{stale}\n")).unwrap();
    let held = SidecarLock::acquire(&path).unwrap();
    let content = fs::read_to_string(&path).unwrap();
    assert!(
        content.starts_with(&format!("{}\n", std::process::id())),
        "the reclaimed lock names this process: {content:?}"
    );
    drop(held);
}

/// Mutual exclusion, and the one cost of dropping the dead-PID rule: a lock
/// another (live or recently-crashed) process holds is waited on, then refused.
#[test]
fn a_held_lock_is_refused_after_the_timeout() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(".trace-log.lock");
    let _held = SidecarLock::acquire(&path).unwrap();
    // The timeout is 10s of real waiting, so the refusal is proved through the
    // predicate the loop consults rather than by spending it here.
    assert!(!is_reclaimable(&fs::read_to_string(&path).unwrap()));
    assert!(!publish(&path).unwrap(), "a second publish cannot win");
}

#[test]
fn scratch_names_stay_in_the_lock_directory() {
    let scratch = sibling(Path::new("/tmp/x/.trace-log.lock"), "7.1.pub");
    assert_eq!(scratch.parent(), Some(Path::new("/tmp/x")));
    assert_eq!(
        scratch.file_name().unwrap(),
        ".trace-log.lock.7.1.pub",
        "the suffix is appended to the whole lock name"
    );
}
