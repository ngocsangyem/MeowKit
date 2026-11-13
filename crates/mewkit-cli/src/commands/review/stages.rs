//! One function per sub-verb: read the arguments the npm CLI reads, call the
//! pipeline, print, and return the exit code.
//!
//! ## The two reproduced crashes
//!
//! The npm CLI reaches Node's `path` API with values its own argument parsing
//! produced, and two invocations die there rather than being refused:
//!
//! - a missing `--session` on `coverage`/`compose`/`submit`/`cleanup` reaches
//!   `path.join` as `undefined`;
//! - a BARE NUMBER in a positional slot arrives as a JavaScript `number`,
//!   because minimist coerces numeric positionals — so the documented
//!   `review prepare 7` form dies on `.trim()`.
//!
//! Both are reproduced here, text and exit code, because a caller's script
//! branches on them today. They are npm-CLI bugs, pinned by a parity case so
//! the fix lands in both CLIs at once rather than silently in one.
use std::io::Write;
use std::path::Path;

use mewkit_core::review::cleanup::{CleanupOptions, cleanup as run_cleanup};
use mewkit_core::review::compose::compose as run_compose;
use mewkit_core::review::coverage::coverage as run_coverage;
use mewkit_core::review::exec::RealExec;
use mewkit_core::review::prepare::{
    PrepareOptions, default_session_id, prepare as run_prepare, random_hex8,
};
use mewkit_core::review::read::{ReadOptions, ReadRefusal, ReadTarget, read as run_read};
use mewkit_core::review::submit::{SubmitOptions, submit as run_submit};
use mewkit_core::time_utc::{iso_seconds, now_millis};

use super::{code_for, emit};
use crate::failure::{FAILED, Failure};

/// A stage result as the JSON record `--json` prints.
///
/// A macro, not a function: expanded at the call site it names a concrete
/// type, so this crate never has to name `serde::Serialize` and never has to
/// depend on `serde` to print a core type.
macro_rules! as_json {
    ($value:expr) => {
        serde_json::to_value($value).unwrap_or(serde_json::Value::Null)
    };
}

/// minimist's own number test, applied to a positional — the one place a
/// positional's TYPE matters, because a numeric one stops being a string.
///
/// Hand-written rather than compiled, so this crate stays free of a regex
/// dependency. It is `/^0x[0-9a-f]+$/i` or
/// `/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/` — note the lower-case `e`
/// only, which is why `1E3` stays a string.
fn minimist_number(token: &str) -> Option<f64> {
    if let Some(digits) = token
        .strip_prefix("0x")
        .or_else(|| token.strip_prefix("0X"))
    {
        if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_hexdigit()) {
            return None;
        }
        return u64::from_str_radix(digits, 16).ok().map(|n| n as f64);
    }
    let rest = token.strip_prefix(['-', '+']).unwrap_or(token);
    let (mantissa, exponent) = match rest.split_once('e') {
        Some((mantissa, exponent)) => (mantissa, Some(exponent)),
        None => (rest, None),
    };
    let mantissa_ok = match mantissa.split_once('.') {
        // `1.`, `1.5`: digits before the point, any number after.
        Some((whole, fraction)) => {
            !whole.is_empty() && all_digits(whole) && all_digits(fraction)
                || whole.is_empty() && !fraction.is_empty() && all_digits(fraction)
        }
        None => !mantissa.is_empty() && all_digits(mantissa),
    };
    let exponent_ok = exponent.is_none_or(|e| {
        let digits = e.strip_prefix(['-', '+']).unwrap_or(e);
        !digits.is_empty() && all_digits(digits)
    });
    if !(mantissa_ok && exponent_ok) {
        return None;
    }
    token.parse().ok()
}

fn all_digits(text: &str) -> bool {
    text.bytes().all(|b| b.is_ascii_digit())
}

/// Print a Node `TypeError` the way the npm CLI's top-level handler does.
fn fatal(message: &str) -> Result<u8, Failure> {
    eprintln!("Fatal: {message}");
    Ok(FAILED)
}

/// `path.join(…, undefined)` — what every stage but `read` hits when
/// `--session` is absent.
fn session_or_fatal(session: Option<&str>) -> Result<&str, Result<u8, Failure>> {
    session.ok_or_else(|| fatal("The \"path\" argument must be of type string. Received undefined"))
}

fn now() -> String {
    iso_seconds(now_millis())
}

pub fn prepare(args: &super::ReviewArgs, cwd: &Path) -> Result<u8, Failure> {
    let target = args.target.as_deref().unwrap_or_default();
    if minimist_number(target).is_some() {
        return fatal("(input ?? \"\").trim is not a function");
    }
    let session = default_session_id(
        &now(),
        // The id carries the PR number the target names; an unparsable target
        // never reaches here, so the fallback is cosmetic.
        &parsed_pr(target),
        &random_hex8(),
    );
    let result = run_prepare(
        &PrepareOptions {
            target,
            remote: args.remote.as_deref(),
            cwd,
            session,
        },
        &RealExec,
    );
    if args.json {
        emit::json(&as_json!(&result));
    } else if let Some(error) = &result.error {
        emit::failure(error);
    } else {
        emit::prepared(
            result.session.as_deref().unwrap_or_default(),
            result.session_dir.as_deref().unwrap_or_default(),
        );
    }
    Ok(code_for(result.ok))
}

