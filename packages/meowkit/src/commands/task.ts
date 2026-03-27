import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

// ── Types ────────────────────────────────────────────────────────────────────

type TaskType = "feature" | "bug-fix" | "refactor" | "security";

interface TaskNewArgs {
  type?: TaskType;
  priority?: string;
  description: string;
}

interface TaskListArgs {
  all?: boolean;
  status?: string;
}

interface TaskFrontmatter {
  title?: string;
  type?: string;
  status?: string;
  priority?: string;
  created?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format today as YYMMDD */
function todayYYMMDD(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** Format today as YYYY-MM-DD for frontmatter */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Convert description to kebab-case slug */
function toKebab(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/** Walk up from cwd looking for tasks/active/ directory */
function findTasksDir(): string | null {
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
function findTasksRoot(): string | null {
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
function parseFrontmatter(content: string): TaskFrontmatter {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) return {};

  const result: TaskFrontmatter = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (key === "title") result.title = val;
    else if (key === "type") result.type = val;
    else if (key === "status") result.status = val;
    else if (key === "priority") result.priority = val;
    else if (key === "created") result.created = val;
  }
  return result;
}

/** Walk a directory recursively collecting .md file paths */
function collectMdFiles(dir: string): string[] {
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
function typeSuffix(type: TaskType): string {
  const map: Record<TaskType, string> = {
    feature: "feature",
    "bug-fix": "bug",
    refactor: "refactor",
    security: "security",
  };
  return map[type];
}

/** Read template content from .claude/tasks/templates/ relative to project root */
function readTemplate(type: TaskType, projectRoot: string): string | null {
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
function findProjectRoot(): string {
  let current = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(current, "tasks"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return process.cwd();
    current = parent;
  }
}

// ── Table helpers ────────────────────────────────────────────────────────────

function padEnd(str: string, len: number): string {
  const s = str ?? "";
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function statusColor(status: string): string {
  switch (status) {
    case "done": return pc.green(padEnd(status, 12));
    case "in-progress": return pc.cyan(padEnd(status, 12));
    case "blocked": return pc.red(padEnd(status, 12));
    case "review": return pc.yellow(padEnd(status, 12));
    default: return pc.dim(padEnd(status, 12));
  }
}

function priorityColor(priority: string): string {
  switch (priority) {
    case "high": return pc.red(padEnd(priority, 8));
    case "medium": return pc.yellow(padEnd(priority, 8));
    case "low": return pc.dim(padEnd(priority, 8));
    default: return pc.dim(padEnd(priority, 8));
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

/** meowkit task new --type feature "description" */
function taskNew(args: TaskNewArgs): void {
  const type: TaskType = (args.type as TaskType) ?? "feature";
  const validTypes: TaskType[] = ["feature", "bug-fix", "refactor", "security"];
  if (!validTypes.includes(type)) {
    console.error(pc.red(`Invalid --type "${type}". Must be one of: ${validTypes.join(", ")}`));
    process.exit(1);
  }

  const description = args.description.trim();
  if (!description) {
    console.error(pc.red("Description is required. Usage: meowkit task new [--type feature] \"description\""));
    process.exit(1);
  }

  // Resolve destination directory — create tasks/active/ if it doesn't exist
  let activeDir = findTasksDir();
  if (!activeDir) {
    // Create tasks/active/ under cwd
    activeDir = path.join(process.cwd(), "tasks", "active");
    fs.mkdirSync(activeDir, { recursive: true });
  }

  const slug = toKebab(description);
  const suffix = typeSuffix(type);
  const filename = `${todayYYMMDD()}-${slug}.${suffix}.md`;
  const destPath = path.join(activeDir, filename);

  if (fs.existsSync(destPath)) {
    console.error(pc.red(`File already exists: ${destPath}`));
    process.exit(1);
  }

  // Build frontmatter with filled-in values
  const priority = args.priority ?? "medium";
  const frontmatter = [
    "---",
    `title: "${description}"`,
    `type: ${type}`,
    `status: draft`,
    `phase: 1`,
    `priority: ${priority}`,
    `effort: medium`,
    `created: ${todayISO()}`,
    `branch: ${suffix}/${slug}`,
    `agent: ""`,
    "---",
    "",
  ].join("\n");

  // Try to get template body (everything after the frontmatter)
  const projectRoot = findProjectRoot();
  const templateContent = readTemplate(type, projectRoot);

  let body = "";
  if (templateContent) {
    // Strip template frontmatter, keep body
    const bodyMatch = /^---\n[\s\S]*?\n---\n([\s\S]*)/.exec(templateContent);
    body = bodyMatch ? bodyMatch[1] : templateContent;
  } else {
    body = `\n# ${description}\n\n<!-- Fill in sections from the template -->\n\n## Agent State\n\nCurrent phase: 1 — Planning\nLast action: Task file created\nNext action: Get Gate 1 approval before writing any tests or code\nBlockers: none\nDecisions made: none yet\n`;
  }

  fs.writeFileSync(destPath, frontmatter + body, "utf-8");

  console.log(`\n  ${pc.green("✓")} Created: ${pc.bold(destPath)}\n`);
}

/** meowkit task list [--all] [--status done] */
function taskList(args: TaskListArgs): void {
  const root = args.all ? findTasksRoot() : findTasksDir();

  if (!root) {
    console.log(pc.dim("\n  No tasks/ directory found. Run from a MeowKit project.\n"));
    return;
  }

  const files = collectMdFiles(root);

  if (files.length === 0) {
    console.log(pc.dim(`\n  No task files found in ${root}\n`));
    return;
  }

  // Parse frontmatter from each file
  interface TaskRow {
    status: string;
    type: string;
    priority: string;
    title: string;
    relPath: string;
  }

  const rows: TaskRow[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const fm = parseFrontmatter(content);
    const status = fm.status ?? "unknown";

    if (args.status && status !== args.status) continue;

    rows.push({
      status,
      type: fm.type ?? "unknown",
      priority: fm.priority ?? "medium",
      title: fm.title ?? path.basename(file, ".md"),
      relPath: path.relative(process.cwd(), file),
    });
  }

  if (rows.length === 0) {
    console.log(pc.dim(`\n  No tasks with status "${args.status ?? "any"}"\n`));
    return;
  }

  const header =
    `  ${pc.bold(padEnd("Status", 12))}` +
    `${pc.bold(padEnd("Type", 14))}` +
    `${pc.bold(padEnd("Priority", 8))}` +
    `  ${pc.bold(padEnd("Title", 40))}` +
    `  ${pc.bold("Path")}`;

  const divider = "  " + "─".repeat(100);

  console.log(`\n${header}`);
  console.log(divider);

  for (const row of rows) {
    const line =
      `  ${statusColor(row.status)}` +
      `${pc.dim(padEnd(row.type, 14))}` +
      `${priorityColor(row.priority)}` +
      `  ${padEnd(row.title, 40)}` +
      `  ${pc.dim(row.relPath)}`;
    console.log(line);
  }

  console.log(`\n  ${pc.dim(`${rows.length} task${rows.length === 1 ? "" : "s"} found`)}\n`);
}

// ── Public entrypoint ─────────────────────────────────────────────────────────

export interface TaskArgs {
  subcommand?: string;
  type?: string;
  priority?: string;
  all?: boolean;
  status?: string;
  description?: string;
}

export function task(args: TaskArgs): void {
  const sub = args.subcommand;

  switch (sub) {
    case "new":
      taskNew({
        type: args.type as TaskType | undefined,
        priority: args.priority,
        description: args.description ?? "",
      });
      break;

    case "list":
      taskList({
        all: args.all,
        status: args.status,
      });
      break;

    default: {
      console.log(`
${pc.bold("meowkit task")} — Manage task files

${pc.bold("Usage:")}
  meowkit task new [--type feature|bug-fix|refactor|security] [--priority high|medium|low] "description"
  meowkit task list [--all] [--status draft|in-progress|blocked|review|done]

${pc.bold("Examples:")}
  meowkit task new "Add user authentication"
  meowkit task new --type bug-fix --priority high "Fix null session crash"
  meowkit task list
  meowkit task list --all --status in-progress
`);
    }
  }
}
