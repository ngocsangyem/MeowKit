import * as p from "@clack/prompts";
import pc from "picocolors";
import type { DetectedStack } from "./detect-stack.js";

export interface UserConfig {
  projectName: string;
  stack: string[];
  teamSize: "solo" | "small" | "team";
  primaryTool: "claude-code";
  defaultMode: "fast" | "balanced" | "strict";
  enableCostTracking: boolean;
  enableMemory: boolean;
  geminiApiKey: string | null;
}

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel("Setup cancelled. No files were created.");
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

  // Project name — only interactive prompt
  const projectName = await p.text({
    message: "What is your project name?",
    placeholder: "my-project",
    validate(value) {
      if (!value || value.trim().length === 0) return "Project name is required";
      if (!/^[a-zA-Z0-9_@/.-]+$/.test(value)) return "Invalid characters";
      return undefined;
    },
  });
  handleCancel(projectName);

  // Auto-detect stack from project (no prompt needed)
  const stack: string[] = [];
  if (detected.type !== "unknown" && detected.type !== "monorepo") {
    stack.push(detected.type);
  }
  for (const fw of detected.frameworks) {
    if (!stack.includes(fw)) stack.push(fw);
  }

  // Gemini API key (optional)
  const geminiApiKey = await p.text({
    message: "Gemini API key (optional — for image/video/audio analysis)",
    placeholder: "Press Enter to skip",
    validate(value) {
      if (!value || value.trim().length === 0) return undefined;
      if (value.trim().length < 10) return "Key too short. Get one at aistudio.google.com/apikey";
      return undefined;
    },
  });
  handleCancel(geminiApiKey);

  const geminiKey = typeof geminiApiKey === "string" && geminiApiKey.trim().length > 0
    ? geminiApiKey.trim()
    : null;

  if (geminiKey) {
    p.log.success("Gemini API key will be saved to .claude/.env");
  }

  p.outro(pc.green("Configuration complete!"));

  return {
    projectName: projectName as string,
    stack,
    teamSize: "solo",
    primaryTool: "claude-code",
    defaultMode: "balanced",
    enableCostTracking: true,
    enableMemory: true,
    geminiApiKey: geminiKey,
  };
}
