// Escaping for generated Markdown table cells.
//
// Three generators each grew their own version of this and each got it partly wrong. A pipe ends
// the cell it sits in, which breaks the table quietly. Angle brackets are worse: MDX reads
// `<name>` as a JSX tag and fails the build outright, which is how a skill description
// containing a placeholder took the whole docs site down.
//
// Generated content comes from frontmatter written by many hands, so it must be treated as
// arbitrary text rather than as something that happens to be safe today.

/**
 * Make arbitrary text safe inside a single Markdown table cell.
 *
 * Braces are escaped for the same reason as angle brackets and for a nastier one: MDX evaluates
 * `{name}` as a JavaScript expression. That does not fail at compile time — it fails at
 * prerender with `ReferenceError: name is not defined`, so a build that prints "Compiled
 * successfully" still dies several steps later on one page. A skill describing
 * `parallel/{name}-{timestamp}` branches was enough to do it.
 */
export function tableCell(text: string): string {
	return text
		.replace(/\|/g, "\\|")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\{/g, "&#123;")
		.replace(/\}/g, "&#125;")
		.replace(/\r?\n+/g, " ")
		.trim();
}

/** The same, wrapped as inline code — the common shape for a path or identifier. */
export function codeCell(text: string): string {
	// A backtick inside the value would close the span early; there is no escape for it inside
	// inline code, so the value is rendered as plain escaped text instead.
	return text.includes("`") ? tableCell(text) : `\`${tableCell(text)}\``;
}
