//! The bounded looks the coexistence rows take at directories something other
//! than this install may also fill.
//!
//! Every read here is capped and nothing is followed. The directories involved
//! sit outside the project — another toolkit's agents, the user's own rules —
//! so a row must cost a fixed number of syscalls, must not leave the directory
//! it was pointed at through a link, and must never carry a file's body into
//! its output. Names, sizes and two frontmatter fields are enough to say "two
//! toolkits define this name", and they are all this module hands back.
use std::io::Read;
use std::path::{Path, PathBuf};

/// Entries read from one directory before the count stands in for the rest.
pub const MAX_ENTRIES: usize = 200;
/// Bytes read from one file. A frontmatter block fits; a longer one is reported
/// as unread rather than streamed.
const MAX_HEAD: u64 = 4 * 1024;
/// Characters of one name or description a row prints.
pub const MAX_FIELD: usize = 80;
/// Names listed before a row says how many are left.
const MAX_LISTED: usize = 6;

/// Characters that carry no glyph and would hide text inside a printed name.
const INVISIBLE: [char; 6] = [
    '\u{200b}', '\u{200c}', '\u{200d}', '\u{200e}', '\u{200f}', '\u{feff}',
];

/// One thing a host loads: the name it is known by, where it is, and its size.
pub struct Entry {
    pub name: String,
    pub path: PathBuf,
    pub bytes: u64,
}

impl Entry {
    /// The file name on disk, which is what an ownership index records.
    pub fn file_name(&self) -> String {
        self.path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default()
    }
}

/// What one directory listing found, and whether the cap cut it short.
#[derive(Default)]
pub struct Listing {
    pub entries: Vec<Entry>,
    /// The directory holds more entries than the cap allows, so every count
    /// taken from this listing is a floor and not a total. A row that printed
    /// the floor as a total would be wrong in the one case where the numbers
    /// matter most.
    pub truncated: bool,
}

impl Listing {
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn names(&self) -> Vec<String> {
        self.entries.iter().map(|e| e.name.clone()).collect()
    }
}

/// What a row appends when a directory it counted was cut short by the cap.
pub fn truncation_note(truncated: bool) -> &'static str {
    if truncated {
        "; a directory read for this row holds more than 200 entries, so these counts are a floor"
    } else {
        ""
    }
}

/// Regular files directly in `dir`, named by file stem — the name a host shows
/// for an agent or a rule.
pub fn files(dir: &Path) -> Listing {
    read(dir, false)
}

/// Subdirectories directly in `dir` — one skill per directory.
pub fn dirs(dir: &Path) -> Listing {
    read(dir, true)
}

/// A symlink is skipped rather than followed: reading through one would leave
/// the directory the caller named, which is the single thing these scans must
/// not do. A dot-entry is skipped because no host lists it.
fn read(dir: &Path, want_dir: bool) -> Listing {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Listing::default();
    };
    let mut out = Vec::new();
    let mut truncated = false;
    for entry in entries.flatten() {
        if out.len() >= MAX_ENTRIES {
            truncated = true;
            break;
        }
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_symlink() || kind.is_dir() != want_dir || !(kind.is_dir() || kind.is_file()) {
            continue;
        }
        let raw = entry.file_name().to_string_lossy().into_owned();
        if raw.starts_with('.') {
            continue;
        }
        let shown = if want_dir {
            raw.clone()
        } else {
            Path::new(&raw)
                .file_stem()
                .map_or_else(|| raw.clone(), |s| s.to_string_lossy().into_owned())
        };
        out.push(Entry {
            name: safe(&shown, MAX_FIELD),
            bytes: entry.metadata().map(|m| m.len()).unwrap_or_default(),
            path: entry.path(),
        });
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Listing {
        entries: out,
        truncated,
    }
}

/// `text` with whitespace collapsed, invisible characters dropped and the
/// result cut to `max` characters. A name another toolkit wrote is data: a row
/// prints it, so a control character or a zero-width space must not survive
/// into the output it is printed into.
pub fn safe(text: &str, max: usize) -> String {
    let cleaned: String = text
        .chars()
        .filter(|c| !INVISIBLE.contains(c))
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect();
    let joined = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    if joined.chars().count() <= max {
        return joined;
    }
    joined.chars().take(max).collect::<String>() + "…"
}

