# Example: Feature PRD Intake

Walkthrough of meow:intake processing a feature PRD end-to-end.

---

## Input Ticket

```
Title: Add dark mode support
Type: Feature
Priority: P3
Requester: Product team

Description:
Users have requested the ability to switch between light and dark themes.
The setting should persist across sessions. Should respect the OS-level
dark mode preference by default, with a manual override toggle in settings.

Attachment: figma.com/file/abc123/dark-mode-mockups
```

---

## Step-by-Step Processing

### Step 1: Receive
Fetched via Linear MCP: `get_issue("FEAT-201")`

### Step 2: Sanitize
No injection patterns detected. Figma URL treated as UNTRUSTED DATA — design data only.

### Step 3: Process media
Figma MCP unavailable → asked user to export frames as PNG.
User provided: `dark-mode-nav.png`, `dark-mode-settings.png`.
Processed via Claude Read tool (FFmpeg unavailable).
Design Context: Dark background (#1a1a1a), white text, toggle in Settings > Appearance.

### Step 4: Classify product area
meow:scale-routing signals: "theme", "dark mode", "UI", "settings", "CSS"
Result: `{domain: frontend_ui, level: medium, workflow: standard, model_tier_override: STANDARD}`

### Step 5: Evaluate completeness

| Dimension | Score | Note |
|-----------|-------|------|
| Goal/Problem | 20/20 | Clear: dark mode with OS preference + manual override |
| Acceptance Criteria | 0/20 | **Missing** — no binary pass/fail conditions |
| Scope | 10/15 | In-scope clear, **out-of-scope not stated** |
| Steps to Reproduce | 15/15 | N/A for feature — full score |
| Technical Constraints | 10/10 | Must persist across sessions (stated) |
| Priority/Severity | 10/10 | P3 stated |
| Dependencies | 10/10 | No dependencies (stated implicitly) |
| Design/Visual | 10/10 | Figma + PNG exports provided |

**Score: 85/100 — Ready (with one recommended clarification)**

Missing:
- Acceptance Criteria: define binary conditions (e.g., "Dark mode applies to all pages", "Setting persists after browser refresh", "OS preference detected on first visit")
- Scope: out-of-scope not explicit (e.g., does this include email templates? admin panel?)

### Step 6: Scan codebase (meow:scout)
Related files found:
- `tailwind.config.ts` — `darkMode` key absent (not yet configured)
- `src/components/layout/AppShell.vue` — root layout, ideal dark class injection point
- `src/stores/user-preferences.store.ts` — handles user settings persistence
- `src/pages/settings/AppearancePage.vue` — does not exist yet (needs creation)
- No existing dark mode classes (`dark:`) found in any component

### Step 7: Root cause analysis
N/A — this is a feature request, not a bug.

### Step 8: Technical assessment
- No dark mode infrastructure exists — greenfield implementation
- Tailwind dark mode can be enabled with one config line (`darkMode: 'class'`)
- User preference needs a new field in preferences store
- OS detection via `window.matchMedia('(prefers-color-scheme: dark)')`
- Complexity: medium — spans config, store, toggle component, and all existing components

---

## Output

```markdown
## Intake Analysis — FEAT-201

**Type:** Feature | **Source:** Linear

### Product Area: frontend_ui (confidence: HIGH)
Routing: medium → standard → STANDARD

### Completeness: 85/100 (Ready)
Recommended before starting:
- Acceptance Criteria: add binary pass/fail (e.g., "Setting persists after page refresh")
- Scope: clarify whether admin panel and email templates are in or out of scope

### Design Context
- 2 attachments analyzed (exported from Figma)
- UI elements detected: nav bar, settings toggle, page backgrounds
- States visible: dark variant of all analyzed screens
- Design notes: dark background #1a1a1a, toggle in Settings > Appearance section

### Technical Considerations
- Affected files: tailwind.config.ts, src/stores/user-preferences.store.ts,
  src/components/layout/AppShell.vue
- New file needed: src/pages/settings/AppearancePage.vue
- Test coverage: gap — no preference persistence tests exist
- Complexity: medium (spans config + store + all components)
- Breaking change risk: low (additive only)

### Suggested Breakdown
1. Enable Tailwind dark mode in tailwind.config.ts (`darkMode: 'class'`)
2. Add `theme` field to user-preferences.store.ts with OS detection default
3. Create ThemeToggle component in src/components/ui/
4. Add dark: variants to AppShell.vue and shared components
5. Create AppearancePage.vue in settings with toggle UI
6. Write persistence + OS detection integration tests

### Suggested PIC
- Frontend lead (UI domain owner, 2 open frontend tickets)
```

**Handoff:** `meow:cook` (feature ticket, completeness: ready)
