# Slack Workflows

Common browser-automation patterns for Slack. Use with `agent-browser`, not the Slack API.

## Start

Prefer an existing logged-in Slack browser session:

```bash
agent-browser connect 9222
agent-browser snapshot -i
```

Or open Slack:

```bash
agent-browser open https://app.slack.com
agent-browser snapshot -i
```

Re-snapshot after changing tabs, channels, DMs, search state, or sidebar expansion.

## Check Unread Messages

1. Snapshot and locate the Activity tab, DMs tab, and "More unreads" button.
2. Click Activity, wait briefly, screenshot.
3. Click DMs, wait briefly, screenshot.
4. Expand "More unreads" if present, screenshot.
5. Summarize unread channels/DMs from visible text and screenshots.

```bash
agent-browser snapshot -i
agent-browser click @e14
agent-browser wait 1000
agent-browser screenshot activity-unreads.png
agent-browser click @e13
agent-browser wait 1000
agent-browser screenshot dms.png
```

## Search Conversations

```bash
agent-browser snapshot -i
agent-browser click @e5
agent-browser fill @e_search "keyword or phrase"
agent-browser press Enter
agent-browser wait --load networkidle
agent-browser screenshot search-results.png
```

If refs differ, identify the search input from the latest snapshot. Do not reuse old refs.

## Navigate To A Channel

```bash
agent-browser snapshot -i
agent-browser click @e_channel_ref
agent-browser wait 1000
agent-browser screenshot channel.png
```

Slack sidebars are long. If the channel is not visible:

```bash
agent-browser scroll down 500 --selector ".p-sidebar"
agent-browser snapshot -i
```

## Extract Visible Workspace Data

Use JSON snapshots when the user asks for structured lists:

```bash
agent-browser snapshot --json > slack-snapshot.json
```

Look for:

- `treeitem` nodes for channels and DMs.
- Message list/listitem/document nodes for visible messages.
- Buttons or links with user names, timestamps, and thread metadata.

Only claim what is visible or captured. Slack virtualizes message lists, so not all history is loaded at once.

## Send A Message

Only send messages when the user explicitly asks and the destination is unambiguous.

Workflow:

1. Navigate to the channel/DM.
2. Confirm destination from title/header or screenshot.
3. Focus the message box.
4. Type the exact user-provided message.
5. Send only after a final destination check.

```bash
agent-browser snapshot -i
agent-browser click @e_message_box
agent-browser type "message text"
agent-browser press Enter
```

## Evidence Report

Use [../templates/slack-report-template.md](../templates/slack-report-template.md) when producing a structured Slack analysis. Include:

- Workspace and scope.
- Screenshots used.
- Channels/DMs checked.
- Search terms used.
- Uncertainty when virtualization, permissions, or hidden history limit visibility.

## Limitations

- This is UI automation, not Slack API access.
- It operates within the logged-in user's visible workspace and permissions.
- Rapid interaction can be rate-limited. Add short waits.
- Do not infer unread counts or hidden messages beyond visible UI evidence.
