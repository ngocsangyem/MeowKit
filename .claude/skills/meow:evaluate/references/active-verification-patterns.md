# Active Verification Patterns

Catalog of probe techniques the evaluator uses to drive a running build per criterion type. Loaded once at session start by step-03; referenced inline during the criterion loop.

## Contents

- [Frontend Probes (browser-driven)](#frontend-probes-browser-driven)
  - [Pattern F1 — Happy path flow](#pattern-f1-happy-path-flow)
  - [Pattern F2 — Error state probe](#pattern-f2-error-state-probe)
  - [Pattern F3 — Console log capture](#pattern-f3-console-log-capture)
  - [Pattern F4 — Multi-screen design consistency](#pattern-f4-multi-screen-design-consistency)
  - [Pattern F5 — Time-to-value measurement](#pattern-f5-time-to-value-measurement)
  - [Pattern F6 — Originality / slop pattern match](#pattern-f6-originality-slop-pattern-match)
- [Backend / API Probes (curl-driven)](#backend-api-probes-curl-driven)
  - [Pattern B1 — Endpoint shape assertion](#pattern-b1-endpoint-shape-assertion)
  - [Pattern B2 — Happy path POST + GET round-trip](#pattern-b2-happy-path-post-get-round-trip)
  - [Pattern B3 — Error response shape](#pattern-b3-error-response-shape)
  - [Pattern B4 — Auth boundary check](#pattern-b4-auth-boundary-check)
- [CLI Probes (bash-driven)](#cli-probes-bash-driven)
  - [Pattern C1 — Help and exit codes](#pattern-c1-help-and-exit-codes)
  - [Pattern C2 — Happy-path invocation](#pattern-c2-happy-path-invocation)
  - [Pattern C3 — Bad input handling](#pattern-c3-bad-input-handling)
- [Cross-Cutting Patterns](#cross-cutting-patterns)
  - [Pattern X1 — Persistence across reload](#pattern-x1-persistence-across-reload)
  - [Pattern X2 — Keyboard navigation](#pattern-x2-keyboard-navigation)
  - [Pattern X3 — Network failure simulation](#pattern-x3-network-failure-simulation)
- [Probe Hygiene Rules](#probe-hygiene-rules)


**Core principle:** active verification means **driving the artifact**, not reading the source code. Every probe in this catalog produces a concrete artifact (screenshot, response capture, transcript) that lands in the evidence directory.

---

## Frontend Probes (browser-driven)

Tools: `meow:agent-browser`, `meow:playwright-cli`, `meow:browse`. Pick by complexity:

| Need | Tool | Why |
|---|---|---|
| Quick screenshot + check element exists | `meow:browse` | Lowest overhead |
| Multi-step user flow (click, type, navigate, assert) | `meow:agent-browser` | Built for AI-driven flows |
| Scripted regression flows | `meow:playwright-cli` | Replayable, deterministic |

### Pattern F1 — Happy path flow

For criteria like "user can submit form and see result":

1. Navigate to the page
2. Capture initial screenshot → `evidence/{criterion}-initial.png`
3. Fill form fields with realistic data (NOT placeholder text — use names like "Sarah Chen" and emails like `sarah@example.com`)
4. Click submit
5. Wait for visible confirmation OR navigation
6. Capture result screenshot → `evidence/{criterion}-result.png`
7. Verify the captured artifact matches the rubric PASS anchor

### Pattern F2 — Error state probe

For criteria like "errors render gracefully":

1. Trigger an error: submit empty form, submit invalid email, kill the network mid-request
2. Capture the error state → `evidence/{criterion}-error.png`
3. Check: does the error explain what went wrong AND offer a recovery path?
4. Pattern-match against `craft.md` and `ux-usability.md` recovery anchors

### Pattern F3 — Console log capture

For criteria like "no console errors on happy path":

1. Open the page with browser console capture enabled
2. Exercise the main flow (navigate, click, submit)
3. Save console log → `evidence/{criterion}-console.log`
4. Grep for `error`, `uncaught`, `unhandled`, `warning: react`
5. Any matches → finding

### Pattern F4 — Multi-screen design consistency

For criteria like "design language consistent across screens":

1. Navigate to every primary screen (landing, dashboard, settings, empty state, error state)
2. Screenshot each → `evidence/{criterion}-screen-N.png`
3. Visually compare: same fonts, same spacing, same button shape, same color palette
4. Pattern-match against `design-quality.md` consistency anchors

### Pattern F5 — Time-to-value measurement

For criteria like "time-to-value ≤90s":

1. Start a timer
2. Navigate to landing as a first-time user (no cookies, no auth state)
3. Click through the most direct path to the core value action
4. Stop timer when value is delivered (note received, file uploaded, query answered)
5. Record clicks + seconds → `evidence/{criterion}-timeline.txt`
6. Compare against the ≤90s threshold

### Pattern F6 — Originality / slop pattern match

For criteria from `originality.md` (specific name, non-generic copy, custom illustrations, unique signature):

1. Screenshot the landing page → `evidence/{criterion}-landing.png`
2. Read the hero copy + product name → `evidence/{criterion}-copy.txt`
3. Check the product name against the anti-pattern list: `KanbanApp`, `TaskFlow`, `MyDashboard` etc.
4. Check the hero copy against: "modern way to", "built for teams", "beautifully simple"
5. Check empty state illustrations: are they unDraw / Storyset stock packs?
6. Pattern-match against `originality.md` PASS/FAIL anchors

---

## Backend / API Probes (curl-driven)

Tool: `bash` with `curl`, `httpie`, `jq`.

### Pattern B1 — Endpoint shape assertion

For criteria like "GET /api/users returns array of user objects":

```bash
response=$(curl -sf -X GET "$base_url/api/users")
echo "$response" > "$evidence_dir/{criterion}-response.json"

# Assert it's a JSON array
echo "$response" | jq -e 'type == "array"' >/dev/null || echo "FAIL: not an array"

# Assert each item has required fields
echo "$response" | jq -e '.[0] | has("id") and has("email")' >/dev/null || echo "FAIL: missing fields"
```

### Pattern B2 — Happy path POST + GET round-trip

For criteria like "creating an item persists it":

```bash
# POST
created=$(curl -sf -X POST "$base_url/api/items" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-item","value":42}')
echo "$created" > "$evidence_dir/{criterion}-post-response.json"
id=$(echo "$created" | jq -r '.id')

# Follow-up GET to verify persistence
sleep 1
fetched=$(curl -sf "$base_url/api/items/$id")
echo "$fetched" > "$evidence_dir/{criterion}-get-response.json"

# Assert the fetched matches what was posted
echo "$fetched" | jq -e '.name == "test-item"' >/dev/null || echo "FAIL: persistence broken"
```

### Pattern B3 — Error response shape

For criteria like "API returns helpful error on bad input":

```bash
# Intentionally bad input
response=$(curl -s -w "\n%{http_code}" -X POST "$base_url/api/items" \
  -H "Content-Type: application/json" \
  -d '{"bogus": "data"}')

body=$(echo "$response" | sed '$d')
code=$(echo "$response" | tail -1)

echo "STATUS: $code" > "$evidence_dir/{criterion}-error-response.txt"
echo "BODY: $body" >> "$evidence_dir/{criterion}-error-response.txt"

# Assert 4xx with structured error message
[ "$code" -ge 400 ] && [ "$code" -lt 500 ] || echo "FAIL: wrong status code"
echo "$body" | jq -e '.error' >/dev/null || echo "FAIL: no structured error"
```

### Pattern B4 — Auth boundary check

For criteria like "endpoint requires authentication":

```bash
# Without auth
unauth=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/api/private")
echo "Unauthenticated: $unauth" > "$evidence_dir/{criterion}-auth.txt"

# With (fake) auth
authed=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer fake-token" "$base_url/api/private")
echo "With token: $authed" >> "$evidence_dir/{criterion}-auth.txt"

# Assert 401/403 without auth
[ "$unauth" -eq 401 ] || [ "$unauth" -eq 403 ] || echo "FAIL: endpoint not protected"
```

---

## CLI Probes (bash-driven)

### Pattern C1 — Help and exit codes

For criteria like "CLI --help is comprehensive":

```bash
"$binary" --help > "$evidence_dir/{criterion}-help.txt" 2>&1
help_exit=$?

# Assert exit 0
[ $help_exit -eq 0 ] || echo "FAIL: --help exit code $help_exit"

# Check for examples + exit codes section
grep -q -i "example" "$evidence_dir/{criterion}-help.txt" || echo "FAIL: no examples in help"
grep -q -i "exit" "$evidence_dir/{criterion}-help.txt" || echo "WARN: no exit code documentation"
```

### Pattern C2 — Happy-path invocation

For criteria like "CLI processes input correctly":

```bash
# Real input, not synthetic
echo "real input data" | "$binary" process > "$evidence_dir/{criterion}-stdout.txt" 2> "$evidence_dir/{criterion}-stderr.txt"
exit_code=$?

echo "EXIT: $exit_code" > "$evidence_dir/{criterion}-exit.txt"

# Assert success
[ $exit_code -eq 0 ] || echo "FAIL: exit code $exit_code"

# Assert non-empty stdout
[ -s "$evidence_dir/{criterion}-stdout.txt" ] || echo "FAIL: empty output"
```

### Pattern C3 — Bad input handling

For criteria like "CLI fails gracefully on bad input":

```bash
"$binary" --bogus-flag-that-doesnt-exist > "$evidence_dir/{criterion}-bad.txt" 2>&1
exit_code=$?
echo "EXIT: $exit_code" >> "$evidence_dir/{criterion}-bad.txt"

# Assert non-zero exit
[ $exit_code -ne 0 ] || echo "FAIL: bad flag accepted"

# Assert helpful error message (not stack trace)
grep -q -i "unknown\|invalid\|usage" "$evidence_dir/{criterion}-bad.txt" || echo "WARN: no helpful error"
```

---

## Cross-Cutting Patterns

### Pattern X1 — Persistence across reload

After any state-changing action, navigate away and back. The state should persist (or explicitly not, per spec).

### Pattern X2 — Keyboard navigation

For criteria like "keyboard accessible": tab through every interactive element. Capture which receive focus rings. Missing focus rings → FAIL.

### Pattern X3 — Network failure simulation

Disconnect network mid-request (in browser dev tools or via `iptables` for backend). Verify the app shows a recovery path, not a white screen.

---

## Probe Hygiene Rules

1. **Realistic input.** Never use `test1`, `aaa`, `placeholder`. Use `Sarah Chen`, `sarah@example.com`, `100 Main St`. Real-looking data exposes more bugs.
2. **Clean state per probe.** Clear cookies / reset DB / kill cache between independent probes when feasible.
3. **Capture before assert.** Always save the artifact first, then check it. Order matters — if the assertion crashes, the evidence is still on disk.
4. **One artifact per criterion.** Don't pile multiple criteria into one screenshot. Granularity makes the verdict file readable.
5. **Name the file descriptively.** `evidence/functionality-form-submit-FAIL.png` beats `evidence/screenshot-3.png`.