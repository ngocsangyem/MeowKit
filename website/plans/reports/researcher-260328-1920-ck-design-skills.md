# Deep Skill Analysis: ui-ux-pro-max & frontend-design

**Report Date:** 2026-03-28
**Analyzed:** 2 core design skills in claudekit-engineer
**Scope:** Full content extraction + data inventory

---

## Executive Summary

Two complementary, production-grade design skills that together provide:

1. **ui-ux-pro-max** — Quantified design intelligence (50+ styles, 161 palettes, 57 fonts, 99 UX rules, 25 chart types)
2. **frontend-design** — Workflow-driven implementation (6 specialized workflows, 80+ Magic UI components, premium patterns)

**Key differentiator:** ui-ux-pro-max solves *which design to choose*. frontend-design solves *how to build it without AI slop*.

---

## Skill 1: ck:ui-ux-pro-max

### Core Identity
- **Trigger:** Any UI/UX design decision, component creation, style selection, optimization
- **Output:** Searchable database with reasoning rules + design systems
- **Tech Stack Focus:** React Native (primary), but rules span web/iOS/Android/Flutter
- **Unique Value:** Priority-ranked UX rules tied to accessibility/performance/interaction standards

### Content Inventory

#### Design Rules (by Priority)
**10 Categories, 300+ Atomic Rules:**

| Priority | Category | Rules Count | Examples |
|----------|----------|-------------|----------|
| 1 | Accessibility (CRITICAL) | 13 rules | contrast 4.5:1, focus rings, alt-text, aria-labels, keyboard nav, skip-links |
| 2 | Touch & Interaction (CRITICAL) | 17 rules | 44×44px min, 8px spacing, no hover-only, loading feedback, haptic, gesture conflicts |
| 3 | Performance (HIGH) | 18 rules | WebP/AVIF, lazy loading, CLS < 0.1, font-display: swap, virtualize-lists |
| 4 | Style Selection (HIGH) | 12 rules | match product type, consistency, no emoji icons, effects aligned with style |
| 5 | Layout & Responsive (HIGH) | 15 rules | viewport meta, mobile-first, breakpoint system, no H-scroll, container width |
| 6 | Typography & Color (MEDIUM) | 11 rules | 1.5-1.75 line-height, 65-75 char limit, semantic tokens, dark-mode parity |
| 7 | Animation (MEDIUM) | 24 rules | 150-300ms duration, transform/opacity only, spring physics, reduced-motion |
| 8 | Forms & Feedback (MEDIUM) | 24 rules | visible labels, error placement, inline validation, progressive disclosure, undo |
| 9 | Navigation Patterns (HIGH) | 21 rules | bottom nav ≤5 items, back behavior, deep linking, state preservation |
| 10 | Charts & Data (LOW) | 23 rules | match chart type, accessible colors, legends visible, drill-down consistency |

**Severity Spectrum:** Critical (blocking) → High (shipping stoppers) → Medium (UX quality) → Low (polish)

#### Data Files

**colors.csv — 161 Color Palettes**
- One palette per product type (SaaS, e-commerce, healthcare, gaming, etc.)
- Each contains: Primary, On-Primary, Secondary, Accent, Background, Foreground, Card, Muted, Border, Destructive, Ring
- All WCAG 3:1 minimum (most 4.5:1+)
- Examples:
  - SaaS (General): #2563EB trust blue + #EA580C orange
  - Fintech/Crypto: #F59E0B gold + #8B5CF6 purple
  - Mental Health: #8B5CF6 lavender + #059669 wellness green
  - 50 total product types covered

**typography.csv — 57 Font Pairings**
- Heading + Body font per pairing
- Each includes: mood keywords, best-for use cases, Google Fonts URLs, Tailwind config snippets, reasoning
- Examples:
  - Classic Elegant: Playfair Display + Inter (luxury/editorial)
  - Tech Startup: Space Grotesk + DM Sans (bold/innovative)
  - Editorial Classic: Cormorant Garamond + Libre Baskerville (literary)
  - Developer Mono: JetBrains Mono + IBM Plex Sans (code/tech)
  - Vietnamese Friendly, Japanese Elegant, Korean Modern, Arabic, Thai, Hebrew variants

