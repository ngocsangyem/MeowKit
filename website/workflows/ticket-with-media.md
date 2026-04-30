---
title: Analyzing Tickets with Media
description: How MeowKit handles tickets containing screenshots, videos, Figma links, and documents.
persona: B
---

# Analyzing Tickets with Media

> Full flow for tickets containing images, video recordings, Figma design links, and PDF documents — with graceful fallback at every step.

**Best for:** Team leads, QA engineers, frontend developers  
**Skills used:** [mk:intake](/reference/skills/intake), [mk:figma](/reference/skills/figma), [mk:multimodal](/reference/skills/multimodal), [mk:jira](/reference/skills/jira), [mk:investigate](/reference/skills/investigate)

## Overview

Tickets often include more than text. Bug reports have screen recordings. Feature PRDs have Figma links. Specs have PDF attachments. MeowKit processes all of these through a fallback chain — it tries the best tool first, then degrades gracefully if that tool isn't available.

```
Ticket arrives (Jira/Linear/GitHub/manual)
  │
  ├─ Text content → mk:intake analyzes directly
  ├─ Images (.png/.jpg) → Claude Read or Gemini
  ├─ Videos (.mp4/.mov) → FFmpeg key frames → Claude Read or Gemini
  ├─ Figma links → Figma MCP or PNG export → Claude Read or Gemini
  └─ PDFs → Claude Read (native, up to 20 pages)
```

## Prerequisites

| Tool | Required? | What it enables | Install |
|------|-----------|----------------|---------|
| Atlassian MCP | For Jira tickets | Read ticket + attachments | `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp` |
| Figma MCP | For Figma links | Exact design data (colors, spacing, tokens) | `claude mcp add figma` |
| Gemini API key | Optional | Better image/video analysis | Set `GEMINI_API_KEY` in `.claude/.env` |
| FFmpeg | Optional | Video frame extraction, image optimization | `brew install ffmpeg` or `npx mewkit setup --system-deps` |
| ImageMagick | Optional | Image resize/conversion | `brew install imagemagick` or `npx mewkit setup --system-deps` |

::: tip None of these are required
MeowKit works without all of them. Each missing tool reduces capability but never blocks analysis. Text-only analysis always works.
:::

## Flow 1: Ticket with Screenshots

**Scenario:** Bug report BUG-456 has 2 screenshots attached (error-state.png, expected-state.png)

### Step 1: Intake receives ticket

```bash
/mk:intake
# Paste ticket content, or if Atlassian MCP:
# mk:intake reads BUG-456 automatically
```

### Step 2: Detect image attachments

mk:intake finds `.png` files in the ticket attachments.

### Step 3: Image analysis — fallback chain

```
1. FFmpeg/ImageMagick available?
   → YES: Resize to ≤1920px (saves 60% tokens)
   → NO:  Use raw image (works, costs more tokens)

2. GEMINI_API_KEY available?
   → YES: mk:multimodal → detailed analysis
          "Error toast showing 'Session expired' at coordinates (340, 120).
           Background shows login form partially filled. Submit button is
           in loading state (spinner visible)."
   → NO:  Claude Read tool → good analysis
          "Screenshot shows an error message on a login page.
           The error says 'Session expired'. A loading spinner
           is visible on the submit button."
```

### Step 4: Results in intake output

```markdown
### Media Analysis
- **2 images** analyzed (error-state.png, expected-state.png)
- Error state: Login page with "Session expired" toast, submit button in loading state
- Expected state: Successful login redirect to dashboard
- **Key difference:** Error occurs during submission, not after idle timeout
```

### What you lose without tools

| Tool Missing | Impact |
|---|---|
| FFmpeg/ImageMagick | Images not resized — uses more tokens but still works |
| Gemini | Claude Read instead — slightly less precise on small text/exact colors |
| Both missing | Claude Read on raw images — works for most screenshots |

---

## Flow 2: Ticket with Video Recording

