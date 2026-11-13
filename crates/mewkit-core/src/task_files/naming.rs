//! Task types, slugs and the two date stamps a new task file carries.
use crate::time_utc::{now_millis, utc_parts};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskType {
    Feature,
    BugFix,
    Refactor,
    Security,
}

/// The accepted `--type` values, in the order the refusal lists them.
pub const TASK_TYPES: [&str; 4] = ["feature", "bug-fix", "refactor", "security"];

impl TaskType {
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "feature" => Some(Self::Feature),
            "bug-fix" => Some(Self::BugFix),
            "refactor" => Some(Self::Refactor),
            "security" => Some(Self::Security),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Feature => "feature",
            Self::BugFix => "bug-fix",
            Self::Refactor => "refactor",
            Self::Security => "security",
        }
    }

    /// The suffix used in the filename and the branch name. `bug-fix` shortens
    /// to `bug`; the rest are their own name.
    pub fn suffix(self) -> &'static str {
        match self {
            Self::Feature => "feature",
            Self::BugFix => "bug",
            Self::Refactor => "refactor",
            Self::Security => "security",
        }
    }

    /// The project-authored template filename for this type, if a project has
    /// one. The kit ships none, so "no template" is the normal answer.
    pub fn template_name(self) -> &'static str {
        match self {
            Self::Feature => "feature-implementation.md",
            Self::BugFix => "bug-fix.md",
            Self::Refactor => "refactor.md",
            Self::Security => "security-audit.md",
        }
    }
}

/// `YYMMDD` for the filename stamp, in the LOCAL calendar.
///
/// ## Why this one is local and `created:` below is not
///
/// Not a style choice on either side: it is what the npm CLI does, and both
/// halves are user-visible. The filename comes from `new Date()` plus
/// `getFullYear`/`getMonth`/`getDate`, which are local-calendar accessors, so
/// the file a user creates at 01:00 carries the date on their own wall
/// calendar. The `created:` field comes from `toISOString()`, which is UTC. The
/// two disagree for part of every day outside UTC, and reproducing that is the
/// point: a task file written by either CLI has to be the same file.
///
/// The zone comes from the system (`/etc/localtime` on Unix, the time-zone API
/// on Windows) through `jiff`, because the standard library has no local
/// calendar. A system with no readable zone falls back to UTC rather than
/// failing: a missing time zone must not stop a task from being created, and
/// UTC is what the file would have been named before this.
pub fn today_yymmdd() -> String {
    yymmdd(&jiff::Zoned::now())
}

/// [`today_yymmdd`] for a given instant and zone, so a test can pin both.
///
/// `zone` is an IANA name; an unknown one is UTC, matching the fallback
/// `Zoned::now` takes when the system zone cannot be read.
pub fn stamp_yymmdd(unix_millis: i64, zone: &str) -> String {
    yymmdd(&zoned_at(unix_millis, zone))
}

/// The six digits, from a datetime that already carries its zone.
fn yymmdd(zoned: &jiff::Zoned) -> String {
    format!(
        "{:02}{:02}{:02}",
        zoned.year().rem_euclid(100),
        zoned.month(),
        zoned.day()
    )
}

/// `YYYY-MM-DD` for the frontmatter — UTC, the way `toISOString().slice(0, 10)`
/// is in the npm CLI. Deliberately NOT local: see [`today_yymmdd`].
pub fn today_iso() -> String {
    stamp_iso(now_millis())
}

pub fn stamp_iso(unix_millis: i64) -> String {
    let (y, mo, d, ..) = utc_parts(unix_millis.div_euclid(1000));
    format!("{y:04}-{mo:02}-{d:02}")
}

/// An instant in a named zone, falling back to UTC for an instant or a zone the
/// library cannot resolve.
fn zoned_at(unix_millis: i64, zone: &str) -> jiff::Zoned {
    let timestamp =
        jiff::Timestamp::from_millisecond(unix_millis).unwrap_or(jiff::Timestamp::UNIX_EPOCH);
    jiff::tz::TimeZone::get(zone)
        .map(|tz| timestamp.to_zoned(tz))
        .unwrap_or_else(|_| timestamp.to_zoned(jiff::tz::TimeZone::UTC))
}

/// Convert a description to a kebab-case slug: lower-cased, every character
/// that is not a letter, digit, space or hyphen dropped, whitespace runs
/// collapsed to one hyphen, hyphen runs collapsed to one, capped at 60.
///
/// "Letter" here means ASCII a–z, as in the original `[^a-z0-9\s-]` — a
/// description in another script slugs to hyphens, and the frontmatter `title`
/// keeps the real text.
pub fn to_kebab(text: &str) -> String {
    let lowered = text.to_lowercase();
    let kept: String = lowered
        .chars()
        .filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == '-' || js_whitespace(*c))
        .collect();
    // `trim` before the whitespace collapse, so a leading space does not
    // become a leading hyphen.
    let mut out = String::with_capacity(kept.len());
    let mut last_was_hyphen = false;
    for ch in kept.trim_matches(js_whitespace).chars() {
        let hyphen = ch == '-' || js_whitespace(ch);
        if hyphen && last_was_hyphen {
            continue;
        }
        out.push(if hyphen { '-' } else { ch });
        last_was_hyphen = hyphen;
    }
    out.chars().take(60).collect()
}

/// `\s` in a JavaScript regex: the White_Space property plus U+FEFF.
fn js_whitespace(c: char) -> bool {
    c.is_whitespace() || c == '\u{feff}'
}
