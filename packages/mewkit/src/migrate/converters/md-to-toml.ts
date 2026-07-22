// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/md-to-toml.ts
// Only `escapeTomlMultiline` remains in use — shared by the Codex TOML converter
// (`fm-to-codex-toml.ts`) for escaping multiline TOML string blocks.
export function escapeTomlMultiline(str: string): string {
	let escaped = str.replace(/\\/g, "\\\\");
	escaped = escaped.replace(/"""/g, '""\\"');
	if (escaped.endsWith('"')) escaped += "\n";
	return escaped;
}
