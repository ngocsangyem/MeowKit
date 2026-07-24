# Advanced Features


## Contents

- [Screenshots & Visual Capture](#screenshots-visual-capture)
  - [Annotated Screenshots (Vision Mode)](#annotated-screenshots-vision-mode)
- [Video Recording](#video-recording)
- [Batch Execution](#batch-execution)
- [Live Streaming (Observability)](#live-streaming-observability)
  - [Observability Dashboard](#observability-dashboard)
- [Network Inspection & HAR](#network-inspection-har)
- [JavaScript Evaluation](#javascript-evaluation)
- [Visual Debugging](#visual-debugging)
- [iOS Simulator (Mobile Safari)](#ios-simulator-mobile-safari)
- [Diffing (Change Verification)](#diffing-change-verification)
- [Clipboard](#clipboard)
- [Downloads](#downloads)

## Screenshots & Visual Capture

```bash
agent-browser screenshot                       # Screenshot to temp dir
agent-browser screenshot --full                # Full page screenshot
agent-browser screenshot --annotate            # Annotated with numbered element labels
agent-browser screenshot --screenshot-dir ./shots
agent-browser screenshot --screenshot-format jpeg --screenshot-quality 80
agent-browser pdf output.pdf                   # Save page as PDF
```

### Annotated Screenshots (Vision Mode)

`--annotate` overlays numbered labels `[N]` on interactive elements, each mapping to ref `@eN`.
Labels also cache refs — you can interact immediately without a separate snapshot.

Use annotated screenshots when:
- Page has unlabeled icon buttons or visual-only elements
- Canvas or chart elements are present (invisible to text snapshots)
- You need spatial reasoning about element positions
- Verifying visual layout or styling

```bash
agent-browser screenshot --annotate
# Legend output:
#   [1] @e1 button "Submit"
#   [2] @e2 link "Home"
agent-browser click @e2   # Use ref from annotated screenshot
```

## Video Recording

```bash
agent-browser record start demo.webm     # Start recording session
# ... perform actions ...
agent-browser record stop                # Stop and save
```

## Batch Execution

Pipe a JSON array of string arrays to `batch` to avoid per-command process startup overhead:

```bash
echo '[
  ["open", "https://example.com"],
  ["snapshot", "-i"],
  ["click", "@e1"],
  ["screenshot", "result.png"]
]' | agent-browser batch --json

# Stop on first error
agent-browser batch --bail < commands.json
```

Use `batch` for known command sequences that don't need intermediate output parsing.
Use separate commands or `&&` when you need to read output between steps.

## Live Streaming (Observability)

```bash
agent-browser stream enable              # Start WebSocket stream on auto-selected port
agent-browser stream enable --port 9223  # Bind specific localhost port
agent-browser stream status              # Check state, port, connection
agent-browser stream disable             # Stop streaming
```

Every session auto-starts a WebSocket stream. Use `stream status` to see the bound port.

### Observability Dashboard

```bash
agent-browser dashboard install          # Install once
agent-browser dashboard start            # Background server on port 4848
agent-browser open example.com           # Sessions auto-appear in dashboard
agent-browser dashboard stop
```

The dashboard runs independently on port 4848 (configurable with `--port`).

## Network Inspection & HAR

```bash
agent-browser network requests                   # All tracked requests
agent-browser network requests --type xhr,fetch  # Filter by resource type
agent-browser network requests --method POST     # Filter by HTTP method
agent-browser network requests --status 2xx      # Filter by status range
agent-browser network request <requestId>        # Full request/response detail
agent-browser network route "**/api/*" --abort   # Block matching requests
agent-browser network har start                  # Start HAR recording
agent-browser network har stop ./capture.har     # Stop and save
```

## JavaScript Evaluation

```bash
# Simple expressions
agent-browser eval 'document.title'
agent-browser eval 'document.querySelectorAll("img").length'

# Complex JS — use heredoc to avoid shell escaping issues (RECOMMENDED)
agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(
  Array.from(document.querySelectorAll("img"))
    .filter(i => !i.alt)
    .map(i => ({ src: i.src.split("/").pop(), width: i.width }))
)
EVALEOF

# Base64 encoding — bypass all shell escaping
agent-browser eval -b "$(echo -n 'Array.from(document.querySelectorAll("a")).map(a => a.href)' | base64)"
```

**Rules of thumb:**
- Single-line, no nested quotes → `eval 'expression'` with single quotes
- Nested quotes, arrow functions, template literals, multiline → `eval --stdin <<'EVALEOF'`
- Programmatic/generated scripts → `eval -b` with base64

## Visual Debugging

```bash
agent-browser --headed open https://example.com
agent-browser highlight @e1          # Highlight element
agent-browser inspect                # Open Chrome DevTools
agent-browser profiler start         # Start DevTools profiling
agent-browser profiler stop trace.json
```

Use `AGENT_BROWSER_HEADED=1` env var to enable headed mode.

## iOS Simulator (Mobile Safari)

```bash
agent-browser device list
agent-browser -p ios --device "iPhone 16 Pro" open https://example.com
agent-browser -p ios snapshot -i
agent-browser -p ios tap @e1        # Tap (alias for click)
agent-browser -p ios swipe up       # Mobile gesture
agent-browser -p ios screenshot mobile.png
agent-browser -p ios close          # Shuts down simulator
```

Requirements: macOS, Xcode, Appium (`npm install -g appium && appium driver install xcuitest`).
Real devices: use `--device "<UDID>"` from `xcrun xctrace list devices`.

## Diffing (Change Verification)

```bash
# Snapshot diff — verify an action had the intended effect
agent-browser snapshot -i          # Baseline
agent-browser click @e2
agent-browser diff snapshot        # Shows +/- changes to accessibility tree

# Screenshot diff — visual regression
agent-browser screenshot baseline.png
agent-browser diff screenshot --baseline baseline.png   # Diff image: changed pixels in red

# URL comparison
agent-browser diff url https://staging.example.com https://prod.example.com --screenshot
agent-browser diff url <url1> <url2> --selector "#main"  # Scope to element
```

## Clipboard

```bash
agent-browser clipboard read
agent-browser clipboard write "Hello, World!"
agent-browser clipboard copy        # Copy current selection
agent-browser clipboard paste       # Paste from clipboard
```

## Downloads

```bash
agent-browser download @e1 ./file.pdf           # Click element to trigger download
agent-browser wait --download ./output.zip      # Wait for any download to complete
agent-browser --download-path ./downloads open <url>  # Set default download directory
```