**Scenario:** Bug report BUG-789 has a screen recording (bug-reproduction.mp4, 2 minutes)

### Step 1: Intake detects video

mk:intake finds `.mp4` in attachments.

### Step 2: Video processing — FFmpeg required

```
FFmpeg installed?
├─ YES:
│   Extract key frames (scene changes only):
│   ffmpeg -i bug-reproduction.mp4 -vf "select='gt(scene,0.3)'" -vsync vfq frame_%03d.jpg
│
│   Result: 8-15 key frames from 2-minute video
│   (3600 raw frames → 12 key frames = 99.7% reduction)
│
└─ NO:
    ⚠ Cannot analyze video
    Output: "Video attached but FFmpeg not installed.
    Install: brew install ffmpeg or npx mewkit setup --system-deps
    Workaround: manually screenshot key moments and attach as images"
```

### Step 3: Analyze extracted frames

```
Gemini available?
├─ YES: Batch analyze all frames
│   frame_001: "Login page, empty form"
│   frame_003: "Email entered, password typed"
│   frame_005: "Submit clicked, loading spinner"
│   frame_008: "Error toast: 'Session expired'"
│   frame_012: "Redirected back to login page"
│
└─ NO: Claude Read on each frame
    Similar descriptions, less precise on small text
```

### Step 4: Timeline synthesis

mk:intake builds a timeline from frame analysis:

```markdown
### Media Analysis
- **Video:** bug-reproduction.mp4 (2:14, 12 key frames extracted)
- **Timeline:**
  1. Login page loaded (0:00)
  2. User enters credentials (0:15)
  3. Clicks "Sign In" (0:22)
  4. Loading spinner appears (0:23)
  5. Spinner continues ~3 seconds (0:23-0:26)
  6. Error toast: "Session expired" (0:26)
  7. Automatic redirect to login page (0:28)
- **Key observation:** Session expiry during login attempt, not after.
  Token validation may run before auth completes.
```

### Step 5: RCA with video evidence

mk:investigate uses the video timeline as evidence:

```markdown
### Root Cause Analysis (5 Whys)
Why 1: User sees "Session expired" → expired token rejected
Why 2: Token expired → was checking OLD token during NEW login
Why 3: Old token checked → pre-auth validation runs before credentials processed
Why 4: Pre-auth runs first → middleware order: validateToken → authenticate
Why 5: Wrong order → auth middleware should run BEFORE token validation for login route

Root cause: Login route runs token validation middleware before authentication.
Fix: Exclude /login from token validation middleware, or reorder middleware chain.
```

### What you lose without FFmpeg

| With FFmpeg | Without FFmpeg |
|---|---|
| 12 key frames extracted automatically | ❌ No video analysis at all |
| Timeline synthesized from scene changes | ❌ Must manually screenshot key moments |
| Completeness score includes video evidence | Score drops ~15 points (media gap noted) |
| RCA has visual evidence chain | RCA relies on text description only |

::: warning FFmpeg is required for video
Unlike images (Claude Read always works), video analysis has no fallback without FFmpeg. Install it for teams that frequently attach screen recordings.
:::

---

## Flow 3: Ticket with Figma Link

**Scenario:** Feature PRD PRD-123 includes: "Design: https://www.figma.com/design/abc123/MyApp?node-id=2304:512"

### Step 1: Intake detects Figma URL

mk:intake regex matches: `figma.com/(design|file|proto)/`

### Step 2: Figma analysis — fallback chain

```
Figma MCP available?
├─ YES (best):
│   mk:figma ANALYZE mode:
│   → get_design_context: component tree, styles, layout, constraints
│   → get_screenshot: visual reference
│   → Extract: exact colors (#1A73E8), exact spacing (24px), fonts (Inter 14px/20px)
│   → Components: LoginCard, EmailInput, PasswordInput, SubmitButton, SocialLoginGroup
│
├─ NO, but user can export PNG:
│   mk:intake asks: "Export Figma frames as PNG"
│   User drops login-screen.png
│   → Claude Read or Gemini analyzes the image
│   → Gets: approximate colors (~#1a73e8), estimated spacing (~24px), visual layout
│
└─ NO MCP, no export:
    ⚠ Cannot analyze design
    Output: "Figma link detected but cannot access.
    Install Figma MCP: claude mcp add figma
    Or export frames as PNG and attach to ticket"
```

