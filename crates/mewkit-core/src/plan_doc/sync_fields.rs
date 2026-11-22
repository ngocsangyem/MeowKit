//! The status vocabulary `plan sync` speaks, and the line-level rewrites it
//! makes in the markdown.
//!
//! The hook core `.claude/hooks/lib/core/plan-state-sync.cjs` applies the same
//! rule where the binary is not on PATH, so every function here mirrors its
//! JavaScript twin: the two must leave a plan byte-identical. Every rewrite
//! touches one VALUE on one line and keeps the line ending where it was.
use std::sync::LazyLock;

use regex::Regex;

use super::archive_writes::FIRST_BLOCK;

/// Phase statuses only a human writes. Sync derives around them, never over them.
pub(super) const KEPT: [&str; 3] = ["failed", "abandoned", "active"];
/// Plan statuses sync never replaces.
pub(super) const PLAN_KEPT: [&str; 4] = ["failed", "abandoned", "cancelled", "archived"];

static STATUS_KEY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^(status:[ \t]*)([^\r\n]*)").expect("static status-key pattern")
});
static TRAILING_COMMENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+#.*$").expect("static comment pattern"));
static OVERVIEW: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?m)^([ \t]*[-*][ \t]+\*\*Status:\*\*[ \t]*)([^\r\n]*)")
        .expect("static overview-status pattern")
});
static SEPARATOR_ROW: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\s*\|?[\s:|-]+$").expect("static separator pattern"));

/// `In progress (rest waived)`, `"in_progress"`, `in-progress` → `in_progress`.
pub(super) fn norm(value: &str) -> String {
    let cut = value.find('(').map_or(value, |at| &value[..at]);
    let kept: String = cut
        .chars()
        .filter(|c| c.is_ascii_alphabetic() || matches!(c, ' ' | '_' | '-'))
        .collect();
    let mut out = String::new();
    let mut in_run = false;
    for ch in kept.trim().to_ascii_lowercase().chars() {
        if ch == ' ' || ch == '-' {
            if !in_run {
                out.push('_');
            }
            in_run = true;
        } else {
            out.push(ch);
            in_run = false;
        }
    }
    out
}

/// Written in the style the field already uses: `In progress` beside a
/// capital, otherwise the machine token `in_progress`.
pub(super) fn styled(current: &str, status: &str) -> String {
    let first = current
        .chars()
        .find(|c| !(c.is_whitespace() || matches!(c, '"' | '\'' | '*')));
    if !first.is_some_and(|c| c.is_ascii_uppercase()) {
        return status.to_string();
    }
    match status {
        "pending" => "Pending",
        "in_progress" => "In progress",
        _ => "Completed",
    }
    .to_string()
}

/// The status the boxes imply, for a phase with at least one box.
pub(super) fn derive(checked: usize, total: usize) -> &'static str {
    match checked {
        0 => "pending",
        c if c < total => "in_progress",
        _ => "completed",
    }
}

/// The first frontmatter block's `status:` — its cleaned value and the byte
/// range of the raw value, so a rewrite keeps the key's own spacing.
pub(super) struct FrontmatterStatus {
    pub value: String,
    start: usize,
    end: usize,
}

impl FrontmatterStatus {
    pub fn set(&self, content: &str, to: &str) -> String {
        format!("{}{to}{}", &content[..self.start], &content[self.end..])
    }
}

pub(super) fn frontmatter_status(content: &str) -> Option<FrontmatterStatus> {
    let block = FIRST_BLOCK.captures(content)?.get(1)?;
    let caps = STATUS_KEY.captures(block.as_str())?;
    let raw = caps.get(2)?;
    let cleaned = TRAILING_COMMENT.replace(raw.as_str(), "");
    let trimmed = cleaned.trim();
    let head = trimmed.strip_prefix(['"', '\'']).unwrap_or(trimmed);
    let value = head.strip_suffix(['"', '\'']).unwrap_or(head).to_string();
    Some(FrontmatterStatus {
        value,
        start: block.start() + raw.start(),
        end: block.start() + raw.end(),
    })
}

/// One rewrite: the value before, the value after, and the whole new content.
pub(super) struct Rewrite {
    pub from: String,
    pub to: String,
    pub content: String,
}

/// Rewrite the Overview `- **Status:**` value (after the frontmatter) when it
/// does not already say `status`. The whole value is replaced.
pub(super) fn rewrite_overview(content: &str, status: &str) -> Option<Rewrite> {
    let body_at = FIRST_BLOCK.find(content).map_or(0, |m| m.end());
    let caps = OVERVIEW.captures(&content[body_at..])?;
    let value = caps.get(2)?;
    if norm(value.as_str()) == status {
        return None;
    }
    let to = styled(value.as_str(), status);
    let (start, end) = (body_at + value.start(), body_at + value.end());
    Some(Rewrite {
        from: value.as_str().trim().to_string(),
        content: format!("{}{to}{}", &content[..start], &content[end..]),
        to,
    })
}

/// `Number(cell)` for the `#` column: empty reads as 0, junk as no number.
fn row_number(cell: &str) -> Option<f64> {
    let trimmed = cell.trim();
    if trimmed.is_empty() {
        return Some(0.0);
    }
    trimmed.parse::<f64>().ok()
}

/// Rewrite the Status cell of the first Phases-table row naming `file` (or
/// numbered `num`). The Status column comes from a header row followed by a
/// separator row. A row that already says `status` stops the search unchanged.
pub(super) fn rewrite_table_cell(
    content: &str,
    file: &str,
    num: Option<f64>,
    status: &str,
) -> Option<Rewrite> {
    let mut lines: Vec<String> = content.split('\n').map(str::to_string).collect();
    let mut col: Option<usize> = None;
    for i in 0..lines.len() {
        let row = lines[i].clone();
        let bare = row.strip_suffix('\r').unwrap_or(&row);
        let mut cells: Vec<String> = bare.split('|').map(str::to_string).collect();
        if !row.trim().starts_with('|') {
            col = None;
            continue;
        }
        let header = cells
            .iter()
            .position(|c| c.trim().eq_ignore_ascii_case("status"));
        let next_is_separator = lines.get(i + 1).is_some_and(|n| SEPARATOR_ROW.is_match(n));
        if let (Some(at), true) = (header, next_is_separator) {
            col = Some(at);
            continue;
        }
        let Some(at) = col.filter(|at| cells.get(*at).is_some_and(|c| !c.is_empty())) else {
            continue;
        };
        let names = [format!("{file})"), format!("{file}]"), format!(" {file} ")]
            .iter()
            .any(|n| row.contains(n.as_str()));
        let numbered = num.is_some() && cells.get(1).and_then(|c| row_number(c)) == num;
        if !names && !numbered {
            continue;
        }
        let from = cells[at].trim().to_string();
        if norm(&from) == status {
            return None;
        }
        let to = styled(&from, status);
        cells[at] = if from.is_empty() {
            format!(" {to} ")
        } else {
            cells[at].replacen(&from, &to, 1)
        };
        let cr = if row.ends_with('\r') { "\r" } else { "" };
        lines[i] = format!("{}{cr}", cells.join("|"));
        return Some(Rewrite {
            from,
            to,
            content: lines.join("\n"),
        });
    }
    None
}
