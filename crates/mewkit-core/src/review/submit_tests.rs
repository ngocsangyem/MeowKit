use std::cell::RefCell;
use std::path::Path;

use serde_json::{Value, json};

use super::super::exec::{Exec, ExecResult};
use super::super::test_session::{Seed, seed_session};
use super::{SubmitOptions, payload_hash, submit};

/// Records every call and answers `gh api` with a head SHA the test chooses.
struct Gh {
    calls: RefCell<Vec<Vec<String>>>,
    head: String,
}

impl Gh {
    fn with_head(head: &str) -> Self {
        Self {
            calls: RefCell::new(Vec::new()),
            head: head.to_string(),
        }
    }
    fn posted_a_review(&self) -> bool {
        self.calls
            .borrow()
            .iter()
            .any(|c| c.get(1).is_some_and(|a| a == "pr") && c.get(2).is_some_and(|a| a == "review"))
    }
}

impl Exec for Gh {
    fn run(&self, file: &str, args: &[String], _cwd: &Path) -> ExecResult {
        let mut call = vec![file.to_string()];
        call.extend_from_slice(args);
        let api = args.first().is_some_and(|a| a == "api");
        self.calls.borrow_mut().push(call);
        ExecResult {
            ok: true,
            out: if api {
                self.head.clone()
            } else {
                String::new()
            },
            err: String::new(),
        }
    }
}

fn payload() -> Value {
    json!({
        "host": "github",
        "owner": "o",
        "repo": "r",
        "pr": 7,
        "headSha": "h".repeat(40),
        "event": "APPROVE",
        "body": "x",
    })
}

fn seed_payload(session: &str, payload: &Value) -> tempfile::TempDir {
    let project = seed_session(&Seed::complete(session));
    std::fs::write(
        project
            .path()
            .join("tasks/reviews")
            .join(session)
            .join("submit-payload.json"),
        serde_json::to_string(payload).expect("serialize"),
    )
    .expect("write the payload");
    project
}

fn options<'a>(cwd: &'a Path, session: &'a str, confirm: Option<&'a str>) -> SubmitOptions<'a> {
    SubmitOptions {
        session,
        reply: true,
        confirm,
        cwd,
        now: "2026-11-13T00:00:00Z",
    }
}

#[test]
fn without_reply_nothing_can_reach_github() {
    let project = seed_payload("s1", &payload());
    let gh = Gh::with_head(&"h".repeat(40));
    let mut opts = options(project.path(), "s1", None);
    opts.reply = false;
    let result = submit(&opts, &gh);
    assert!(!result.ok);
    assert_eq!(
        result.error.as_deref(),
        Some(
            "submit requires --reply (the only GitHub write authority); without it the run is review-only"
        )
    );
    assert!(
        gh.calls.borrow().is_empty(),
        "a command ran without --reply"
    );
}

#[test]
fn without_a_confirmation_the_current_hash_is_offered_and_nothing_posts() {
    let payload = payload();
    let project = seed_payload("s2", &payload);
    let gh = Gh::with_head(&"h".repeat(40));
    let result = submit(&options(project.path(), "s2", None), &gh);
    assert!(!result.ok);
    assert_eq!(
        result.error.as_deref(),
        Some(
            format!(
                "submit requires --confirm <payload-hash> after the user approves the composed body. Current payload hash: {}",
                payload_hash(&payload)
            )
            .as_str()
        )
    );
    assert!(gh.calls.borrow().is_empty());
}

#[test]
fn a_stale_confirmation_refuses() {
    let project = seed_payload("s3", &payload());
    let gh = Gh::with_head(&"h".repeat(40));
    let result = submit(&options(project.path(), "s3", Some("deadbeef")), &gh);
    assert_eq!(
        result.error.as_deref(),
        Some(
            "confirmation does not match the current payload (stale or recomposed) — re-confirm the shown body"
        )
    );
    assert!(gh.calls.borrow().is_empty());
}

#[test]
fn a_head_that_moved_since_prepare_aborts_without_posting() {
    let payload = payload();
    let project = seed_payload("s4", &payload);
    let gh = Gh::with_head("DIFFERENTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    let hash = payload_hash(&payload);
    let result = submit(&options(project.path(), "s4", Some(&hash)), &gh);
    assert!(!result.ok);
    assert_eq!(
        result.error.as_deref(),
        Some(
            "PR head changed since prepare (reviewed hhhhhhhhhhhh, now DIFFERENTxxx) — restart the review; NOT posting"
        )
    );
    assert!(!gh.posted_a_review(), "a review was posted anyway");
}

#[test]
fn a_matching_head_and_confirmation_posts_exactly_one_review() {
    let payload = payload();
    let project = seed_payload("s5", &payload);
    let gh = Gh::with_head(&"h".repeat(40));
    let hash = payload_hash(&payload);
    let result = submit(&options(project.path(), "s5", Some(&hash)), &gh);
    assert_eq!(result.posted, Some(true));
    assert_eq!(result.payload_hash.as_deref(), Some(hash.as_str()));
    let calls = gh.calls.borrow();
    assert_eq!(calls.len(), 2, "{calls:?}");
    assert_eq!(
        calls[1],
        [
            "gh",
            "pr",
            "review",
            "7",
            "--repo",
            "o/r",
            "--approve",
            "--body",
            "x"
        ]
    );
    let marker = std::fs::read_to_string(project.path().join("tasks/reviews/s5/submitted.json"))
        .expect("the idempotency marker");
    assert!(marker.contains(&hash));
}

#[test]
fn a_retry_after_a_successful_post_is_a_no_op() {
    let payload = payload();
    let project = seed_payload("s6", &payload);
    let hash = payload_hash(&payload);
    let first = Gh::with_head(&"h".repeat(40));
    submit(&options(project.path(), "s6", Some(&hash)), &first);
    let second = Gh::with_head(&"h".repeat(40));
    let result = submit(&options(project.path(), "s6", Some(&hash)), &second);
    assert_eq!(
        (result.ok, result.posted, result.already_posted),
        (true, Some(false), Some(true))
    );
    assert!(second.calls.borrow().is_empty(), "the retry called gh");
}

#[test]
fn a_payload_that_fails_the_schema_never_posts() {
    let mut bad = payload();
    bad["pr"] = json!(0);
    let project = seed_payload("s7", &bad);
    let gh = Gh::with_head(&"h".repeat(40));
    let hash = payload_hash(&bad);
    let result = submit(&options(project.path(), "s7", Some(&hash)), &gh);
    assert!(
        result
            .error
            .as_deref()
            .is_some_and(|e| e.starts_with("submit payload failed schema:")),
        "{result:?}"
    );
    assert!(gh.calls.borrow().is_empty());
}

#[test]
fn a_missing_payload_names_the_step_that_writes_it() {
    let project = seed_session(&Seed::complete("s8"));
    let gh = Gh::with_head(&"h".repeat(40));
    let result = submit(&options(project.path(), "s8", Some("x")), &gh);
    assert_eq!(
        result.error.as_deref(),
        Some("no submit-payload.json — run 'mewkit review compose' first")
    );
}

#[test]
fn the_result_serializes_in_the_npm_key_order() {
    let payload = payload();
    let project = seed_payload("s9", &payload);
    let gh = Gh::with_head(&"h".repeat(40));
    let hash = payload_hash(&payload);
    let text = serde_json::to_string(&submit(&options(project.path(), "s9", Some(&hash)), &gh))
        .expect("serialize");
    assert_eq!(
        text,
        format!("{{\"ok\":true,\"posted\":true,\"payloadHash\":\"{hash}\"}}")
    );
}