/// The first [`MAX_HEAD`] bytes of `file` as text, or `None` when it cannot be
/// read. The cap is the whole point: the caller wants a frontmatter block, not
/// a file.
///
/// The link is NOT followed and anything that is not a regular file is left
/// alone. Inside a scanned tree the caller chose only the directory, not what
/// someone put in it, so a `SKILL.md` symlinked out of the tree — or a named
/// pipe wearing that name — must not be opened.
fn head(file: &Path) -> Option<String> {
    if !std::fs::symlink_metadata(file).ok()?.is_file() {
        return None;
    }
    let mut bytes = Vec::new();
    std::fs::File::open(file)
        .ok()?
        .take(MAX_HEAD)
        .read_to_end(&mut bytes)
        .ok()?;
    Some(String::from_utf8_lossy(&bytes).into_owned())
}

/// What one skill costs the listing every installed toolkit draws on: the
/// characters of its name plus its description, the two fields a host shows.
///
/// `None` when no frontmatter block closes within the capped read — an
/// oversized block counts as unread rather than as free, because the row's
/// number would otherwise understate the cost.
pub fn listing_cost(file: &Path) -> Option<usize> {
    let text = head(file)?;
    let (block, _) = mewkit_core::yaml_doc::split_frontmatter(&text)?;
    let data = mewkit_core::yaml_doc::parse_value(block).ok()?;
    let field = |key: &str| {
        data.get(key)
            .and_then(serde_json::Value::as_str)
            .map_or(0, |v| v.chars().count())
    };
    Some(field("name") + field("description"))
}

/// Up to [`MAX_LISTED`] names, then how many are left.
pub fn sample(names: &[String]) -> String {
    let shown: Vec<&str> = names.iter().take(MAX_LISTED).map(String::as_str).collect();
    let rest = names.len().saturating_sub(shown.len());
    if rest == 0 {
        shown.join(", ")
    } else {
        format!("{} (+{rest})", shown.join(", "))
    }
}

/// A byte count as a row prints it.
pub fn kb(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{bytes} B")
    } else {
        format!("{:.1} kB", bytes as f64 / 1024.0)
    }
}

/// The last segment of a path-like token, whatever separator it uses.
pub fn base(token: &str) -> String {
    let tail = token
        .rsplit_once(['/', '\\'])
        .map_or(token, |(_, tail)| tail);
    safe(tail, MAX_FIELD)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_printed_name_loses_what_would_hide_text_in_it() {
        assert_eq!(safe("a\u{200b}b\nc\t d", 80), "ab c d");
        assert_eq!(safe(&"x".repeat(90), 80), format!("{}…", "x".repeat(80)));
        assert_eq!(base("$ROOT/.claude/hooks/x.cjs"), "x.cjs");
        assert_eq!(base(r"C:\tools\fmt.js"), "fmt.js");
        assert_eq!(base("node"), "node");
    }

    #[test]
    fn a_sample_says_how_many_it_did_not_list() {
        let names: Vec<String> = (0..9).map(|n| n.to_string()).collect();
        assert_eq!(sample(&names), "0, 1, 2, 3, 4, 5 (+3)");
        assert_eq!(sample(&names[..2]), "0, 1");
        assert_eq!(kb(512), "512 B");
        assert_eq!(kb(2048), "2.0 kB");
    }

    #[test]
    fn an_oversized_frontmatter_block_counts_as_unread() {
        let dir = tempfile::tempdir().expect("a temporary directory");
        let small = dir.path().join("SKILL.md");
        std::fs::write(&small, "---\nname: a\ndescription: bcd\n---\nbody\n").expect("write");
        assert_eq!(listing_cost(&small), Some(4));
        let big = dir.path().join("BIG.md");
        let padding = "# ".repeat(usize::try_from(MAX_HEAD).expect("a small cap"));
        std::fs::write(&big, format!("---\nname: a\nnote: {padding}\n---\n")).expect("write");
        assert_eq!(listing_cost(&big), None);
    }

    /// A directory past the cap must say so, because the counts a row prints
    /// from it are then a floor and reading them as a total is the mistake.
    #[test]
    fn a_directory_past_the_cap_reports_that_it_was_cut_short() {
        let dir = tempfile::tempdir().expect("a temporary directory");
        for n in 0..MAX_ENTRIES {
            std::fs::create_dir(dir.path().join(format!("skill-{n:04}"))).expect("a skill");
        }
        let within = dirs(dir.path());
        assert_eq!(within.len(), MAX_ENTRIES);
        assert!(!within.truncated, "exactly at the cap is not truncated");
        assert_eq!(truncation_note(false), "");

        std::fs::create_dir(dir.path().join("one-too-many")).expect("a skill");
        let over = dirs(dir.path());
        assert_eq!(over.len(), MAX_ENTRIES, "the listing stays capped");
        assert!(over.truncated);
        assert!(truncation_note(true).contains("a floor"));
    }
}
