import * as p from "@clack/prompts";
import pc from "picocolors";

export interface UserConfig {
  description: string;
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

export async function promptUser(): Promise<UserConfig> {
  p.intro(pc.bgCyan(pc.black(" create-meowkit ")));

  // Project description (optional)
  const description = await p.text({
    message: "Describe your project (optional)",
    placeholder: "Press Enter to skip",
    validate() { return undefined; },
  });
  handleCancel(description);

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
    description: typeof description === "string" ? description.trim() : "",
    enableCostTracking: true,
    enableMemory: true,
    geminiApiKey: geminiKey,
  };
}
