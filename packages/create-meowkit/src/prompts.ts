import * as p from "@clack/prompts";
import pc from "picocolors";
import type { DetectedStack } from "./detect-stack.js";

export interface UserConfig {
  projectName: string;
  stack: string[];
  teamSize: "solo" | "small" | "team";
  primaryTool: "claude-code" | "antigravity" | "both";
  defaultMode: "fast" | "balanced" | "strict";
  enableCostTracking: boolean;
  enableMemory: boolean;
  geminiApiKey: string | null;
}

function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

function handleCancel(value: unknown): void {
  if (isCancel(value)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
}

export async function promptUser(detected: DetectedStack): Promise<UserConfig> {
  p.intro(pc.bgCyan(pc.black(" create-meowkit ")));

  // Show detected stack info
  if (detected.type !== "unknown") {
    p.note(
      [
        `Type: ${pc.bold(detected.type)}`,
        detected.frameworks.length > 0
          ? `Frameworks: ${pc.bold(detected.frameworks.join(", "))}`
          : null,
        detected.isMonorepo ? `Monorepo: ${pc.bold("yes")}` : null,
        `Confidence: ${pc.bold(`${Math.round(detected.confidence * 100)}%`)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      "Detected Stack"
    );
  }

  // Project name
  const projectName = await p.text({
    message: "What is your project name?",
    placeholder: "my-project",
    validate(value) {
      if (!value || value.trim().length === 0) {
        return "Project name is required";
      }
      if (!/^[a-zA-Z0-9_@/.-]+$/.test(value)) {
        return "Project name contains invalid characters";
      }
      return undefined;
    },
  });
  handleCancel(projectName);

  // Stack selection (pre-select detected frameworks)
  const stackOptions = [
    { value: "node", label: "Node.js / TypeScript" },
    { value: "python", label: "Python" },
    { value: "go", label: "Go" },
    { value: "swift", label: "Swift / iOS" },
    { value: "react", label: "React" },
    { value: "vue", label: "Vue" },
    { value: "nextjs", label: "Next.js" },
    { value: "nestjs", label: "NestJS" },
    { value: "django", label: "Django" },
    { value: "fastapi", label: "FastAPI" },
    { value: "express", label: "Express" },
  ];

  const detectedValues = new Set<string>();
  if (detected.type !== "unknown" && detected.type !== "monorepo") {
    detectedValues.add(detected.type);
  }
  for (const fw of detected.frameworks) {
    detectedValues.add(fw);
  }

  const stack = await p.multiselect({
    message: "Select your tech stack (space to toggle, enter to confirm)",
    options: stackOptions,
    initialValues: stackOptions
      .filter((opt) => detectedValues.has(opt.value))
      .map((opt) => opt.value),
    required: true,
  });
  handleCancel(stack);

  // Team size
  const teamSize = await p.select({
    message: "What is your team size?",
    options: [
      { value: "solo" as const, label: "Solo", hint: "just me" },
      { value: "small" as const, label: "Small team", hint: "2-5 people" },
      { value: "team" as const, label: "Team", hint: "6+ people" },
    ],
  });
  handleCancel(teamSize);

  // Primary tool
  const primaryTool = await p.select({
    message: "Which AI coding tool do you primarily use?",
    options: [
      { value: "claude-code" as const, label: "Claude Code", hint: "Anthropic CLI" },
      { value: "antigravity" as const, label: "Antigravity", hint: "VS Code extension" },
      { value: "both" as const, label: "Both", hint: "generate configs for both" },
    ],
  });
  handleCancel(primaryTool);

  // Default mode
  const defaultMode = await p.select({
    message: "Default operating mode?",
    options: [
      {
        value: "fast" as const,
        label: "Fast",
        hint: "minimal checks, quick iteration",
      },
      {
        value: "balanced" as const,
        label: "Balanced",
        hint: "recommended for most projects",
      },
      {
        value: "strict" as const,
        label: "Strict",
        hint: "thorough checks, CI-grade quality",
      },
    ],
    initialValue: "balanced" as const,
  });
  handleCancel(defaultMode);

  // Cost tracking
  const enableCostTracking = await p.confirm({
    message: "Enable cost tracking?",
    initialValue: true,
  });
  handleCancel(enableCostTracking);

  // Memory / context persistence
  const enableMemory = await p.confirm({
    message: "Enable memory (context persistence across sessions)?",
    initialValue: true,
  });
  handleCancel(enableMemory);

  // Gemini API key (optional — for meow:multimodal skill)
  const geminiApiKey = await p.text({
    message: "Gemini API key (optional — for image/video/audio analysis)",
    placeholder: "Press Enter to skip — add later with GEMINI_API_KEY in .env",
    validate(value) {
      if (!value || value.trim().length === 0) {
        return undefined; // Allow empty (skip)
      }
      if (value.trim().length < 10) {
        return "API key looks too short. Get one at https://aistudio.google.com/apikey";
      }
      return undefined;
    },
  });
  handleCancel(geminiApiKey);

  const geminiKey = typeof geminiApiKey === "string" && geminiApiKey.trim().length > 0
    ? geminiApiKey.trim()
    : null;

  if (geminiKey) {
    p.log.success("Gemini API key will be saved to .env");
  } else {
    p.log.info("Skipped. Add GEMINI_API_KEY to .env when needed.");
  }

  p.outro(pc.green("Configuration complete!"));

  return {
    projectName: projectName as string,
    stack: stack as string[],
    teamSize: teamSize as "solo" | "small" | "team",
    primaryTool: primaryTool as "claude-code" | "antigravity" | "both",
    defaultMode: defaultMode as "fast" | "balanced" | "strict",
    enableCostTracking: enableCostTracking as boolean,
    enableMemory: enableMemory as boolean,
    geminiApiKey: geminiKey,
  };
}