**styles.csv — 50+ UI Styles**
- Glassmorphism, Claymorphism, Minimalism, Brutalism, Neumorphism, Bento Grid, Dark Mode, Skeuomorphism, Flat Design, etc.
- Each with: CSS keywords, anti-patterns, best product types, shadow/blur/radius rules

**products.csv — 161 Product Types**
- SaaS (general + micro), E-commerce (standard + luxury), Healthcare, Gaming, Fintech, Social, Productivity, AI/Chatbot, NFT/Web3, Creator Economy, etc.
- Each links to: primary style + secondary styles, landing page pattern, dashboard style (if applicable), color palette focus, key considerations

**ux-guidelines.csv — 99 UX Best Practices**
- Structured as: Category, Issue, Platform, Do/Don't pairs, Severity
- Examples:
  - Smooth scroll, sticky nav, active state indication
  - Excessive motion, duration timing, reduced-motion support
  - Z-index management, content jumping, viewport units
  - Touch target size, gesture conflicts, focus states
  - (30 shown in sample; extends to 99 rows)

**charts.csv — 25 Chart Types**
- Line, bar, pie, donut, scatter, bubble, histogram, heatmap, treemap, funnel, waterfall, gauge, timeline, Sankey, etc.
- Includes recommendations, anti-patterns, accessibility notes

**google-fonts.csv — Variable Font Database**
- Individual Google Fonts with: weights, variants, readability metrics, use cases

**Other CSVs:**
- `design.csv` — Design system decision trees
- `ui-reasoning.csv` — AI reasoning rules (matches product type → style → colors → fonts)
- `landing.csv` — Landing page structure patterns
- `react-performance.csv` — React/Next.js performance best practices
- `app-interface.csv` — iOS/Android/React Native interface guidelines
- `icons.csv` — Icon system recommendations

### How It Works

**Step 1: Design System Generation (Master + Overrides)**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<product> <industry> <keywords>" --design-system -p "Project"
```
Returns: Single coherent design system (pattern, style, colors, typography, effects, anti-patterns)

**Step 2: Hierarchical Retrieval**
- Creates `design-system/MASTER.md` (global source of truth)
- Allows page-specific overrides: `design-system/pages/dashboard.md`
- Subpages inherit from master unless explicitly overridden

**Step 3: Detailed Domain Searches (as needed)**
```bash
# Get specific recommendations
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max>]
```
Domains: `product`, `style`, `color`, `typography`, `chart`, `ux`, `google-fonts`, `landing`, `react`, `web`, `prompt`

**Step 4: Stack-Specific Guidelines**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack react-native
```
Stack: `react-native` (with others planned)

### Gotchas & Anti-Patterns

**What triggers bad recommendations:**
- Vague queries ("make it look nice") → Specificity required ("SaaS fintech dashboard dark mode")
- Mixing contradictory keywords ("minimal + busy") → Resolve aesthetic direction first
- Ignoring accessibility → All recommendations enforce WCAG baseline

**Common sticking points (pre-addressed):**
- Dark mode contrast issues → Quick Reference §6 rules
- Animations feeling unnatural → Spring physics + easing rules (§7)
- Form UX poor → Inline validation + error clarity (§8)
- Navigation confusing → Hierarchy + bottom-nav-limit rules (§9)
- Layout breaks on mobile → Mobile-first + breakpoint consistency (§5)
- Performance jank → Virtualize + debounce + main-thread budget (§3)

**Pre-delivery checklist built-in:**
- Run `--domain ux "animation accessibility z-index loading"` before shipping
- Verify CRITICAL + HIGH sections (§1–§3)
- Test on 375px + landscape + reduced-motion + dynamic type
- Check dark mode contrast separately (not inference)

---

## Skill 2: ck:frontend-design

### Core Identity
- **Trigger:** UI implementation from designs/screenshots/videos, component creation, prototyping, "avoid AI slop"
- **Output:** Production code + design guidelines + avoiding generic LLM defaults
- **Tech Stack:** React (primary), with Three.js for 3D, Framer Motion, GSAP
- **Unique Value:** Bridges design intent to pixel-perfect code; anti-slop rules prevent AI fingerprints

### Workflow Selection (6 Specialized Paths)

