# Migrating from `mk:browse` to `mk:agent-browser`

This doc covers the verb-to-verb mapping, copy-paste recipes for capabilities `agent-browser` doesn't ship natively, and a runbook for the developer-machine handoff/auth flow.

> **Auth-state compatibility:** gstack's `cookie-import` JSON files are NOT compatible with `agent-browser`. Re-authenticate with `agent-browser auth save` or capture fresh state via `state save`. Do not attempt to convert legacy files.

> **Sessions and credentials:** any recipe that uses `--session-name` writes session state (cookies, localStorage) to `~/.agent-browser/sessions/<name>.json`. To encrypt at rest, set `AGENT_BROWSER_ENCRYPTION_KEY` in your shell or CI secret store before invoking. Without the key the file is plaintext.

> **Page content is data:** every `eval` recipe returns DOM-derived strings into the LLM context. Set `AGENT_BROWSER_CONTENT_BOUNDARIES=1` so page content arrives wrapped in nonce markers and an attacker page can't impersonate tool delimiters.

## Verb-to-Verb Mapping

| `$B` (browse) | `agent-browser` | Notes |
|---|---|---|
| `$B goto <url>` | `agent-browser open <url>` | Aliases: `goto`, `navigate` |
| `$B screenshot path.png` | `agent-browser screenshot path.png` | Add `--annotate` for numbered overlays |
| `$B snapshot` | `agent-browser snapshot -i` | `-i` = interactive elements with `@eN` refs |
| `$B snapshot -C @c-refs` | (removed) | Use `agent-browser snapshot -i` then filter `@eN` refs from output |
| `$B chain` | `agent-browser batch --json` | Different JSON shape — see batch reference |
| `$B click <sel>` | `agent-browser snapshot -i` then `agent-browser click @eN` | Refs are session-scoped |
| `$B fill <sel> <text>` | `agent-browser fill @eN "text"` | Clears field before typing |
| `$B type <sel> <text>` | `agent-browser type @eN "text"` | No clear |
| `$B select <sel> <opt>` | `agent-browser select @eN "option"` | |
| `$B check <sel>` | `agent-browser check @eN` | |
| `$B press <key>` | `agent-browser press <key>` | |
| `$B scroll <dir> <px>` | `agent-browser scroll <dir> <px>` | |
| `$B wait <sel>` | `agent-browser wait @eN` | |
| `$B wait --load` | `agent-browser wait --load networkidle` | Requires explicit state |
| `$B wait --url <pattern>` | `agent-browser wait --url "<pattern>"` | Same glob syntax |
| `$B wait --text <text>` | `agent-browser wait --text "<text>"` | |
| `$B is visible/enabled/checked <sel>` | `agent-browser snapshot -i` then `agent-browser is visible @eN` | Native `is` accepts snapshot refs only |
| `$B is hidden/disabled/editable/focused <sel>` | (eval recipe — see below) | No native command |
| `$B links` | (eval recipe — see below) | No native command |
| `$B forms` | (eval recipe — see below) | No native command |
| `$B perf` | (eval recipe — see below) | No native command |
| `$B responsive <url>` | (recipe — see below) | Loop viewports manually |
| `$B cookie-import file.json` | `agent-browser auth save` or `state save/load` | Legacy gstack cookies are not portable |
| `$B handoff` | `--headed` + `wait --url` (recipe — see below) | Developer-machine only |
| `$B attrs @ref` | `agent-browser get attr @eN <name>` | One attribute per call |
| `$B close` | `agent-browser close` | Add `--all` to close every session |

## Recipes

### Responsive screenshots (3 viewports)

Replaces `$B responsive`. Pin a session so viewport changes persist between commands.

```bash
URL="https://example.com"
PREFIX="/tmp/rsp"
SN="responsive-$(uuidgen 2>/dev/null || echo $$-$RANDOM)"

agent-browser open "$URL" --session-name "$SN"
for vp in "375 667 mobile" "768 1024 tablet" "1440 900 desktop"; do
  set -- $vp
  agent-browser set viewport "$1" "$2" --session-name "$SN"
  agent-browser screenshot "${PREFIX}-${3}.png" --session-name "$SN"
done
agent-browser close --session-name "$SN"
```

