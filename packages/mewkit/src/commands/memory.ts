import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import pc from "picocolors";

interface MemoryArgs {
  clear?: boolean;
  show?: boolean;
  stats?: boolean;
}

interface PatternEntry {
  timestamp?: string;
  [key: string]: unknown;
}

function findMemoryDir(): string | null {
  let current = process.cwd();
  while (true) {
    const candidate = path.join(current, ".claude", "memory");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function clearMemory(memoryDir: string): Promise<void> {
  const confirmed = await promptConfirmation(
    pc.yellow("This will clear all learned patterns and lessons. Continue? (y/N) ")
  );

  if (!confirmed) {
    console.log(pc.dim("Aborted."));
    return;
  }

  const patternsPath = path.join(memoryDir, "patterns.json");
  const lessonsPath = path.join(memoryDir, "lessons.md");

  if (fs.existsSync(patternsPath)) {
    fs.writeFileSync(patternsPath, "[]", "utf-8");
    console.log(`  ${pc.green("Cleared")} patterns.json`);
  }

  if (fs.existsSync(lessonsPath)) {
    fs.writeFileSync(lessonsPath, "", "utf-8");
    console.log(`  ${pc.green("Cleared")} lessons.md`);
  }

  console.log();
  console.log(pc.green("Memory cleared."));
}

function showLessons(memoryDir: string): void {
  const lessonsPath = path.join(memoryDir, "lessons.md");

  if (!fs.existsSync(lessonsPath)) {
    console.log(pc.dim("No lessons.md file found."));
    return;
  }

  const content = fs.readFileSync(lessonsPath, "utf-8");

  if (content.trim().length === 0) {
    console.log(pc.dim("lessons.md is empty."));
    return;
  }

  console.log(pc.bold("Lessons:"));
  console.log();
  console.log(content);
}

function showStats(memoryDir: string): void {
  const patternsPath = path.join(memoryDir, "patterns.json");
  const lessonsPath = path.join(memoryDir, "lessons.md");

  let sessionsCount = 0;
  let patternsCount = 0;
  let lastUpdated = "unknown";

  if (fs.existsSync(patternsPath)) {
    try {
      const content = fs.readFileSync(patternsPath, "utf-8");
      const patterns = JSON.parse(content) as PatternEntry[];
      patternsCount = patterns.length;

      // Find latest timestamp
      for (const p of patterns) {
        if (p.timestamp && p.timestamp > lastUpdated) {
          lastUpdated = p.timestamp;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  if (fs.existsSync(lessonsPath)) {
    const content = fs.readFileSync(lessonsPath, "utf-8");
    // Count sessions by counting level-2 headings or non-empty sections
    const headings = content.match(/^## /gm);
    sessionsCount = headings ? headings.length : 0;
  }

  // Check file modification time as fallback for last updated
  if (lastUpdated === "unknown") {
    const files = [patternsPath, lessonsPath].filter((f) => fs.existsSync(f));
    for (const file of files) {
      const stat = fs.statSync(file);
      const mtime = stat.mtime.toISOString();
      if (mtime > lastUpdated || lastUpdated === "unknown") {
        lastUpdated = mtime;
      }
    }
  }

  console.log(pc.bold("Memory Stats:"));
  console.log(`  ${pc.dim("Sessions captured:")} ${pc.cyan(String(sessionsCount))}`);
  console.log(`  ${pc.dim("Patterns learned:")}  ${pc.cyan(String(patternsCount))}`);
  console.log(`  ${pc.dim("Last updated:")}      ${pc.cyan(lastUpdated === "unknown" ? "never" : lastUpdated)}`);
}

function showSummary(memoryDir: string): void {
  const patternsPath = path.join(memoryDir, "patterns.json");
  const lessonsPath = path.join(memoryDir, "lessons.md");

  console.log(pc.bold("Memory Summary:"));
  console.log();

  if (fs.existsSync(lessonsPath)) {
    const content = fs.readFileSync(lessonsPath, "utf-8");
    const lineCount = content.trim().length === 0 ? 0 : content.split("\n").length;
    console.log(`  ${pc.dim("lessons.md:")}     ${pc.cyan(`${lineCount} lines`)}`);
  } else {
    console.log(`  ${pc.dim("lessons.md:")}     ${pc.yellow("not found")}`);
  }

  if (fs.existsSync(patternsPath)) {
    try {
      const content = fs.readFileSync(patternsPath, "utf-8");
      const patterns = JSON.parse(content) as PatternEntry[];
      console.log(`  ${pc.dim("patterns.json:")} ${pc.cyan(`${patterns.length} entries`)}`);
    } catch {
      console.log(`  ${pc.dim("patterns.json:")} ${pc.red("invalid JSON")}`);
    }
  } else {
    console.log(`  ${pc.dim("patterns.json:")} ${pc.yellow("not found")}`);
  }
}

export async function memory(args: MemoryArgs): Promise<void> {
  console.log(pc.bold(pc.cyan("Agent Memory")));
  console.log();

  const memoryDir = findMemoryDir();

  if (!memoryDir) {
    console.error(pc.red("Could not find .claude/memory/ directory."));
    process.exit(1);
  }

  console.log(`${pc.dim("Location:")} ${memoryDir}`);
  console.log();

  if (args.clear) {
    await clearMemory(memoryDir);
  } else if (args.show) {
    showLessons(memoryDir);
  } else if (args.stats) {
    showStats(memoryDir);
  } else {
    showSummary(memoryDir);
  }
}