| Input | Workflow | Purpose |
|-------|----------|---------|
| Screenshot | Exact replication | Match source pixel-for-pixel |
| Video | Animation replication | Implement motion from footage |
| Screenshot (describe only) | Documentation | Architect for developer handoff |
| 3D/WebGL request | Three.js immersive | WebGL scene + interaction |
| Quick task | Rapid implementation | Single component in <30min |
| Complex/award-quality | Full immersive | Magazine-grade, attention to detail |
| Existing project | Redesign audit | Upgrade legacy designs |

**All workflows:** Activate ui-ux-pro-max skill first for design intelligence baseline.

### Design Dials (3 Configurable Parameters)

Override default behavior by setting design dials:

| Dial | Default | Range | Low (1-3) | High (8-10) |
|------|---------|-------|-----------|-------------|
| `DESIGN_VARIANCE` | 8 | 1-10 | Perfect symmetry, centered layouts | Asymmetric, masonry, fractional grid, massive empty zones |
| `MOTION_INTENSITY` | 6 | 1-10 | CSS hover/active only | Framer scroll reveals, spring physics, perpetual micro-animations |
| `VISUAL_DENSITY` | 4 | 1-10 | Art gallery (huge whitespace) | Cockpit (tiny paddings, 1px dividers, monospace numbers) |

**Impact:** At `DESIGN_VARIANCE > 4`, centered heroes forbidden → force split-screen. At `MOTION_INTENSITY > 5`, embed perpetual animations. At `VISUAL_DENSITY > 7`, remove generic cards → use spacing/dividers.

### Content Inventory

#### Reference Files (29 files)

**Workflow Guides:**
- `workflow-screenshot.md` — Step-by-step: Analyze → Plan → Implement → Verify → Document
- `workflow-video.md` — Extract animations from footage, implement with Framer Motion/anime.js
- `workflow-3d.md` — Three.js scenes, WebGL optimization, interactivity
- `workflow-quick.md` — Single component rapid prototyping (scope tightly)
- `workflow-immersive.md` — Magazine-quality, award-level polish
- `workflow-describe.md` — Document design for handoff (no code)

**Design Patterns & Components:**
- `premium-design-patterns.md` — 30+ patterns (Mac Dock nav, gooey menus, bento grids, parallax cards, scroll animations, morphing dialogs, etc.)
- `magicui-components.md` — 80+ Magic UI components (text effects, buttons, cards, grids, animated counters, etc.)
- `bento-motion-engine.md` — SaaS dashboard architecture: double-bezel cards, perpetual micro-interactions, spring physics

**Technical & Optimization:**
- `technical-overview.md` — Performance optimization strategies
- `technical-best-practices.md` — Code quality, structure, bundling
- `technical-workflows.md` — Implementation workflows
- `technical-accessibility.md` — WCAG compliance, inclusive design
- `performance-guardrails.md` — Animation/blur animation rules, CLS, LCP budgets

**Analysis & Extraction:**
- `visual-analysis-overview.md` — How to analyze screenshots/videos for design extraction
- `design-extraction-overview.md` — Systematic extraction of colors, fonts, spacing, effects
- `analysis-techniques.md` — In-depth analysis methodologies
- `analysis-best-practices.md` — Quality checks for analysis
- `analysis-prompts.md` — Prompts for extracting design intent
- `extraction-best-practices.md` — CSV/JSON output structuring
- `extraction-output-templates.md` — Templates for design documentation
- `extraction-prompts.md` — Prompts for systematic extraction

**Anti-Slop & Quality:**
- `anti-slop-rules.md` — **Critical:** Forbidden AI design patterns (Inter font, purple gradients, 3-column cards, "John Doe", generic animations, etc.)
- `redesign-audit-checklist.md` — Evaluate existing projects for upgrade opportunities

**Tools & Libraries:**
- `animejs.md` — anime.js library documentation and patterns
- `magicui-components.md` (duplicate entry) — 80+ component references
- `bento-motion-engine.md` (duplicate entry) — SaaS motion architecture

**AI/Multimodal Support:**
- `ai-multimodal-overview.md` — Screenshot analysis, video extraction, asset generation

#### Anti-Slop Rules (Detailed)

