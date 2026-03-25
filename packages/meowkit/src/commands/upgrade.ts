import { execSync } from "node:child_process";
import pc from "picocolors";

interface RegistryResponse {
  version: string;
}

interface UpgradeArgs {
  check?: boolean;
  beta?: boolean;
}

function getLocalVersion(): string | null {
  try {
    const output = execSync("npm list -g create-meowkit --json 2>/dev/null", {
      encoding: "utf-8",
    });
    const parsed = JSON.parse(output) as { dependencies?: { "create-meowkit"?: { version?: string } } };
    return parsed.dependencies?.["create-meowkit"]?.version ?? null;
  } catch {
    return null;
  }
}

async function fetchLatestVersion(): Promise<string> {
  const response = await fetch("https://registry.npmjs.org/create-meowkit/latest");
  if (!response.ok) {
    throw new Error(`Failed to fetch from npm registry: ${response.statusText}`);
  }
  const data = (await response.json()) as RegistryResponse;
  return data.version;
}

export async function upgrade(args: UpgradeArgs): Promise<void> {
  const localVersion = getLocalVersion();
  console.log(
    `${pc.bold("Current version:")} ${localVersion ? pc.cyan(localVersion) : pc.dim("not installed")}`
  );

  if (args.check) {
    console.log(`${pc.dim("Checking for updates...")}`);
    try {
      const latest = await fetchLatestVersion();
      console.log(`${pc.bold("Latest version:")}  ${pc.green(latest)}`);

      if (localVersion === latest) {
        console.log(pc.green("You are on the latest version."));
      } else {
        console.log(
          pc.yellow(`Update available: ${localVersion ?? "none"} -> ${latest}`)
        );
        console.log(pc.dim("Run `meowkit upgrade` to install."));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Failed to check for updates: ${message}`));
    }
    return;
  }

  const tag = args.beta ? "beta" : "latest";
  const pkg = `create-meowkit@${tag}`;

  console.log(`${pc.dim(`Installing ${pkg}...`)}`);

  try {
    execSync(`npm install -g ${pkg}`, {
      encoding: "utf-8",
      stdio: "inherit",
    });

    const newVersion = getLocalVersion();
    console.log();
    console.log(pc.green(pc.bold("Upgrade complete!")));
    console.log(
      `  ${pc.dim("Before:")} ${localVersion ?? "not installed"}`
    );
    console.log(
      `  ${pc.dim("After:")}  ${newVersion ?? "unknown"}`
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`Upgrade failed: ${message}`));
    process.exit(1);
  }
}
