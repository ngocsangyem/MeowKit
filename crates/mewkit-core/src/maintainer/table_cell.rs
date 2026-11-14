//! Escaping for generated Markdown table cells.
//!
//! A pipe ends the cell it sits in. Angle brackets and braces are worse: MDX
//! reads `<name>` as a JSX tag and `{name}` as a JavaScript expression, and the
//! latter only fails at prerender, so a build that says "Compiled successfully"
//! can still die on one page. Generated text comes from frontmatter written by
//! many hands and is treated as arbitrary.

use regex::Regex;

/// Make arbitrary text safe inside one Markdown table cell.
pub fn table_cell(text: &str) -> String {
    let escaped = text
        .replace('|', "\\|")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('{', "&#123;")
        .replace('}', "&#125;");
    // `\r?\n+` exactly: a lone carriage return is left alone, as the page does.
    let breaks = Regex::new(r"\r?\n+").expect("a static pattern");
    let out = breaks.replace_all(&escaped, " ");
    out.trim().to_string()
}

/// The same, wrapped as inline code. A backtick inside the value cannot be
/// escaped within a code span, so that value is rendered as plain escaped text.
pub fn code_cell(text: &str) -> String {
    if text.contains('`') {
        table_cell(text)
    } else {
        format!("`{}`", table_cell(text))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_what_breaks_a_table_or_mdx() {
        assert_eq!(table_cell("a|b <x> {y}"), "a\\|b &lt;x&gt; &#123;y&#125;");
        assert_eq!(table_cell(" one\r\n\ntwo "), "one two");
    }

    #[test]
    fn a_backtick_value_is_not_code_wrapped() {
        assert_eq!(code_cell("a`b"), "a`b");
        assert_eq!(code_cell("ab"), "`ab`");
    }
}
