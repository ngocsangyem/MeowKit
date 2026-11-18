//! Links to a heading in the same file. A heading's anchor is derived from
//! its text, so when projection rewords a heading the links to it must
//! follow, whatever the word rules made of the link itself.

/// The anchor a Markdown renderer gives a heading: lower case, punctuation
/// dropped, spaces as hyphens.
fn anchor(heading: &str) -> String {
    heading
        .trim_start_matches('#')
        .trim()
        .chars()
        .filter_map(|c| match c {
            ' ' => Some('-'),
            c if c.is_alphanumeric() || c == '-' || c == '_' => Some(c.to_ascii_lowercase()),
            _ => None,
        })
        .collect()
}

/// Heading lines of `text`, skipping fenced code.
fn headings(text: &str) -> Vec<&str> {
    let mut fenced = false;
    text.lines()
        .filter(|line| {
            let start = line.trim_start();
            if start.starts_with("```") || start.starts_with("~~~") {
                fenced = !fenced;
            }
            !fenced && line.starts_with('#') && line.trim_start_matches('#').starts_with(' ')
        })
        .collect()
}

/// `projected` with every in-file link to a reworded heading pointing at the
/// heading's new anchor. `rename` is the word rule projection applied, used
/// to recognise a link the rules already changed. Text whose headings no
/// longer pair one to one with the source's is returned as is, and so is a
/// link to a heading whose anchor another heading shares: a renderer tells
/// those apart with a counter this does not model.
pub fn follow(source: &str, projected: String, rename: impl Fn(&str) -> String) -> String {
    let (before, after) = (headings(source), headings(&projected));
    if before.len() != after.len() {
        return projected;
    }
    let olds: Vec<String> = before.iter().map(|h| anchor(h)).collect();
    let news: Vec<String> = after.iter().map(|h| anchor(h)).collect();
    let shared = |all: &[String], one: &String| all.iter().filter(|a| *a == one).count() > 1;
    let mut out = projected.clone();
    for (old, new) in olds.iter().cloned().zip(news.iter().cloned()) {
        if old == new || shared(&olds, &old) || shared(&news, &new) {
            continue;
        }
        for stale in [rename(&old), old] {
            if stale != new {
                out = out.replace(&format!("(#{stale})"), &format!("(#{new})"));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_link_follows_its_reworded_heading() {
        let source = "[a](#claudepacks-layout) [b](#claude-code-hooks) [c](#other)\n\n\
                      ## `.claude/packs` layout\n\n```\n# not a heading\n```\n\n## Claude Code hooks\n\n## Other\n";
        // What the word rules leave: the first link untouched, the second half renamed.
        let projected = "[a](#claudepacks-layout) [b](#codex-code-hooks) [c](#other)\n\n\
                         ## `.codex/packs` layout\n\n```\n# not a heading\n```\n\n## Codex hooks\n\n## Other\n";
        let rename = |text: &str| text.replace("claude", "codex");
        assert_eq!(
            follow(source, projected.to_owned(), rename),
            "[a](#codexpacks-layout) [b](#codex-hooks) [c](#other)\n\n\
             ## `.codex/packs` layout\n\n```\n# not a heading\n```\n\n## Codex hooks\n\n## Other\n"
        );
    }

    #[test]
    fn a_heading_that_shares_its_anchor_is_left() {
        let source = "[a](#claude)\n\n## Claude\n\n~~~\n# x\n~~~\n\n## Claude\n";
        let projected = "[a](#claude)\n\n## Codex\n\n~~~\n# x\n~~~\n\n## Codex\n".to_owned();
        assert_eq!(follow(source, projected.clone(), str::to_owned), projected);
    }

    #[test]
    fn text_whose_headings_do_not_pair_is_left() {
        let projected = "[a](#one)\n\n## Uno\n\n## Extra\n".to_owned();
        assert_eq!(
            follow("[a](#one)\n\n## One\n", projected.clone(), str::to_owned),
            projected
        );
    }
}