**Forbidden Typography:**
- ~~Inter~~ → Prefer: Geist, Outfit, Cabinet Grotesk, Satoshi, Plus Jakarta Sans
- ~~Roboto/Arial/Open Sans~~ → Preference-specific alternatives
- ~~Space Grotesk~~ → Overused in tech startup contexts
- Avoid: Serif on dashboards, orphaned words, all-caps subheaders

**Forbidden Color:**
- ~~AI purple/blue gradient~~ → Single accent color max, desaturated, tinted shadows
- ~~Pure #000000~~ → Off-black: #0a0a0a, #111, Zinc-950, tinted
- ~~Oversaturated accents~~ → Desaturate (sat < 80%)
- ~~Gradient text~~ → Sparingly on accents only, never on body/large headers

**Forbidden Layout:**
- ~~3-column equal card rows~~ → Use: 2-col zig-zag, asymmetric, masonry, horizontal scroll
- ~~Centered hero + centered H1~~ → Use: split-screen, left-aligned, asymmetric whitespace
- ~~h-screen~~ → Always use `min-h-[100dvh]` (iOS Safari bug)
- ~~Complex flexbox calc()~~ → Use CSS Grid instead

**Forbidden Content:**
- ~~Generic names~~ (John Doe) → Use realistic, diverse names
- ~~Round numbers~~ (99.99%) → Use organic data (47.2%, $99.00)
- ~~Startup slop names~~ (Acme, Nexus) → Contextual brand names
- ~~AI copy clichés~~ ("Elevate", "Seamless", "Unleash") → Plain, specific language
- ~~Lorem Ipsum~~ → Real draft copy
- ~~Exclamation marks~~ in success messages → Confident tone
- ~~Title Case on Every Header~~ → Sentence case

**Forbidden Effects:**
- ~~Neon/outer glows~~ → Use inner borders, tinted shadows
- ~~Custom cursors~~ → Outdated, hurts performance
- ~~Linear/ease-in-out~~ → Spring physics, custom cubic-beziers

**Forbidden Components:**
- ~~Unstyled shadcn~~ → Always customize radii/colors/shadows
- ~~Generic card at high density~~ → Use spacing/dividers
- ~~Lucide-only icons~~ → Try Phosphor, Heroicons, custom SVG
- ~~Cliché icons~~ (rocketship for "Launch") → Original metaphors
- ~~3-card testimonial carousels~~ → Masonry, embedded posts, rotating quotes
- ~~Pill-shaped badges~~ → Square badges or plain text
- ~~Avatar circles~~ → Squircles, rounded squares

**AI Tells Quick Checklist:**
- [ ] Inter font used?
- [ ] Purple/blue gradient main aesthetic?
- [ ] Three equal-width cards?
- [ ] Centered hero over dark gradient?
- [ ] "John Doe" or "Acme Corp"?
- [ ] Round placeholder numbers?
- [ ] "Elevate your workflow" copy?
- [ ] Pure #000000 background?
- [ ] Generic spinner (no skeleton)?
- [ ] No hover/active states?

### Premium Design Patterns (30+ Samples)

**Navigation:**
- Mac Dock magnification (icons scale on hover, spring physics)
- Magnetic button (pulls toward cursor)
- Gooey menu (sub-items detach like viscous liquid)
- Dynamic Island morphing
- Fluid island nav (glass pill, mobile hamburger rotation)
- Contextual radial menu
- Mega menu reveal (full-screen stagger-fade)
- Floating speed dial (FAB → curved secondary action line)

**Layout:**
- Asymmetrical bento (CSS Grid masonry, col-span-8 row-span-2)
- Z-axis cascade (card stack with overlap/depth)
- Editorial split (massive left typography, scrollable right cards)
- Split screen scroll (halves slide opposite directions)
- Curtain reveal (hero parts down center on scroll)
- Masonry (Pinterest-style)
- Chroma grid (borders with animated color gradients)

**Cards:**
- Double-bezel (machined hardware look: outer shell + inner core)
- Parallax tilt (3D mouse-track)
- Spotlight border (illuminates under cursor)
- Glassmorphism (true frosted glass: backdrop-blur + inner border + refraction shadow)
- Holographic foil (iridescent rainbow)
- Tinder swipe stack (physical card dismiss)
- Morphing modal (button → full screen dialog)

