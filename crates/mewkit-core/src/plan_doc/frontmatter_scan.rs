//! The hand-written frontmatter reader `plan status` and `plan check` use.
//!
//! Deliberately NOT [`crate::yaml_doc`]. This is the line scan the npm CLI's
//! `core/plan-parser.ts` performs — find a line starting `key:`, take what
//! follows, strip one layer of quotes — and the values it produces are printed
//! and compared byte for byte against that CLI's. A real YAML reader would
//! accept and reject different documents, so the quirks below ARE the contract.
//!
//! The structural CHECKS parse the same block properly (see
//! [`super::phase_structure::parse_frontmatter`]); the two readers answer
//! different questions, which is why there are two.

/// The frontmatter block as raw lines, or empty when there is none.
///
/// The bounds mirror `slice(4, indexOf("\n---", 3))`: a document opening with
/// `---\r\n` therefore yields one leading empty line, whose trailing `\r`
/// [`field`] trims away.
pub fn frontmatter_lines(body: &str) -> Vec<&str> {
    if !body.starts_with("---") {
        return Vec::new();
    }
    let Some(end) = body[3..].find("\n---").map(|at| at + 3) else {
        return Vec::new();
    };
    if end <= 4 {
        return Vec::new();
    }
    body[4..end].split('\n').collect()
}

/// One leading and one trailing quote character, either kind — the exact reach
/// of `replace(/^["']|["']$/g, "")`.
fn unquote(raw: &str) -> &str {
    let head = raw.strip_prefix(['"', '\'']).unwrap_or(raw);
    head.strip_suffix(['"', '\'']).unwrap_or(head)
}

/// A scalar frontmatter field. Nothing clever — plans are hand-written. An
/// empty value reads as ABSENT, because the TypeScript ends with `|| null`.
pub fn field(fm: &[&str], key: &str) -> Option<String> {
    let wanted = format!("{key}:");
    let line = fm.iter().find(|l| l.trim_start().starts_with(&wanted))?;
    // The first colon on the line closes the key: the only text before it is
    // indentation, which cannot contain one.
    let colon = line.find(':')?;
    let value = unquote(line[colon + 1..].trim());
    (!value.is_empty()).then(|| value.to_string())
}

/// An inline-array frontmatter field (`dependencies: [one, two]`).
pub fn array_field(fm: &[&str], key: &str) -> Vec<String> {
    let Some(raw) = field(fm, key) else {
        return Vec::new();
    };
    // One leading `[` and one trailing `]`, each optional and independent —
    // the reach of `replace(/^\[|\]$/g, "")`.
    let open = raw.strip_prefix('[').unwrap_or(&raw);
    let inner = open.strip_suffix(']').unwrap_or(open).trim();
    if inner.is_empty() {
        return Vec::new();
    }
    inner
        .split(',')
        .map(|part| unquote(part.trim()).to_string())
        .filter(|part| !part.is_empty())
        .collect()
}
