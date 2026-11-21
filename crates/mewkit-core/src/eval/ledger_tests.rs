use super::ledger::*;

fn session(id: &str, started_ms: i64, spent_usd: f64, runs: u32, active: bool) -> Session {
    Session {
        id: id.into(),
        started_ms,
        spent_usd,
        runs,
        active,
    }
}

const NOW: i64 = 10 * 24 * 60 * 60 * 1000;

#[test]
fn concurrent_sessions_share_one_ceiling() {
    let f = LedgerFile {
        sessions: vec![
            session("a", NOW, 3.0, 4, true),
            session("b", NOW, 1.5, 2, true),
        ],
    };
    assert!(f.may_run("b", NOW, 5.0, 100, 0.5));
    assert!(!f.may_run("b", NOW, 5.0, 100, 0.6), "4.5 spent + 0.6 > 5");
}

#[test]
fn ended_and_stale_sessions_do_not_count() {
    let day = 24 * 60 * 60 * 1000;
    let f = LedgerFile {
        sessions: vec![
            session("done", NOW, 50.0, 9, false),
            session("killed", NOW - day - 1, 50.0, 9, true),
            session("me", NOW, 0.0, 0, true),
        ],
    };
    assert!(f.may_run("me", NOW, 1.0, 10, 0.5));
}

#[test]
fn the_run_cap_is_per_session() {
    let f = LedgerFile {
        sessions: vec![
            session("me", NOW, 0.0, 3, true),
            session("other", NOW, 0.0, 99, true),
        ],
    };
    assert!(!f.may_run("me", NOW, 100.0, 3, 0.0));
    assert!(f.may_run("new", NOW, 100.0, 3, 0.0));
}

#[test]
fn ledger_round_trips_through_the_file_under_its_lock() {
    let dir = tempfile::tempdir().expect("tmp");
    let a = Ledger::new(dir.path(), "a");
    let b = Ledger::new(dir.path(), "b");
    a.begin().expect("begin");
    b.begin().expect("begin");
    assert!(a.reserve(1.0, 10, 0.4).expect("reserve"));
    a.record(0.4).expect("record");
    b.record(0.4).expect("record");
    assert!(
        !a.reserve(1.0, 10, 0.4).expect("reserve"),
        "0.8 + 0.4 > 1.0"
    );
    b.end().expect("end");
    assert!(
        a.reserve(1.0, 10, 0.4).expect("reserve"),
        "b no longer counts"
    );
    let text = std::fs::read_to_string(dir.path().join("eval-ledger.json")).expect("read");
    assert!(text.contains("\"spentUsd\""), "{text}");
}

#[test]
fn a_corrupt_ledger_is_an_error_not_a_reset() {
    let dir = tempfile::tempdir().expect("tmp");
    std::fs::write(dir.path().join("eval-ledger.json"), "{not json").expect("write");
    let err = Ledger::new(dir.path(), "a").begin().expect_err("corrupt");
    assert!(matches!(err, LedgerError::Corrupt { .. }), "{err}");
}