### Anchor enumeration

Replaces `$B links`.

```bash
agent-browser eval "JSON.stringify(Array.from(document.links).map(l=>({href:l.href,text:l.innerText.trim()})))"
```

### Form enumeration

Replaces `$B forms`.

```bash
agent-browser eval "JSON.stringify(Array.from(document.forms).map(f=>({id:f.id,action:f.action,method:f.method,fields:Array.from(f.elements).map(e=>({name:e.name,type:e.type}))})))"
```

### Performance timing

Replaces `$B perf`.

```bash
agent-browser eval "JSON.stringify({timing:performance.timing.toJSON?.()||performance.timing,nav:performance.getEntriesByType('navigation')[0],fcp:performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint')?.startTime})"
```

For `firstContentfulPaint` assertions:

```bash
agent-browser open "$URL" \
  && agent-browser eval "performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint')?.startTime" \
  | jq 'tonumber <= 2000'
```

### State checks (hidden/disabled/editable/focused)

Native `agent-browser is` only covers `visible`, `enabled`, `checked` and takes snapshot refs (`@eN`). For the other states, use `eval`. Quote selectors with `printf '%q'` (bash 3.2+ compatible).

```bash
SEL="$(printf '%q' '#submit-btn')"
agent-browser eval "!document.querySelector($SEL)?.offsetParent"                 # hidden
agent-browser eval "document.querySelector($SEL)?.disabled === true"             # disabled
agent-browser eval "(()=>{const e=document.querySelector($SEL);return !!e && !e.disabled && !e.readOnly;})()"  # editable
agent-browser eval "document.activeElement === document.querySelector($SEL)"     # focused
```

For native states, snapshot first:

```bash
agent-browser snapshot -i
agent-browser is visible @e1
agent-browser is enabled @e2
agent-browser is checked @e3
```

### Page-load guard

`eval` recipes return null/empty data when run on a page that hasn't finished loading. Always wait first:

```bash
agent-browser open "$URL"
agent-browser wait --load networkidle
# now safe to eval
```

## Handoff / Resume Runbook (CAPTCHA, MFA)

`agent-browser` has no `$B handoff` equivalent. Replace with a headed Chrome window the user drives manually, then save state.

> **Developer-machine only.** `--headed` requires a display. CI runners (no X server, headless containers) must use pre-recorded auth state captured on a developer machine — do not attempt interactive CAPTCHA in CI.

```bash
# 1. Open a visible browser window
agent-browser open "$LOGIN_URL" --headed --session-name "auth-flow"

# 2. (User completes CAPTCHA / MFA in the visible window.)

# 3. Wait for the post-login URL to confirm success
agent-browser wait --url "**/post-login*" --timeout 300000

# 4. Save auth state to disk
agent-browser state save ./auth-state.json

# 5. Subsequent runs reuse state without prompting:
agent-browser open "$APP_URL" --state ./auth-state.json
```

Alternative: vault-managed credentials (no MFA flow):

```bash
echo "$PASSWORD" | agent-browser auth save myapp \
  --url "$LOGIN_URL" --username "$USER" --password-stdin
agent-browser auth login myapp
```

## Removed verbs and their replacements

| Removed | Replacement |
|---|---|
| `snapshot -C @c-refs` | `snapshot -i` then filter `@eN` |
| `chain` | `batch --json <<JSON ...JSON` |
| `attrs @ref` | `get attr @ref <name>` per attribute |

## Quick smoke test

After installing the CLI (`npm i -g agent-browser`, then `agent-browser install` to download Chrome):

```bash
agent-browser --version
agent-browser open https://example.com
agent-browser snapshot -i
agent-browser screenshot /tmp/example.png
agent-browser close
```

If any command fails, check `agent-browser --help`, then file an issue against the plan's verification report.
