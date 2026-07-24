# Specialized Workflows

Routes for upstream agent-browser skills that should not be missed:

- `dogfood`
- `electron`
- `slack`
- `vercel-sandbox`
- `agentcore`

Read this file when the task goes beyond ordinary web-page navigation.

## Dogfood / Exploratory QA

Use for: "dogfood", QA, exploratory test, find issues, bug hunt, test this app/site/platform, review app quality.

Workflow:

1. Create output dirs: `dogfood-output/screenshots` and `dogfood-output/videos`.
2. Copy [../templates/dogfood-report-template.md](../templates/dogfood-report-template.md) into `dogfood-output/report.md`.
3. Start a named session: `agent-browser --session <session> open <target-url>`.
4. Authenticate only when needed. Save state if useful.
5. Read [dogfood-issue-taxonomy.md](dogfood-issue-taxonomy.md).
6. Explore top-level navigation, forms, modals, empty/error/loading states, console, network failures.
7. Document each issue immediately. Do not batch findings at the end.
8. For interactive bugs, record repro video plus step screenshots. For static visible-on-load issues, one annotated screenshot is enough.
9. Update severity counts, close the session, and summarize findings.

Rules:

- Findings must come from browser-observed behavior, not source-code reading.
- Verify reproducibility before collecting final evidence.
- Never delete output files mid-session.
- Prefer 5-10 well-documented issues over many vague notes.

## Electron Apps

Use for: VS Code, Slack desktop, Discord, Figma desktop, Notion, Spotify, Postman, GitHub Desktop, or other Electron apps.

Workflow:

```bash
open -a "Slack" --args --remote-debugging-port=9222
agent-browser connect 9222
agent-browser snapshot -i
agent-browser click @e5
agent-browser screenshot app-state.png
```

Patterns:

- Quit an already-running app before relaunching with `--remote-debugging-port`.
- Use unique ports for multiple apps.
- Run `agent-browser tab` to list Electron windows/webviews.
- Switch tabs/webviews before interacting, then re-snapshot.
- For custom inputs, try `keyboard type` or `keyboard inserttext`.
- Preserve dark mode with `--color-scheme dark` or `AGENT_BROWSER_COLOR_SCHEME=dark`.

Common macOS launch examples:

```bash
open -a "Slack" --args --remote-debugging-port=9222
open -a "Visual Studio Code" --args --remote-debugging-port=9223
open -a "Discord" --args --remote-debugging-port=9224
open -a "Figma" --args --remote-debugging-port=9225
```

## Slack

Use for: checking Slack, unread channels, DMs, sending/searching/extracting messages, finding who said something, documenting workspace state.

Start:

```bash
agent-browser connect 9222
# or
agent-browser open https://app.slack.com
agent-browser snapshot -i
```

Then read [slack-workflows.md](slack-workflows.md).

Rules:

- Prefer connecting to an existing logged-in Slack session.
- Re-snapshot after switching channels, tabs, or expanding sidebar sections.
- Use screenshots for evidence. Use [../templates/slack-report-template.md](../templates/slack-report-template.md) for structured summaries.
- This is browser automation, not Slack API automation. Do not assume bot/OAuth/webhook access.
- Rate-limit yourself with short waits between rapid interactions.

## Vercel Sandbox

Use for: running agent-browser + Chrome inside Vercel Sandbox microVMs from a Vercel-deployed app, avoiding Chrome binary limits, or needing ephemeral isolated browser environments.

Dependencies:

```bash
pnpm add @agent-browser/sandbox @vercel/sandbox
```

Core TypeScript pattern:

```ts
import {
  createAgentBrowserSnapshot,
  runAgentBrowserCommand,
  withAgentBrowserSandbox,
  type VercelSandboxSession,
} from "@agent-browser/sandbox/vercel";

async function withBrowser<T>(
  fn: (sandbox: VercelSandboxSession) => Promise<T>,
): Promise<T> {
  return withAgentBrowserSandbox(fn);
}
```

Command pattern:

```ts
await runAgentBrowserCommand(sandbox, ["open", url]);
const snap = await runAgentBrowserCommand(sandbox, ["snapshot", "-i", "-c"], {
  json: false,
});
await runAgentBrowserCommand(sandbox, ["close"], { json: false });
```

Operational notes:

- Use sandbox snapshots for production to avoid reinstalling system deps + Chromium every run.
- Set `AGENT_BROWSER_SNAPSHOT_ID` after creating a snapshot.
- On Vercel, Sandbox auth uses OIDC automatically. For local dev, use `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`.
- Scheduled workflows can run from Cron route handlers.

## AWS Bedrock AgentCore

Use for: AWS-hosted cloud browsers, AgentCore, Bedrock browser, managed sessions backed by AWS infrastructure.

Workflow:

```bash
agent-browser -p agentcore open https://example.com
agent-browser snapshot -i
agent-browser click @e1
agent-browser screenshot page.png
agent-browser close
```

Credentials resolve from:

1. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`
2. AWS CLI fallback, including SSO, IAM roles, and named profiles

Useful env vars:

| Variable | Default | Purpose |
|---|---|---|
| `AGENTCORE_REGION` | `us-east-1` | AWS region |
| `AGENTCORE_BROWSER_ID` | `aws.browser.v1` | Browser identifier |
| `AGENTCORE_PROFILE_ID` | unset | Persistent browser profile |
| `AGENTCORE_SESSION_TIMEOUT` | `3600` | Session timeout seconds |
| `AWS_PROFILE` | `default` | AWS CLI profile |

Set provider globally when needed:

```bash
export AGENT_BROWSER_PROVIDER=agentcore
export AGENTCORE_REGION=us-east-2
agent-browser open https://example.com
```

Common fixes:

- "Failed to run aws CLI": install AWS CLI or set credentials directly.
- SSO expired: run `aws sso login`.
- Long task timeout: increase `AGENTCORE_SESSION_TIMEOUT`.

## Selection Checklist

| User asks for | Read / apply |
|---|---|
| Normal website automation | `SKILL.md`, then `commands.md` if needed |
| Auth/session persistence | `authentication.md`, `session-management.md`, `trust-boundaries.md` |
| Exploratory QA | Dogfood section + `dogfood-issue-taxonomy.md` |
| Desktop app | Electron section |
| Slack | Slack section + `slack-workflows.md` |
| Vercel app needs Chrome in production | Vercel Sandbox section |
| AWS cloud browser | AgentCore section |
