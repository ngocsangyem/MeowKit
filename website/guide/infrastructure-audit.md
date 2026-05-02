# MeowKit Documentation — Infrastructure Audit

> Phase 0.2 deliverable | 2026-05-02
> Documents current VitePress build pipeline, URL structure, search, and analytics.

---

## VitePress Build Pipeline

| Item | Value |
|------|-------|
| Config file | `website/.vitepress/config.ts` |
| Dev command | `pnpm docs:dev` (runs `vitepress dev`) |
| Build command | `pnpm docs:build` (runs `vitepress build`) |
| Preview command | `pnpm docs:preview` (runs `vitepress preview`) |
| Output directory | `.vitepress/dist/` |
| Package manager | pnpm |
| Package file | `website/package.json` (separate from root) |

**Plugins:**
- `vitepress-plugin-mermaid` (v2.0.17) — Mermaid diagram rendering
- `vitepress-plugin-llms` (v1.12.0) — LLM-friendly text extraction

**Deployment:** Vercel (`vercel.json` with `cleanUrls: true`, `trailingSlash: false`)

---

## URL Structure (Current Routes)

### Top-level pages (root `/`)
| URL | File | Status |
|-----|------|--------|
| `/` | `index.md` | Landing page |
| `/introduction` | `introduction.md` | Getting Started |
| `/installation` | `installation.md` | Install guide |
| `/quick-start` | `quick-start.md` | First task walkthrough |
| `/why-meowkit` | `why-meowkit.md` | Value proposition |
| `/migration` | `migration.md` | Migration guide |
| `/changelog` | `changelog.md` | Version history |
| `/cheatsheet` | `cheatsheet.md` | Quick reference |

### Core Concepts (`/core-concepts/`)
| URL | File |
|-----|------|
| `/core-concepts/what-is-meowkit` | `core-concepts/what-is-meowkit.md` |
| `/core-concepts/how-it-works` | `core-concepts/how-it-works.md` |
| `/core-concepts/workflow` | `core-concepts/workflow.md` |
| `/core-concepts/gates` | `core-concepts/gates.md` |

### Guide (`/guide/`)
| URL | File |
|-----|------|
| `/guide/philosophy` | `guide/philosophy.md` |
| `/guide/workflow-phases` | `guide/workflow-phases.md` |
| `/guide/model-routing` | `guide/model-routing.md` |
| `/guide/memory-system` | `guide/memory-system.md` |
| `/guide/agent-skill-architecture` | `guide/agent-skill-architecture.md` |
| `/guide/whats-new` | `guide/whats-new.md` (+ versioned subpages) |
| ... (13 guide pages total) | |

### Reference (`/reference/`)
- `/reference/agents/` — 17 agent pages
- `/reference/skills/` — 77 skill pages
- `/reference/templates/` — 5 template pages
- `/reference/agents` — agents index (`agents.md` → redirect)
- `/reference/skills` — skills index (`skills.md` → redirect)
- `/reference/configuration` — config reference
- `/reference/hooks` — hooks reference
- `/reference/rules-index` — rules index

### `getting-started/` directory
**Empty.** The "Getting Started" content lives at root level (`introduction.md`, `installation.md`, `quick-start.md`, `why-meowkit.md`).

---

## Search

**Currently:** VitePress built-in local search (no Algolia configured).
**Risk:** Local search indexes all 329 source markdown files. At 77+ skill pages, performance should be fine but needs verification after nav restructuring.
**Note:** `@algolia/client-analytics` appears in `pnpm-lock.yaml` as an unused transitive dependency — no Algolia DocSearch is configured.

---

## Analytics

**None.** No analytics configured:
- No Google Analytics / gtag
- No Plausible
- No Vercel Analytics (despite Vercel deployment)
- No custom tracking

**Recommendation:** Add lightweight privacy-friendly analytics (Vercel Analytics or Plausible) to track:
- Which pages get traffic (validate 80/20 assumption)
- Search queries (what are users actually looking for?)
- Bounce rates (which pages fail to answer questions?)

---

## Redirects

**Currently none configured.** No `redirects` in VitePress config. Any page renames or moves during this project MUST add redirects. VitePress supports redirects via:
1. Frontmatter `redirect` field on the old page
2. Server-side redirects in `vercel.json`

---

## Nav Structure (Current)

From `.vitepress/config.ts`:

```typescript
nav: [
  { text: 'Guide', link: '/introduction' },
  { text: 'CLI', link: '/cli/' },
  { text: 'Reference', link: '/reference/agents/' },
  { text: 'Workflows', link: '/workflows/' },
  { text: 'Cheatsheet', link: '/cheatsheet' },
  { text: 'Resources', items: [/* Changelog, Migration, GitHub, npm */] },
]
```

**Sidebar:** Organized by path prefix into `/` (Getting Started + Core Concepts + Guides), `/cli/` (CLI), `/reference/` (15 collapsible sub-groups), `/workflows/` (22 scenario pages).

**Issue:** The sidebar groups reference skills by technical category (Harness Pipeline, Pipeline Skills, Quality & Review...) — this is component-inventory thinking. The plan's Phase 2.0 proposes task-based primary navigation.

---

## Build Output Analysis

The `.vitepress/dist/` build output reveals stale content that's live on the deployed site:

### Broken links (in source files, not dist):
Need to run link checker against source `.md` files (excluding `dist/`).

### Terminology issues (in source files, not dist):
Need to run terminology linter against source `.md` files (excluding `dist/`).

*(Full baselines captured separately at time of writing.)*
