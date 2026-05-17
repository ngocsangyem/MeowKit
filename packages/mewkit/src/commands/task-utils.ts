import fs from "node:fs";
import path from "node:path";

export type TaskType = "feature" | "bug-fix" | "refactor" | "security";

export interface TaskFrontmatter {
	title?: string;
	type?: string;
	status?: string;
	priority?: string;
	created?: string;
}

/** Format today as YYMMDD */
export function todayYYMMDD(): string {
	const d = new Date();
	const yy = String(d.getFullYear()).slice(2);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yy}${mm}${dd}`;
}

/** Format today as YYYY-MM-DD for frontmatter */
export function todayISO(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Convert description to kebab-case slug */
export function toKebab(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.slice(0, 60);
}

/** Walk up from cwd looking for tasks/active/ directory */
export function findTasksDir(): string | null {
	let current = process.cwd();
	while (true) {
		const candidate = path.join(current, "tasks", "active");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
			return candidate;
		}
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

/** Walk up from cwd looking for tasks/ root (for --all scan) */
export function findTasksRoot(): string | null {
	let current = process.cwd();
	while (true) {
		const candidate = path.join(current, "tasks");
		if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
			return candidate;
		}
		const parent = path.dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}

/** Parse YAML-style frontmatter between --- fences */
export function parseFrontmatter(content: string): TaskFrontmatter {
	const match = /^---\n([\s\S]*?)\n---/.exec(content);
	if (!match) return {};

	const result: TaskFrontmatter = {};
	for (const line of match[1].split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const val = line
			.slice(colonIdx + 1)
			.trim()
			.replace(/^"(.*)"$/, "$1");
		if (key === "title") result.title = val;
		else if (key === "type") result.type = val;
		else if (key === "status") result.status = val;
		else if (key === "priority") result.priority = val;
		else if (key === "created") result.created = val;
	}
	return result;
}

/** Walk a directory recursively collecting .md file paths */
export function collectMdFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...collectMdFiles(full));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(full);
		}
	}
	return results;
}

/** Map template type to file suffix used in naming */
export function typeSuffix(type: TaskType): string {
	const map: Record<TaskType, string> = {
		feature: "feature",
		"bug-fix": "bug",
		refactor: "refactor",
		security: "security",
	};
	return map[type];
}

/** Read template content from .claude/tasks/templates/ relative to project root */
export function readTemplate(type: TaskType, projectRoot: string): string | null {
	const templateNames: Record<TaskType, string> = {
		feature: "feature-implementation.md",
		"bug-fix": "bug-fix.md",
		refactor: "refactor.md",
		security: "security-audit.md",
	};

	// Look in .claude/tasks/templates/ or tasks/templates/ under project root
	const candidates = [
		path.join(projectRoot, ".claude", "tasks", "templates", templateNames[type]),
		path.join(projectRoot, "tasks", "templates", templateNames[type]),
		path.join(projectRoot, "system", "tasks", "templates", templateNames[type]),
	];

	for (const p of candidates) {
		if (fs.existsSync(p)) {
			return fs.readFileSync(p, "utf-8");
		}
	}
	return null;
}

/** Find project root by looking for tasks/ directory */
export function findProjectRoot(): string {
	let current = process.cwd();
	while (true) {
		if (fs.existsSync(path.join(current, "tasks"))) return current;
		const parent = path.dirname(current);
		if (parent === current) return process.cwd();
		current = parent;
	}
}
