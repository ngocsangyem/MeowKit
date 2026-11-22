//! A line diff for showing an overlay before it is approved.
//!
//! Longest common subsequence over lines, printed with two lines of context
//! around each change. Enough to read what an overlay would change; not a
//! patch format.
const CONTEXT: usize = 2;
/// Past this many cells the table costs more than the diff is worth to read.
const MAX_CELLS: usize = 4_000_000;

enum Line<'a> {
    Same(&'a str),
    Gone(&'a str),
    Added(&'a str),
}

/// `old` against `new`, as printable lines (`-`, `+`, ` ` and `…`).
pub fn render(old: &str, new: &str) -> Vec<String> {
    let a: Vec<&str> = old.lines().collect();
    let b: Vec<&str> = new.lines().collect();
    if a.len().saturating_mul(b.len()) > MAX_CELLS {
        return vec![format!(
            "  (too large to show: {} lines replaced by {} lines)",
            a.len(),
            b.len()
        )];
    }
    let script = edit_script(&a, &b);
    let changed: Vec<bool> = script.iter().map(|l| !matches!(l, Line::Same(_))).collect();
    let near = |i: usize| {
        let lo = i.saturating_sub(CONTEXT);
        let hi = (i + CONTEXT).min(changed.len().saturating_sub(1));
        changed[lo..=hi].iter().any(|c| *c)
    };
    let mut out = Vec::new();
    let mut skipped = false;
    for (i, line) in script.iter().enumerate() {
        if !near(i) {
            skipped = true;
            continue;
        }
        if skipped && !out.is_empty() {
            out.push("  \u{2026}".to_owned());
        }
        skipped = false;
        out.push(match line {
            Line::Same(t) => format!("   {t}"),
            Line::Gone(t) => format!("  -{t}"),
            Line::Added(t) => format!("  +{t}"),
        });
    }
    if out.is_empty() {
        out.push("  (no line differs)".to_owned());
    }
    out
}

fn edit_script<'a>(a: &[&'a str], b: &[&'a str]) -> Vec<Line<'a>> {
    // lcs[i][j]: length of the common subsequence of a[i..] and b[j..].
    let width = b.len() + 1;
    let mut lcs = vec![0u32; (a.len() + 1) * width];
    for i in (0..a.len()).rev() {
        for j in (0..b.len()).rev() {
            lcs[i * width + j] = if a[i] == b[j] {
                lcs[(i + 1) * width + j + 1] + 1
            } else {
                lcs[(i + 1) * width + j].max(lcs[i * width + j + 1])
            };
        }
    }
    let (mut i, mut j) = (0, 0);
    let mut out = Vec::new();
    while i < a.len() && j < b.len() {
        if a[i] == b[j] {
            out.push(Line::Same(a[i]));
            i += 1;
            j += 1;
        } else if lcs[(i + 1) * width + j] >= lcs[i * width + j + 1] {
            out.push(Line::Gone(a[i]));
            i += 1;
        } else {
            out.push(Line::Added(b[j]));
            j += 1;
        }
    }
    out.extend(a[i..].iter().map(|t| Line::Gone(t)));
    out.extend(b[j..].iter().map(|t| Line::Added(t)));
    out
}

#[cfg(test)]
mod tests {
    use super::render;

    #[test]
    fn shows_the_changed_line_with_context() {
        let out = render("a\nb\nc\nd\ne\nf\ng\n", "a\nb\nc\nD\ne\nf\ng\n");
        assert_eq!(out, ["   b", "   c", "  -d", "  +D", "   e", "   f"]);
    }
}
