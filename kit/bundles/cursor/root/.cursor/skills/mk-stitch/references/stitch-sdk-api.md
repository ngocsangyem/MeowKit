# Stitch SDK API Reference

## Contents

- [Installation and authentication](#installation)
- [Core API](#core-api)
- [Types and errors](#type-definitions)
- [Project resolution](#project-resolution-priority)

Condensed reference for `@google/stitch-sdk`. Agent-optimized — covers common operations only.

## Installation

```bash
npm install @google/stitch-sdk
```

## Authentication

```bash
export STITCH_API_KEY="sk_..."  # From https://stitch.withgoogle.com/settings/api
```

The SDK auto-reads `STITCH_API_KEY` from environment. No explicit config needed.
The key gate in `stitch-api-call.ts` checks this var before any SDK method is called.

## Core API

### Stitch (root singleton)

```typescript
import { stitch } from "@google/stitch-sdk";

const projects = await stitch.projects();         // List all projects
const created  = await stitch.createProject(name);// Create project, returns Project
const project  = stitch.project("project-id");    // Get handle (sync — no network call)
```

### Project

```typescript
const project = stitch.project("project-123");    // sync — returns handle

// Generate screen from text prompt (positional params, uppercase device types)
const screen = await project.generate(
  "Login page with email/password",
  "MOBILE"  // optional: "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC"
);

const screens = await project.screens();           // List all screens
const screen  = await project.getScreen(screenId); // Get specific screen
```

### Screen

```typescript
// Export — returns CDN download URLs (not content directly)
const htmlUrl  = await screen.getHtml();    // Tailwind HTML CDN URL
const imageUrl = await screen.getImage();   // PNG screenshot CDN URL

// Edit/refine (positional: prompt, deviceType?, modelId?)
const edited = await screen.edit("Make header darker, add search bar");

// Variants (positional: prompt, variantOptions, deviceType?, modelId?)
const variants = await screen.variants("Different color schemes", {
  variantCount: 3,            // 1-5 variants
  creativeRange: "medium",    // "low" | "medium" | "high"
  aspects: ["COLOR_SCHEME"],  // "COLOR_SCHEME" | "LAYOUT" | etc.
});
```

## Type Definitions

```typescript
type DeviceType = "DEVICE_TYPE_UNSPECIFIED" | "MOBILE" | "DESKTOP" | "TABLET" | "AGNOSTIC";
type ModelId    = "MODEL_ID_UNSPECIFIED" | "GEMINI_3_PRO" | "GEMINI_3_FLASH";

interface Stitch {
  projects(): Promise<Project[]>;
  createProject(title?: string): Promise<Project>;
  project(id: string): Project;  // sync — returns handle, no API call
}

interface Project {
  id: string;
  data?: { title?: string };
  generate(prompt: string, deviceType?: DeviceType, modelId?: ModelId): Promise<Screen>;
  screens(): Promise<Screen[]>;
  getScreen(screenId: string): Promise<Screen>;
}

interface Screen {
  id: string;
  getHtml(): Promise<string>;    // CDN download URL
  getImage(): Promise<string>;   // CDN download URL
  edit(prompt: string, deviceType?: DeviceType, modelId?: ModelId): Promise<Screen>;
  variants(prompt: string, options: object, deviceType?: DeviceType, modelId?: ModelId): Promise<Screen[]>;
}
```

## Error Handling

| Code | Meaning | Action |
|------|---------|--------|
| `AUTH_FAILED` | Bad or missing API key | Check `STITCH_API_KEY` env var |
| `NOT_FOUND` | Screen or project not found | Verify ID |
| `RATE_LIMITED` | Daily quota exceeded | Wait until midnight UTC; run `stitch-quota.ts reset` |

```typescript
try {
  const screen = await project.generate(prompt);
} catch (error) {
  const err = error as { code?: string };
  if (err.code === "RATE_LIMITED") {
    // Local tracker synced; fallback to mk:frontend-design
  }
}
```

## Project Resolution Priority

Both `stitch-api-call.ts` subcommands use this precedence:

1. `--project <id>` — direct Stitch project ID (no lookup)
2. `--project-name <title>` — title-based lookup-or-create
3. `STITCH_PROJECT_ID` env — user's global override (direct ID)
4. Auto-detect from `git remote get-url origin` repo name
5. Hardcoded default project-name fallback (see `scripts/stitch-api-call.ts`)
