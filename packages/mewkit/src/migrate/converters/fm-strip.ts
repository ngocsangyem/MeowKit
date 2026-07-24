// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/fm-strip.ts
export function buildMergedAgentsMd(sections: string[], providerName: string): string {
	// No provenance header: generated files must stay free of toolkit branding.
	const header = `# Agents\n\n> Target: ${providerName}\n\n`;
	return header + sections.join("\n---\n\n");
}
