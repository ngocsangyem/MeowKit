/**
 * Strip ANSI escape sequences from text before emission.
 * Per red-team finding Critical #1 + injection-rules.md Rule 8.
 */

// Matches CSI (\x1b[...) + OSC (\x1b]...\x07 / \x1b\\) + simple ESC sequences.
const ANSI_RE =
	// eslint-disable-next-line no-control-regex
	/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07\x1B]*(?:\x07|\x1B\\))/g;

export function stripAnsi(input: string): string {
	if (!input) return input;
	return input.replace(ANSI_RE, "");
}
