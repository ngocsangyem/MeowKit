// Escaping for generated Markdown table cells.
//
// Three generators each grew their own version of this and each got it partly wrong. A pipe ends
// the cell it sits in, which breaks the table quietly. Angle brackets are worse: MDX reads
// `<name>` as a JSX tag and fails the build outright, which is how a skill description
// containing a placeholder took the whole docs site down.
//
// Generated content comes from frontmatter written by many hands, so it must be treated as
// arbitrary text rather than as something that happens to be safe today.

/** Make arbitrary text safe inside a single Markdown table cell. */
export function tableCell(text: string): string {
	return text
		.replace(/\|/g, "\\|")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\r?\n+/g, " ")
		.trim();
}

/** The same, wrapped as inline code — the common shape for a path or identifier. */
export function codeCell(text: string): string {
	// A backtick inside the value would close the span early; there is no escape for it inside
	// inline code, so the value is rendered as plain escaped text instead.
	return text.includes("`") ? tableCell(text) : `\`${tableCell(text)}\``;
}
