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

  // Gemini API key (optional) — ask y/n first, then prompt for key if yes
  const addGeminiKey = await p.confirm({
    message: "Add Gemini API key? (for image/video/audio analysis)",
    initialValue: false,
  });
  handleCancel(addGeminiKey);

  let geminiKey: string | null = null;

  if (addGeminiKey) {
    const geminiApiKey = await p.text({
      message: "Enter your Gemini API key",
      placeholder: "Get one at aistudio.google.com/apikey",
      validate(value: string) {
        if (!value || value.trim().length === 0) return "API key is required";
        if (value.trim().length < 10) return "Key too short. Get one at aistudio.google.com/apikey";
        return undefined;
      },
    });
    handleCancel(geminiApiKey);

    geminiKey = typeof geminiApiKey === "string" ? geminiApiKey.trim() : null;

    if (geminiKey) {
      p.log.success("Gemini API key will be saved to .claude/.env");
    }
  }

  p.outro(pc.green("Configuration complete!"));

  return {
    description: typeof description === "string" ? description.trim() : "",
    enableCostTracking: true,
    enableMemory: true,
    geminiApiKey: geminiKey,
  };
}
