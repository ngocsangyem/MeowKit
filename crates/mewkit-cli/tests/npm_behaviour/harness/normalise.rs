//! Folding away the things two runs of the same command cannot share.
//!
//! Each rule below removes a value that differs between two INVOCATIONS, not
//! between two implementations — the temp directory a run happened in, the
//! instant it happened at, how long it took. Nothing here folds away behaviour:
//! a rule that could mask a real difference is spelled out where it is defined,
//! and a per-case [`Normaliser::declare`] carries the reason it was allowed.
use std::path::Path;
use std::sync::LazyLock;

use regex::Regex;

/// `2026-11-12T12:41:04Z`, with or without milliseconds — the shape every
/// durable record's timestamp carries.
static TIMESTAMP: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z").expect("static timestamp pattern")
});

/// A measured duration in milliseconds, under any JSON spelling of the key.
static DURATION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(durationMs"?\s*:\s*)\d+"#).expect("static duration pattern"));

/// An `x.y.z` version. The two CLIs have SEPARATE version lines on purpose
/// until cutover (the npm package's and the crate's), and several records carry
/// the writing CLI's version as provenance — comparing those literally would
/// fail forever for a field whose whole point is to differ.
static VERSION: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?").expect("static version pattern")
});

/// The day the npm runs were recorded (`golden/npm/README.md`).
const RECORDED_ON_MILLIS: i64 = 1_794_614_400_000; // 2026-11-14T00:00:00Z
const DAY_MILLIS: i64 = 86_400_000;

/// A calendar date a command stamps into a name or a record, `YYMMDD` or
/// `YYYY-MM-DD`, for the days a run can carry: the recording day and today,
/// each widened by a day either side because the stamp may be local or UTC.
/// Only those days fold, so a fixed date a fixture or a command prints still
/// compares literally.
static RUN_DATE: LazyLock<Regex> = LazyLock::new(|| {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64);
    let mut days = Vec::new();
    for centre in [RECORDED_ON_MILLIS, now] {
        for offset in [-1, 0, 1] {
            let at = centre + offset * DAY_MILLIS;
            days.push(mewkit_core::task_files::stamp_iso(at));
            days.push(mewkit_core::task_files::stamp_yymmdd(at, "UTC"));
        }
    }
    days.sort();
    days.dedup();
    Regex::new(&format!(r"\b(?:{})\b", days.join("|"))).expect("run date pattern")
});

struct Declared {
    pattern: Regex,
    replacement: String,
    reason: &'static str,
    applied: bool,
}

pub struct Normaliser {
    /// Every spelling of the run's directories, longest first so a nested
    /// path is replaced before its parent.
    roots: Vec<String>,
    declared: Vec<Declared>,
}

impl Normaliser {
    pub fn new(dirs: &[&Path]) -> Self {
        let mut roots: Vec<String> = Vec::new();
        for path in dirs {
            for spelling in [path.to_path_buf(), path.canonicalize().unwrap_or_default()] {
                // macOS resolves the temp dir through `/private/var`, so a path
                // PRINTED by a command and the same path as this test knows it
                // are different strings for the same directory.
                let text = spelling.to_string_lossy().into_owned();
                if !text.is_empty() && !roots.contains(&text) {
                    roots.push(text);
                }
            }
        }
        roots.sort_by_key(|r| std::cmp::Reverse(r.len()));
        Self {
            roots,
            declared: Vec::new(),
        }
    }

    /// Fold only the temp directories to `<project>`: what a recording keeps of
    /// a run, because the directories are random per run and nothing else is.
    pub fn strip_roots(&self, raw: &str) -> String {
        let mut out = raw.replace("\r\n", "\n");
        for root in &self.roots {
            out = out.replace(root, "<project>");
        }
        out
    }

    /// A path in a written tree: a file named by the day it was written.
    pub fn path(&self, raw: &str) -> String {
        RUN_DATE.replace_all(raw, "<date>").into_owned()
    }

    /// Add a per-case allowance. Its reason is reported if it never applies.
    pub fn declare(&mut self, pattern: Regex, replacement: String, reason: &'static str) {
        self.declared.push(Declared {
            pattern,
            replacement,
            reason,
            applied: false,
        });
    }

    /// Normalise one piece of text from either side.
    pub fn text(&mut self, raw: &str) -> String {
        // A captured stream can terminate its lines differently per runtime on
        // Windows; that is not a behaviour difference.
        let mut out = raw.replace("\r\n", "\n");
        for root in &self.roots {
            out = out.replace(root, "<project>");
        }
        out = TIMESTAMP.replace_all(&out, "<ts>").into_owned();
        out = RUN_DATE.replace_all(&out, "<date>").into_owned();
        out = DURATION.replace_all(&out, "${1}<ms>").into_owned();
        out = VERSION.replace_all(&out, "<version>").into_owned();
        for declared in &mut self.declared {
            if declared.pattern.is_match(&out) {
                declared.applied = true;
                out = declared
                    .pattern
                    .replace_all(&out, declared.replacement.as_str())
                    .into_owned();
            }
        }
        out
    }

    /// An allowance that never matched is a stale allowance: it would go on
    /// hiding a difference that appears later, and nobody would know it was
    /// still there.
    pub fn assert_every_allowance_applied(&self, case: &str) {
        for declared in &self.declared {
            assert!(
                declared.applied,
                "[{case}] the declared difference {:?} ({}) never matched anything — \
                 remove it or fix the pattern",
                declared.pattern.as_str(),
                declared.reason
            );
        }
    }
}
