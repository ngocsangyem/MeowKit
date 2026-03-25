import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";

type Status = "pass" | "fail" | "warn";

interface DiagResult {
  name: string;
  status: Status;
  detail: string;
}

function statusIcon(status: Status): string {
  switch (status) {
    case "pass":
      return pc.green("PASS");
    case "fail":
      return pc.red("FAIL");
    case "warn":
      return pc.yellow("WARN");
  }
}

function checkNodeVersion(): DiagResult {
  const major = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (major >= 20) {
    return {
      name: "Node.js >= 20",
      status: "pass",
      detail: `v${process.versions.node}`,
    };
  }
  return {
    name: "Node.js >= 20",
    status: "fail",
    detail: `v${process.versions.node} — Node 20+ is required`,
  };
}

function checkPython(): DiagResult {
  const commands = ["python3 --version", "python --version"];
  for (const cmd of commands) {
    try {
      const output = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      const match = output.match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1] ?? "0", 10);
        const minor = parseInt(match[2] ?? "0", 10);
        if (major >= 3 && minor >= 9) {
          return { name: "Python 3.9+", status: "pass", detail: output };
        }
        return {
          name: "Python 3.9+",
          status: "fail",
          detail: `${output} — Python 3.9+ is required`,
        };
      }
    } catch {
      // Try next command
    }
  }
  return {
    name: "Python 3.9+",
    status: "warn",
    detail: "Python not found in PATH",
  };
}

function checkGit(): DiagResult {
  try {
    const output = execSync("git --version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return { name: "Git available", status: "pass", detail: output };
  } catch {
    return {
      name: "Git available",
      status: "fail",
      detail: "git not found in PATH",
    };
  }
}

function findMeowkitDir(): string | null {
  let current = process.cwd();
  while (true) {
    const candidate = path.join(current, ".claude");
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

function checkMeowkitDir(): DiagResult {
  const dir = findMeowkitDir();
  if (dir) {
    return {
      name: ".claude/ exists",
      status: "pass",
      detail: dir,
    };
  }
  return {
    name: ".claude/ exists",
    status: "fail",
    detail: "Not found in current or parent directories",
  };
}

function checkHooksExecutable(): DiagResult {
  const meowkitDir = findMeowkitDir();
  if (!meowkitDir) {
    return {
      name: "Hooks executable",
      status: "warn",
      detail: "Skipped — no .claude/ found",
    };
  }

  const hooksDir = path.join(meowkitDir, "hooks");
  if (!fs.existsSync(hooksDir)) {
    return {
      name: "Hooks executable",
      status: "warn",
      detail: "No hooks/ directory",
    };
  }

  const hooks = fs.readdirSync(hooksDir).filter((f) => !f.startsWith("."));
  if (hooks.length === 0) {
    return {
      name: "Hooks executable",
      status: "warn",
      detail: "No hook files found",
    };
  }

  const nonExecutable: string[] = [];
  for (const hook of hooks) {
    try {
      fs.accessSync(path.join(hooksDir, hook), fs.constants.X_OK);
    } catch {
      nonExecutable.push(hook);
    }
  }

  if (nonExecutable.length === 0) {
    return {
      name: "Hooks executable",
      status: "pass",
      detail: `${hooks.length} hook(s) are executable`,
    };
  }

  return {
    name: "Hooks executable",
    status: "fail",
    detail: `Not executable: ${nonExecutable.join(", ")}`,
  };
}

function checkMemoryWritable(): DiagResult {
  const meowkitDir = findMeowkitDir();
  if (!meowkitDir) {
    return {
      name: "Memory writable",
      status: "warn",
      detail: "Skipped — no .claude/ found",
    };
  }

  const memoryDir = path.join(meowkitDir, "memory");
  if (!fs.existsSync(memoryDir)) {
    return {
      name: "Memory writable",
      status: "warn",
      detail: "memory/ directory does not exist",
    };
  }

  try {
    const testFile = path.join(memoryDir, ".doctor-write-test");
    fs.writeFileSync(testFile, "test", "utf-8");
    fs.unlinkSync(testFile);
    return {
      name: "Memory writable",
      status: "pass",
      detail: memoryDir,
    };
  } catch {
    return {
      name: "Memory writable",
      status: "fail",
      detail: `${memoryDir} is not writable`,
    };
  }
}

export async function doctor(): Promise<void> {
  console.log(pc.bold(pc.cyan("MeowKit Doctor")));
  console.log(pc.dim("Diagnosing common issues..."));
  console.log();

  const results: DiagResult[] = [
    checkNodeVersion(),
    checkPython(),
    checkGit(),
    checkMeowkitDir(),
    checkHooksExecutable(),
    checkMemoryWritable(),
  ];

  for (const result of results) {
    console.log(`  [${statusIcon(result.status)}] ${result.name}`);
    console.log(`         ${pc.dim(result.detail)}`);
  }

  console.log();

  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warn").length;

  const parts: string[] = [];
  parts.push(pc.green(`${passCount} passed`));
  if (warnCount > 0) parts.push(pc.yellow(`${warnCount} warnings`));
  if (failCount > 0) parts.push(pc.red(`${failCount} failed`));

  console.log(parts.join(", "));

  if (failCount > 0) {
    process.exit(1);
  }
}
