import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface DetectedStack {
  type: "node" | "python" | "swift" | "go" | "monorepo" | "unknown";
  frameworks: string[];
  isMonorepo: boolean;
  confidence: number;
}

interface FrameworkSignal {
  name: string;
  weight: number;
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function detectNodeFrameworks(dir: string): FrameworkSignal[] {
  const signals: FrameworkSignal[] = [];
  const pkg = readJsonSafe(join(dir, "package.json"));

  if (!pkg) return signals;

  const deps: Record<string, string> = {
    ...(typeof pkg.dependencies === "object" && pkg.dependencies !== null
      ? (pkg.dependencies as Record<string, string>)
      : {}),
    ...(typeof pkg.devDependencies === "object" && pkg.devDependencies !== null
      ? (pkg.devDependencies as Record<string, string>)
      : {}),
  };

  const frameworkMap: Record<string, string> = {
    "@nestjs/core": "nestjs",
    vue: "vue3",
    react: "react",
    next: "nextjs",
    express: "express",
    fastify: "fastify",
    "@angular/core": "angular",
    svelte: "svelte",
    nuxt: "nuxt",
    "solid-js": "solid",
    hono: "hono",
    elysia: "elysia",
  };

  for (const [dep, framework] of Object.entries(frameworkMap)) {
    if (dep in deps) {
      signals.push({ name: framework, weight: 0.2 });
    }
  }

  return signals;
}

function detectPythonFrameworks(dir: string): FrameworkSignal[] {
  const signals: FrameworkSignal[] = [];

  const pyproject = readFileSafe(join(dir, "pyproject.toml"));
  const requirements = readFileSafe(join(dir, "requirements.txt"));
  const combined = (pyproject ?? "") + (requirements ?? "");

  const frameworkMap: Record<string, string> = {
    django: "django",
    fastapi: "fastapi",
    flask: "flask",
    starlette: "starlette",
    celery: "celery",
    pytest: "pytest",
  };

  for (const [dep, framework] of Object.entries(frameworkMap)) {
    if (combined.toLowerCase().includes(dep)) {
      signals.push({ name: framework, weight: 0.15 });
    }
  }

  return signals;
}

function detectMonorepo(dir: string): { detected: boolean; signals: number } {
  let signals = 0;

  if (existsSync(join(dir, "turbo.json"))) signals++;
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) signals++;
  if (existsSync(join(dir, "lerna.json"))) signals++;
  if (existsSync(join(dir, "nx.json"))) signals++;

  const pkg = readJsonSafe(join(dir, "package.json"));
  if (pkg && Array.isArray(pkg.workspaces)) signals++;

  return { detected: signals > 0, signals };
}

function hasXcodeProject(dir: string): boolean {
  try {
    const entries = readdirSync(dir);
    return entries.some(
      (e) => e.endsWith(".xcodeproj") || e.endsWith(".xcworkspace")
    );
  } catch {
    return false;
  }
}

export function detectStack(dir: string): DetectedStack {
  const result: DetectedStack = {
    type: "unknown",
    frameworks: [],
    isMonorepo: false,
    confidence: 0,
  };

  let signalCount = 0;
  const maxSignals = 5;

  // Monorepo detection (takes priority)
  const mono = detectMonorepo(dir);
  if (mono.detected) {
    result.isMonorepo = true;
    signalCount += mono.signals;
  }

  // Node detection
  const hasPackageJson = existsSync(join(dir, "package.json"));
  if (hasPackageJson) {
    signalCount++;
    result.type = "node";

    const nodeFrameworks = detectNodeFrameworks(dir);
    for (const fw of nodeFrameworks) {
      result.frameworks.push(fw.name);
      signalCount += fw.weight * 5; // normalize to signal scale
    }
  }

  // Python detection
  const hasPyproject = existsSync(join(dir, "pyproject.toml"));
  const hasRequirements = existsSync(join(dir, "requirements.txt"));
  if (hasPyproject || hasRequirements) {
    signalCount++;
    if (result.type === "unknown") result.type = "python";

    const pyFrameworks = detectPythonFrameworks(dir);
    for (const fw of pyFrameworks) {
      result.frameworks.push(fw.name);
      signalCount += fw.weight * 5;
    }
  }

  // Go detection
  if (existsSync(join(dir, "go.mod"))) {
    signalCount++;
    if (result.type === "unknown") result.type = "go";
  }

  // Swift detection
  const hasSwiftPackage = existsSync(join(dir, "Package.swift"));
  const hasXcode = hasXcodeProject(dir);
  if (hasSwiftPackage || hasXcode) {
    signalCount++;
    if (hasSwiftPackage) signalCount++;
    if (result.type === "unknown") result.type = "swift";
  }

  // Monorepo overrides type if detected
  if (result.isMonorepo) {
    result.type = "monorepo";
  }

  // Calculate confidence (capped at 1.0)
  result.confidence = Math.min(signalCount / maxSignals, 1);

  return result;
}
