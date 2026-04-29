// Vendored from claudekit-cli (MIT). Source: src/commands/portable/converters/skill-md.ts
// Adapted: replaced gray-matter.stringify with js-yaml (mewkit doesn't carry gray-matter).
import yaml from "js-yaml";
import type { ConversionResult, PortableItem } from "../types.js";

export function convertToSkillMd(item: PortableItem): ConversionResult {
	const fm: Record<string, unknown> = {
		name: item.frontmatter.name || item.name,
		description: item.description || "",
	};

	const yamlBlock = yaml.dump(fm, { lineWidth: -1 }).trimEnd();
	const body = `# ${fm.name}\n\n${item.body}`;
	const content = `---\n${yamlBlock}\n---\n${body}\n`;

	return {
		content,
		filename: `${item.name}/SKILL.md`,
		warnings: [],
	};
}