/// The PR number the session id is stamped with, or `0` for a target that
/// will be refused anyway.
fn parsed_pr(target: &str) -> String {
    mewkit_core::review::pr_target::parse_pr_target(target)
        .map(|t| mewkit_core::js_value::js_number_text(t.pr))
        .unwrap_or_else(|_| "0".to_string())
}

pub fn read(args: &super::ReviewArgs, cwd: &Path) -> Result<u8, Failure> {
    let text = args.target.as_deref().unwrap_or_default();
    // The positional keeps the TYPE minimist gave it; where that type starts
    // to matter is the pipeline's business, not the parser's.
    let target = match minimist_number(text) {
        Some(number) => ReadTarget::Number(number),
        None => ReadTarget::Text(text),
    };
    let now = now();
    match run_read(&ReadOptions {
        session: args.session.as_deref(),
        reviewer: args.reviewer.as_deref(),
        target,
        cwd,
        now: &now,
    }) {
        Ok(outcome) => {
            // The artifact goes to stdout EXACTLY as stored: no trailing
            // newline is added, because a reviewer may diff what they read.
            let mut stdout = std::io::stdout();
            stdout.write_all(outcome.content.as_bytes())?;
            stdout.flush()?;
            if let Some(error) = &outcome.evidence_error {
                emit::evidence_not_recorded(error);
            }
            Ok(code_for(true))
        }
        Err(ReadRefusal::Message(error)) => {
            emit::failure(&error);
            Ok(FAILED)
        }
        Err(ReadRefusal::Fatal(error)) => fatal(&error),
    }
}

pub fn coverage(args: &super::ReviewArgs, cwd: &Path) -> Result<u8, Failure> {
    let session = match session_or_fatal(args.session.as_deref()) {
        Ok(session) => session,
        Err(outcome) => return outcome,
    };
    let report = run_coverage(cwd, session);
    if args.json {
        emit::json(&as_json!(&report));
    } else if let Some(error) = &report.error {
        emit::failure(error);
    } else {
        emit::coverage(
            report.complete,
            match report.evidence_level {
                mewkit_core::schema::review_session::EvidenceLevel::SessionObserved => {
                    "session-observed"
                }
                mewkit_core::schema::review_session::EvidenceLevel::Attested => "attested",
            },
            report.gaps.len(),
        );
    }
    // Coverage exits non-zero on an INCOMPLETE report, not on `ok`: a complete
    // report is the only passing outcome.
    Ok(code_for(report.complete))
}

pub fn compose(args: &super::ReviewArgs, cwd: &Path) -> Result<u8, Failure> {
    let session = match session_or_fatal(args.session.as_deref()) {
        Ok(session) => session,
        Err(outcome) => return outcome,
    };
    let result = run_compose(cwd, session, &RealExec);
    if args.json {
        emit::json(&as_json!(&result));
    } else if let Some(error) = &result.error {
        emit::failure(error);
    } else {
        emit::composed(
            result.decision.as_deref().unwrap_or_default(),
            result.event.as_deref().unwrap_or_default(),
            result.reasons.as_deref().unwrap_or_default(),
        );
    }
    Ok(code_for(result.ok))
}

pub fn submit(args: &super::ReviewArgs, cwd: &Path) -> Result<u8, Failure> {
    let session = match session_or_fatal(args.session.as_deref()) {
        Ok(session) => session,
        Err(outcome) => return outcome,
    };
    let now = now();
    let result = run_submit(
        &SubmitOptions {
            session,
            reply: args.reply,
            confirm: args.confirm.as_deref(),
            cwd,
            now: &now,
        },
        &RealExec,
    );
    if args.json {
        emit::json(&as_json!(&result));
    } else if let Some(error) = &result.error {
        emit::failure(error);
    } else {
        emit::submitted(result.already_posted.unwrap_or(false));
    }
    Ok(code_for(result.ok))
}

pub fn cleanup(args: &super::ReviewArgs, cwd: &Path) -> Result<u8, Failure> {
    let session = match session_or_fatal(args.session.as_deref()) {
        Ok(session) => session,
        Err(outcome) => return outcome,
    };
    let result = run_cleanup(
        &CleanupOptions {
            session,
            cwd,
            worktree_script: None,
        },
        &RealExec,
    );
    if args.json {
        emit::json(&as_json!(&result));
    } else if let Some(error) = &result.error {
        emit::failure(error);
    } else {
        emit::cleaned();
    }
    Ok(code_for(result.ok))
}

#[cfg(test)]
#[path = "stages_tests.rs"]
mod tests;