**Scroll Animations:**
- Revealed on scroll (fade-in + transform)
- Parallax layers (depth via offset velocity)
- Text mask reveal (horizontal/vertical slide)
- Anime.js scroll timeline integration

### Magic UI Components (80+)

**Text Effects (15):**
- Animated Gradient Text, Animated Shiny Text, Aurora Text, Comic Text, Hyper Text (scramble-reveal), Line Shadow Text, Morphing Text, Sparkles Text, Spinning Text, Text Animate, Text Reveal, Typing Animation, Video Text, Word Rotate, Highlighter

**Buttons (5+):**
- Shimmer Button, Shiny Button, Pulsating Button, Rainbow Button, Ripple Button

**Other categories:** Cards, grids, animated counters, scroll effects, form components, etc.

### Bento 2.0 Motion Engine (SaaS Specific)

**Core Philosophy:** High-end, minimal, functional. Every card feels alive.

**Aesthetic:**
- Background: #f9fafb (light) or #050505 (dark)
- Cards: #ffffff (light) / vantablack with bg-white/5 (dark)
- Borders: border-slate-200/50 (light) / border-white/10 (dark)
- All containers: `rounded-[2.5rem]`
- Diffusion shadow: `shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`
- Card titles/descriptions sit **outside and below** card (gallery presentation)
- Padding: `p-8` or `p-10`

**Typography:**
- Geist, Satoshi, or Cabinet Grotesk only (never Inter)
- `tracking-tight` for headers

**Double-Bezel Structure:**
- Outer: `bg-black/5 ring-1 ring-black/5 p-1.5 rounded-[2rem]`
- Inner: own bg + `shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]` + `rounded-[calc(2rem-0.375rem)]`

**Perpetual Micro-Interactions:**
- Spring physics (no linear easing)
- Cards always "alive" (loading states, data updates, hover feedback)
- 150–300ms animation duration

---

## Skill Comparison Matrix

| Dimension | ui-ux-pro-max | frontend-design |
|-----------|---------------|-----------------|
| **Primary Use** | Design decision intelligence | Implementation execution |
| **When to Use** | "What design should I pick?" | "How do I build this without AI slop?" |
| **Activation Point** | Early (Step 1: Analyze Requirements) | After design intent locked (Step 2+: Implement) |
| **Data Inventory** | 300+ rules, 161 palettes, 57 fonts, 99 guidelines, 25 charts | 6 workflows, 30+ patterns, 80+ components, 29 references |
| **Output Type** | Design system (master + page overrides) + recommendations | Production code + anti-slop validation |
| **Tech Stack** | React Native primary, web/iOS/Android secondary | React primary, Three.js/Framer Motion/GSAP secondary |
| **Key Strength** | Systematic design choices with reasoning | Avoiding generic LLM defaults |
| **Pre-delivery Check** | 10-category UX rule validation | AI tells checklist (10-item quick scan) |
| **Unique Feature** | Hierarchical retrieval (master + page overrides) | Design dials (variance/motion/density) |

**Proper Workflow:**
1. Activate ui-ux-pro-max → Generate design system
2. Create initial design mockup (screenshot/prototype)
3. Activate frontend-design → Choose workflow (screenshot/video/3D/quick)
4. Implement with premium patterns + Magic UI
5. Validate with anti-slop checklist + bento engine

---

## Gotchas & Edge Cases

### ui-ux-pro-max

**Query specificity matters:**
- Bad: "modern dashboard" → Generic results
- Good: "fintech trading dashboard dark mode real-time monitoring" → Precise recommendations

**Reasoning rules can override:**
- If ui-reasoning.csv says "minimalism + vibrant = contradiction", skill resolves intelligently
- But user intent precedence: explicit request > inferred recommendation

**Hierarchical retrieval requires discipline:**
- Forgetting to check page overrides → Applies master rules only
- Page file not named consistently → Lookup fails, master applies (safe fallback)

**Stack-specific guidance limited:**
- Primary stack: React Native
- Others (Flutter, SwiftUI) have rules embedded in `--domain web` but not as native stacks
- Web stack recommendations available via `--domain web`

### frontend-design

**Precedence rules:**
- anti-slop rules can conflict with ui-ux-pro-max recommendations (e.g., Inter font in master vs. anti-slop "never Inter")
- Resolution: anti-slop takes precedence (use alternatives from `anti-slop-rules.md`)
- Exception: user explicitly requests conflicting choice

