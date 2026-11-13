use std::path::Path;

use super::super::test_session::{DIFF, Seed, seed_session};
use super::{ReadOptions, ReadRefusal, ReadTarget, read};

/// The refusal text, whichever shape it took.
fn message_of(refusal: ReadRefusal) -> String {
    match refusal {
        ReadRefusal::Message(text) | ReadRefusal::Fatal(text) => text,
    }
}

fn options<'a>(cwd: &'a Path, session: &'a str, target: &'a str) -> ReadOptions<'a> {
    ReadOptions {
        session: Some(session),
        reviewer: Some("security"),
        target: ReadTarget::Text(target),
        cwd,
        now: "2026-11-13T00:00:00Z",
    }
}

#[test]
fn an_assigned_artifact_is_printed_and_receipted() {
    let project = seed_session(&Seed::complete("s1"));
    let outcome = read(&options(project.path(), "s1", "diff.patch")).expect("the diff reads");
    assert_eq!(outcome.content, DIFF);
    assert_eq!(outcome.logged_target, "diff.patch");
    assert_eq!(outcome.evidence_error, None);
    let log = std::fs::read_to_string(project.path().join("tasks/reviews/s1/evidence.jsonl"))
        .expect("read the receipts");
    assert!(
        log.ends_with(
            "{\"session\":\"s1\",\"kind\":\"read\",\"target\":\"diff.patch\",\
         \"at\":\"2026-11-13T00:00:00Z\",\"reviewer\":\"security\",\"source\":\"cli\"}\n"
        ),
        "{log}"
    );
}

#[test]
fn an_id_that_could_escape_a_path_is_refused() {
    let project = seed_session(&Seed::complete("s2"));
    for session in ["", "../x", "x/../y", ".hidden"] {
        assert_eq!(
            read(&options(project.path(), session, "diff.patch")).unwrap_err(),
            ReadRefusal::Message(format!("invalid --session \"{session}\""))
        );
    }
    let mut bad_reviewer = options(project.path(), "s2", "diff.patch");
    bad_reviewer.reviewer = Some("../root");
    assert_eq!(
        read(&bad_reviewer).unwrap_err(),
        ReadRefusal::Message("invalid --as reviewer id \"../root\"".into())
    );
}

#[test]
fn an_absent_flag_is_quoted_as_undefined_and_never_looked_up() {
    let project = seed_session(&Seed::complete("s9"));
    // "undefined" is a VALID id: a session directory could be named that, and
    // an absent flag must not be resolved to it.
    let mut absent = options(project.path(), "s9", "diff.patch");
    absent.session = None;
    assert_eq!(
        read(&absent).unwrap_err(),
        ReadRefusal::Message("invalid --session \"undefined\"".into())
    );
    let mut absent = options(project.path(), "s9", "diff.patch");
    absent.reviewer = None;
    assert_eq!(
        read(&absent).unwrap_err(),
        ReadRefusal::Message("invalid --as reviewer id \"undefined\"".into())
    );
}

#[test]
fn a_read_outside_both_roots_is_refused() {
    let project = seed_session(&Seed::complete("s3"));
    std::fs::write(project.path().join("secret.txt"), "top secret").expect("write a sibling file");
    let error =
        message_of(read(&options(project.path(), "s3", "../../../secret.txt")).unwrap_err());
    assert!(
        error.starts_with("\"../../../secret.txt\" not found inside the session dir"),
        "{error}"
    );
    assert_eq!(
        read(&options(project.path(), "s3", "")).unwrap_err(),
        ReadRefusal::Message("a <path> to read is required".into())
    );
}

#[cfg(unix)]
#[test]
fn a_symlink_may_not_carry_a_read_out_of_its_root() {
    let project = seed_session(&Seed::complete("s4"));
    std::fs::write(project.path().join("secret.txt"), "top secret").expect("write a sibling file");
    std::os::unix::fs::symlink(
        project.path().join("secret.txt"),
        project.path().join("tasks/reviews/s4/escape.txt"),
    )
    .expect("create the symlink");
    // Lexically the link IS inside the session dir; only resolving it rejects.
    let error = message_of(read(&options(project.path(), "s4", "escape.txt")).unwrap_err());
    assert!(error.contains("symlinks may not escape them"), "{error}");
}

#[test]
fn a_missing_session_is_named_relative_to_the_invocation_directory() {
    let project = tempfile::tempdir().expect("a temp dir");
    assert_eq!(
        read(&options(project.path(), "ghost", "diff.patch")).unwrap_err(),
        ReadRefusal::Message(format!(
            "no review session at {}",
            ["tasks", "reviews", "ghost"].join(std::path::MAIN_SEPARATOR_STR)
        ))
    );
}

#[test]
fn a_directory_is_not_a_readable_artifact() {
    let project = seed_session(&Seed::complete("s5"));
    let error = message_of(read(&options(project.path(), "s5", "briefs")).unwrap_err());
    assert!(error.starts_with("\"briefs\" not found inside"), "{error}");
}

#[test]
fn a_numeric_positional_dies_in_the_path_api_but_only_after_the_session_is_found() {
    let project = seed_session(&Seed::complete("s10"));
    let mut numeric = options(project.path(), "s10", "");
    numeric.target = ReadTarget::Number(123.0);
    assert_eq!(
        read(&numeric).unwrap_err(),
        ReadRefusal::Fatal(
            "The \"paths[1]\" argument must be of type string. Received type number (123)".into()
        )
    );
    // Zero is falsy, so it never reaches the path API.
    numeric.target = ReadTarget::Number(0.0);
    assert_eq!(
        read(&numeric).unwrap_err(),
        ReadRefusal::Message("a <path> to read is required".into())
    );
    // A session that does not exist is reported BEFORE the crash.
    let mut missing = options(project.path(), "ghost", "");
    missing.target = ReadTarget::Number(123.0);
    assert!(matches!(
        read(&missing).unwrap_err(),
        ReadRefusal::Message(_)
    ));
}
