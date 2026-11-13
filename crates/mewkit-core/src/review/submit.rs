//! `review submit` — the ONLY path in this pipeline that writes to GitHub.
//!
//! Four mechanical guards, in this order, each of which refuses BEFORE any
//! network call:
//!
//! 1. `--reply` is the sole write authority; without it the run is review-only.
//! 2. A confirmation token bound to the CURRENT payload hash is required, so a
//!    body that was recomposed after the human saw it cannot be posted.
//! 3. The pull request's head SHA is re-fetched; a change since prepare aborts
//!    without posting, because the review describes a revision that is no
//!    longer there.
//! 4. An idempotency marker keeps a retry from posting twice.
//!
//! ## What the token does and does not prove
//!
//! It proves the confirmation is bound to THIS exact payload. It cannot prove a
//! human rather than the agent produced it — host-authenticated approval is the
//! same unsolved problem as Gate 2's, and nothing here should be read as
//! approval evidence. The re-fetch→post window is a documented small TOCTOU,
//! narrowed rather than eliminated.
use std::path::Path;

use serde::Serialize;
use serde_json::{Value, json};

use super::exec::{Exec, argv};
use super::session::{read_json, session_dir, str_field};
use crate::fsx::sha256_hex;
use crate::schema::review_session::SubmitPayload;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub posted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub already_posted: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload_hash: Option<String>,
}

impl SubmitResult {
    fn bail(error: String) -> Self {
        Self {
            ok: false,
            error: Some(error),
            posted: None,
            already_posted: None,
            payload_hash: None,
        }
    }
}

pub struct SubmitOptions<'a> {
    pub session: &'a str,
    pub reply: bool,
    pub confirm: Option<&'a str>,
    pub cwd: &'a Path,
    pub now: &'a str,
}

fn event_flag(event: &str) -> Option<&'static str> {
    match event {
        "APPROVE" => Some("--approve"),
        "REQUEST_CHANGES" => Some("--request-changes"),
        "COMMENT" => Some("--comment"),
        _ => None,
    }
}

pub fn submit(options: &SubmitOptions<'_>, exec: &dyn Exec) -> SubmitResult {
    let dir = session_dir(options.cwd, options.session);

    // 1. Without --reply nothing may reach the host — checked before the
    //    payload is even read, so a review-only run cannot touch the network.
    if !options.reply {
        return SubmitResult::bail(
            "submit requires --reply (the only GitHub write authority); without it the run is review-only".to_string(),
        );
    }

    let payload_path = dir.join("submit-payload.json");
    if !payload_path.exists() {
        return SubmitResult::bail(
            "no submit-payload.json — run 'mewkit review compose' first".to_string(),
        );
    }
    let Some(payload) = read_json(&payload_path) else {
        return SubmitResult::bail("submit payload failed schema: invalid JSON".to_string());
    };
    if let Err(errors) = SubmitPayload::parse(&payload) {
        return SubmitResult::bail(format!(
            "submit payload failed schema: {}",
            errors.join("; ")
        ));
    }
    let hash = payload_hash(&payload);

    // 2. The confirmation is bound to THIS payload, not to the session.
    let Some(confirm) = options.confirm.filter(|c| !c.is_empty()) else {
        return SubmitResult::bail(format!(
            "submit requires --confirm <payload-hash> after the user approves the composed body. Current payload hash: {hash}"
        ));
    };
    if confirm != hash {
        return SubmitResult::bail(
            "confirmation does not match the current payload (stale or recomposed) — re-confirm the shown body".to_string(),
        );
    }

    // 3. Idempotency: a retry after a successful post is a no-op, not a second
    //    review on the pull request.
    let marker = dir.join("submitted.json");
    if let Some(recorded) = read_json(&marker)
        && str_field(&recorded, "payloadHash") == hash
    {
        return SubmitResult {
            ok: true,
            error: None,
            posted: Some(false),
            already_posted: Some(true),
            payload_hash: Some(hash),
        };
    }

    let owner = str_field(&payload, "owner").to_string();
    let repo = str_field(&payload, "repo").to_string();
    let pr = crate::js_value::js_string(payload.get("pr").unwrap_or(&Value::Null));
    let head_sha = str_field(&payload, "headSha").to_string();

    // 4. Re-fetch the head. A moved head means the review was written against
    //    code that is no longer proposed.
    let head = exec.run(
        "gh",
        &argv(&[
            "api",
            &format!("repos/{owner}/{repo}/pulls/{pr}"),
            "--jq",
            ".head.sha",
        ]),
        options.cwd,
    );
    if !head.ok {
        return SubmitResult::bail(format!("could not re-fetch PR head SHA: {}", head.err));
    }
    let current = head.out.trim();
    if current != head_sha {
        return SubmitResult::bail(format!(
            "PR head changed since prepare (reviewed {}, now {}) — restart the review; NOT posting",
            slice12(&head_sha),
            slice12(current)
        ));
    }

    let event = str_field(&payload, "event").to_string();
    let Some(flag) = event_flag(&event) else {
        return SubmitResult::bail(format!("unknown review event: {event}"));
    };
    let body = str_field(&payload, "body").to_string();
    let posted = exec.run(
        "gh",
        &argv(&[
            "pr",
            "review",
            &pr,
            "--repo",
            &format!("{owner}/{repo}"),
            flag,
            "--body",
            &body,
        ]),
        options.cwd,
    );
    if !posted.ok {
        return SubmitResult::bail(format!("gh pr review failed: {}", posted.err));
    }

    let record = json!({
        "payloadHash": hash,
        "headSha": head_sha,
        "event": event,
        "at": options.now,
    });
    if let Err(e) = super::session::write_json_pretty(&marker, &record) {
        return SubmitResult::bail(e.to_string());
    }
    SubmitResult {
        ok: true,
        error: None,
        posted: Some(true),
        already_posted: None,
        payload_hash: Some(hash),
    }
}

/// The payload's identity: a hash of its COMPACT JSON, with the key order the
/// file was written in — the same bytes `JSON.stringify` would produce.
pub fn payload_hash(payload: &Value) -> String {
    sha256_hex(
        serde_json::to_string(payload)
            .unwrap_or_default()
            .as_bytes(),
    )
}

/// `String.prototype.slice(0, 12)` over CHARACTERS, not bytes.
fn slice12(text: &str) -> String {
    text.chars().take(12).collect()
}

#[cfg(test)]
#[path = "submit_tests.rs"]
mod tests;