### Step 3: Design context in output

```markdown
### Design Context
- **Figma:** MyApp / Login Screen (abc123:2304:512)
- **Components detected:** LoginCard, EmailInput, PasswordInput, SubmitButton, SocialLoginGroup
- **Layout:** Centered card, max-width 400px, vertical stack, 24px padding
- **Colors:** Primary #1A73E8, Background #F8F9FA, Text #202124, Error #D93025
- **Typography:** Inter 400 14px/20px (body), Inter 600 24px/28px (heading)
- **States visible:** Default login form (hover/error/loading states not exported)

### Suggested Breakdown
1. Create LoginCard component (centered, max-w-400, p-6)
2. Implement EmailInput + PasswordInput (Inter 14px, border-gray-300)
3. Add SubmitButton (bg-blue-600, text-white, hover:bg-blue-700)
4. Add SocialLoginGroup (Google + Apple, outlined buttons)
5. Responsive: stack vertically on mobile, center on desktop
```

### Step 4: Implementation with mk:cook

User runs `/mk:cook implement the login screen from PRD-123`

→ mk:cook activates mk:figma IMPLEMENT mode  
→ 7-step Figma→code workflow  
→ Pixel-perfect implementation with exact design values

---

## Flow 4: Ticket with PDF Specification

**Scenario:** Feature ticket has requirements-v2.pdf (15 pages)

### Step 1: Intake detects PDF

### Step 2: Claude Read handles natively

```
Claude Read tool opens PDF (built-in, no external tools needed):
→ Read pages 1-5: executive summary, requirements, acceptance criteria
→ Read pages 6-10: technical spec, API contracts
→ Read pages 11-15: wireframes, timeline

Note: Max 20 pages per Read call. For larger PDFs, read in chunks.
```

### Step 3: Extract structured info

```markdown
### Document Analysis
- **PDF:** requirements-v2.pdf (15 pages)
- **Requirements:** 12 functional, 5 non-functional
- **Acceptance criteria:** 8 defined (binary pass/fail ✓)
- **API contracts:** 3 endpoints specified (POST /auth, GET /user, PUT /profile)
- **Wireframes:** Pages 11-13 contain low-fidelity wireframes
- **Timeline:** Q2 2026 target, 3 sprints estimated
```

No external tools needed. PDFs work out of the box.

---

## Fallback Summary

| Attachment | Best Tool | Fallback 1 | Fallback 2 | No Tools |
|---|---|---|---|---|
| **Image** | FFmpeg resize + Gemini | Gemini (raw) | Claude Read (raw) | Claude Read (always works) |
| **Video** | FFmpeg frames + Gemini | FFmpeg frames + Claude Read | ❌ No analysis | ❌ Manual screenshots needed |
| **Figma link** | Figma MCP | PNG export + Gemini | PNG export + Claude Read | ❌ Cannot access |
| **PDF** | Claude Read | — | — | Claude Read (always works) |
| **Text** | Direct analysis | — | — | Always works |

::: info Key takeaway
Images and PDFs always work. Videos need FFmpeg. Figma needs MCP or manual export. Text always works. Install FFmpeg + Figma MCP for the best experience, but MeowKit never blocks on missing tools.
:::

## Related Workflows

- [PRD Intake Automation](/workflows/prd-intake) — Full intake workflow with Jira/Linear/GitHub
- [Fixing a Bug](/workflows/fix-bug) — Bug investigation after intake
- [Adding a Feature](/workflows/add-feature) — Feature implementation from Figma spec
- [QA Testing](/workflows/qa-testing) — Visual verification after implementation