**Design dial extremes:**
- `DESIGN_VARIANCE = 1` + `MOTION_INTENSITY = 10` = Possible but feels contradictory (highly symmetric but constantly moving)
- Need pragmatic reconciliation based on product type

**Magic UI vs. shadcn/ui:**
- Magic UI (80+ flashy components) for marketing/landing pages
- shadcn/ui for admin/dashboard (needs customization)
- Never mix both in same tree (component composition issues)

**Bento Motion Engine scope:**
- SaaS dashboards + feature showcase grids only
- Not suitable for: editorial sites, entertainment UIs, brutalist designs
- Requires perpetual motion (CPU/battery cost trade-off)

**Screenshot replication workflow:**
- Pixel-perfect requires: color extraction + font identification + spacing measurement
- Video replication requires: frame-by-frame analysis + timing documentation
- Both require `ai-multimodal` skill for analysis

---

## Unresolved Questions

1. **ui-ux-pro-max script execution:** Does `search.py` require active Python environment? Venv setup documented but edge case: MacOS vs. Linux vs. Windows path handling for `.venv`?

2. **frontend-design workflow sequencing:** When switching between screenshot + video workflows on same project, does state persist? Or reset per workflow invocation?

3. **Design dial interactions:** Documented pairwise (variance × motion), but what about all three dials combined (variance × motion × density)? Are there other problematic triples?

4. **Magic UI component customization:** Anti-slop says "always customize shadcn components", but Magic UI components (pre-styled) — do they need customization to avoid slop, or are they sufficiently differentiated?

5. **Hierarchical retrieval fallback:** If master.md exists but page file is malformed (syntax error), does skill error or gracefully degrade to master only?

6. **Cross-platform consistency:** If project is React Native + web, how does hierarchy work? One master for both, or separate master files per platform?

7. **Performance guardrails coverage:** frontend-design references `performance-guardrails.md` for animation/blur rules, but does it cover other animations like scroll-triggered or state-driven? Or animation-specific only?

8. **Chart type mapping:** ui-ux-pro-max has 25 chart types, but `--domain chart` queries — does it return all 25 always, or filtered by context/keywords?

---

## Summary Table: Skill Data Completeness

| Category | ui-ux-pro-max | frontend-design | Maturity |
|----------|---------------|-----------------|----------|
| Design Rules | 300+ (10 priority tiers) | Reference only | Mature |
| Color Systems | 161 palettes × 11 tokens | Anti-slop rules | Mature |
| Typography | 57 pairings × 4 fields | Anti-slop typography | Mature |
| Components | Product type mapping | 30+ patterns, 80+ Magic UI | Mature |
| Workflows | 4 search types | 6 implementation workflows | Mature |
| Accessibility | Embedded in rules | Linked (technical-accessibility.md) | Mature |
| Performance | 18 rules | Linked (performance-guardrails.md) | Mature |
| Dark Mode | Color parity rules | Included in patterns | Mature |
| Mobile/Touch | 17 rules + responsive | Design dials account for it | Mature |
| 3D/WebGL | Not covered | Dedicated workflow | Specialized |
| Video/Motion | Not covered | Dedicated workflow | Specialized |

**Assessment:** Both skills are production-ready, complementary, and data-rich. No significant gaps; specialization is intentional.

---

## How to Use This Analysis

**For Implementation Teams:**
- Use ui-ux-pro-max first to generate design system MASTER + page overrides
- Pass MASTER to design team, designers iterate locally, commit overrides
- Once design locked, activate frontend-design
- Choose workflow (screenshot/video/quick/3D) based on input
- Implement with premium patterns + Magic UI
- Validate against anti-slop checklist before code review

**For Design Leads:**
- Baseline recommendations from ui-ux-pro-max (design system generation)
- Contextualize with product strategy
- Document overrides in `design-system/pages/`
- Provide frontend team with page-specific rules

**For QA/Review:**
- ui-ux-pro-max: Run `--domain ux "animation accessibility z-index loading"` before delivery
- frontend-design: Scan for 10-item AI tells checklist
- Both: Verify CRITICAL (§1–§2) + HIGH (§3, §5, §9) rules enforced

