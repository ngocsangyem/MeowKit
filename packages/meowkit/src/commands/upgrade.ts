import { execSync } from "node:child_process";
import pc from "picocolors";

interface RegistryResponse {
  version: string;
}

interface RegistryFullResponse {
  "dist-tags": Record<string, string>;
  versions: Record<string, unknown>;
}

interface UpgradeArgs {
  check?: boolean;
  beta?: boolean;
  list?: boolean;
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

async function fetchVersion(tag: string): Promise<string> {
  const response = await fetch(`https://registry.npmjs.org/create-meowkit/${tag}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${tag} from npm registry: ${response.statusText}`);
  }
  const data = (await response.json()) as RegistryResponse;
  return data.version;
}

async function fetchRegistryInfo(): Promise<RegistryFullResponse> {
  const response = await fetch("https://registry.npmjs.org/create-meowkit");
  if (!response.ok) {
    throw new Error(`Failed to fetch from npm registry: ${response.statusText}`);
  }
  return (await response.json()) as RegistryFullResponse;
}

export async function upgrade(args: UpgradeArgs): Promise<void> {
  const localVersion = getLocalVersion();
  const isBeta = localVersion?.includes("-beta") || localVersion?.includes("-rc");
  console.log(
    `${pc.bold("Current version:")} ${localVersion ? pc.cyan(localVersion) : pc.dim("not installed")}${isBeta ? pc.dim(" (beta)") : ""}`
  );

  // List available versions
  if (args.list) {
    console.log(pc.dim("Fetching available versions..."));
    try {
      const info = await fetchRegistryInfo();
      const tags = info["dist-tags"];
      const versions = Object.keys(info.versions).reverse().slice(0, 10);

      console.log();
      console.log(pc.bold("Channels:"));
      console.log(`  ${pc.green("stable:")}  ${tags.latest ?? "none"}`);
      if (tags.beta) {
        console.log(`  ${pc.yellow("beta:")}    ${tags.beta}`);
      }

      console.log();
      console.log(pc.bold("Recent versions:"));
      for (const v of versions) {
        const marker = v === localVersion ? pc.cyan(" (installed)") : "";
        console.log(`  ${v}${marker}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.red(`Failed to list versions: ${message}`));
    }
    return;
  }

  // Check for updates
  if (args.check) {
    console.log(pc.dim("Checking for updates..."));
    try {
      const latest = await fetchVersion("latest");
      console.log(`${pc.bold("Latest stable:")}  ${pc.green(latest)}`);

      try {
        const beta = await fetchVersion("beta");
        console.log(`${pc.bold("Latest beta:")}    ${pc.yellow(beta)}`);
      } catch {
        // No beta published yet — skip
      }

      if (localVersion === latest) {
        console.log(pc.green("You are on the latest stable version."));
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

  // Perform upgrade
  const tag = args.beta ? "beta" : "latest";
  const pkg = `create-meowkit@${tag}`;

  console.log(pc.dim(`Installing ${pkg}...`));

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
