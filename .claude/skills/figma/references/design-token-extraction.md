# Design Token Extraction

Patterns for extracting design tokens from Figma and converting to code.
Load this file only when mk:figma is in **tokens** mode.

## Contents

- [Color Tokens](#color-tokens)
- [Typography Tokens](#typography-tokens)
- [Spacing Tokens](#spacing-tokens)
- [Shadow Tokens](#shadow-tokens)
- [Border Radius Tokens](#border-radius-tokens)
- [Variable Naming Convention](#variable-naming-convention)
- [Variable API Caveats & Permissions](#variable-api-caveats--permissions)
- [Output File Structure](#output-file-structure)


## Color Tokens

Source: Figma color styles + local variables.

```
Figma color (0–1) → CSS hex / Tailwind config
{ r: 0.2, g: 0.4, b: 1.0 } → #3366ff
```

Output formats:

```css
/* CSS custom properties */
:root {
  --color-primary-500: #3366ff;
  --color-neutral-100: #f5f5f5;
  --color-error-600: #dc2626;
}
```

```js
// Tailwind config extension
colors: {
  primary: { 500: '#3366ff' },
  neutral: { 100: '#f5f5f5' },
  error: { 600: '#dc2626' },
}
```

## Typography Tokens

Source: Figma text styles.

```css
:root {
  --font-family-sans: 'Inter', sans-serif;
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-weight-normal: 400;
  --font-weight-semibold: 600;
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --letter-spacing-tight: -0.025em;
}
```

## Spacing Tokens

Source: Figma spacing values. Base unit: 4px.

```css
:root {
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-12: 3rem;     /* 48px */
  --spacing-16: 4rem;     /* 64px */
}
```

## Shadow Tokens

Source: Figma effect styles (drop shadow).

```css
:root {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

Figma shadow fields: `x`, `y`, `blur`, `spread`, `color` (0–1 with alpha).

## Border Radius Tokens

```css
:root {
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.375rem;  /* 6px */
  --radius-lg: 0.5rem;    /* 8px */
  --radius-xl: 0.75rem;   /* 12px */
  --radius-full: 9999px;
}
```

## Variable Naming Convention

Pattern: `category/subcategory/scale`

```
color/primary/500     → --color-primary-500
color/neutral/100     → --color-neutral-100
spacing/md            → --spacing-4 (map to 4px base scale)
font/heading/lg       → --font-size-lg + --font-weight-semibold
shadow/card           → --shadow-md
radius/button         → --radius-md
```

## Variable API Caveats & Permissions

Fail loud and early on plan/permission limits instead of writing a half-broken token file.

- **Local variables are gated to full members of Enterprise orgs.** The local-variables endpoints
  return 403 for non-eligible plans/seats — surface the permission requirement to the user, do not retry blindly.
- **Variable endpoints require specific scopes** — request the narrowest scope needed.
- **Published vs local variables differ** — published variables come from a library; local variables live
  in the file. Confirm which set the user wants before extracting.
- **Format differs: Variables vs Color Styles.** Figma Variables export colors as `{ r, g, b, a }` float
  objects (0–1 range); Color Styles (`search_design_system`) return `rgba()` strings. Normalize to ONE
  format before writing token files — mixing them silently produces half the tokens in the wrong format.

## Output File Structure

```
tokens/
├── colors.css          # Color custom properties
├── typography.css      # Font tokens
├── spacing.css         # Spacing scale
├── shadows.css         # Shadow effects
└── index.css           # @import all token files
```

Or for Tailwind: extend `tailwind.config.ts` theme section directly.