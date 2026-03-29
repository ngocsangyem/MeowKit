# MeowKit Design Guideline

## 1. Brand Concept

**Core Idea**

> A magical coding companion

**Visual Direction**

- Minimal, scalable mascot (cat head)
- Blend of:
  - **Technology** → clean geometry, sharp clarity
  - **Magic** → subtle glow, symbolic elements (moon, spark)

- Designed to work across:
  - CLI
  - Docs (VitePress)
  - UI components

---

## 2. Logo System

### 2.1 Structure

**Primary Logo**

- Icon: Cat (head only, symmetrical)
- Logotype: `MeowKit`

**Layouts**

- Vertical (default): icon above text
- Horizontal: icon left, text right

---

### 2.2 Style Rules

**Cat Design**

- Rounded geometry
- Large eyes (AI / intelligence feel)
- Soft triangular ears
- Minimal magical element (choose max 1–2):
  - Crescent moon
  - Gem
  - Spark

**Tech Expression**

- Clean vector lines
- Consistent stroke
- Minimal gradients

---

### 2.3 Do & Don’t

**Do**

- Keep silhouette recognizable at small sizes
- Maintain symmetry
- Use limited color palette

**Don’t**

- Avoid overly detailed illustration
- Avoid complex gradients
- Avoid heavy outlines

---

### 2.4 Safe Area & Sizing

- Safe area: `0.5x` logo width
- Minimum size:
  - Icon: `24px`
  - Full logo: `120px`

---

### 2.5 Background Usage

| Background  | Rule                           |
| ----------- | ------------------------------ |
| Light       | Use primary blue               |
| Dark        | Use lighter blue + subtle glow |
| Transparent | Default export                 |

---

## 3. Color System

### 3.1 Primary Palette (Blue)

```json
{
  "blue-50": "#EBF5FF",
  "blue-100": "#D6EBFF",
  "blue-200": "#ADD6FF",
  "blue-300": "#85C2FF",
  "blue-400": "#5CADFF",
  "blue-500": "#3399FF",
  "blue-600": "#007BFF",
  "blue-700": "#0062CC",
  "blue-800": "#004999",
  "blue-900": "#003066"
}
```

**Usage**

- Primary brand color: `blue-600`
- Hover / highlight: `blue-500`
- Dark mode: `blue-300`

---

### 3.2 Accent Colors (Magic Layer)

```json
{
  "magic-glow": "#66CCFF",
  "magic-soft": "#99DDFF"
}
```

**Usage**

- Eye glow
- Subtle aura
- Decorative spark

---

### 3.3 Neutral Palette

```json
{
  "neutral-0": "#FFFFFF",
  "neutral-50": "#F5F7FA",
  "neutral-100": "#E4E7EC",
  "neutral-300": "#98A2B3",
  "neutral-500": "#667085",
  "neutral-700": "#344054",
  "neutral-900": "#101828"
}
```

---

## 4. Gradient System (Optional)

```json
{
  "gradient-primary": "linear-gradient(135deg, #007BFF 0%, #66CCFF 100%)"
}
```

**Rules**

- Use only for:
  - Landing pages
  - Hero sections

- Avoid in:
  - CLI
  - Small icons

---

## 5. Typography

**Primary Font**

- Inter

**Alternatives**

- System UI
- SF Pro

**Style**

- Weight: 500–600
- Slight tight tracking
- Clean and modern

---

## 6. Icon System

**Style**

- Stroke: `1.5–2px`
- Rounded corners
- Consistent with logo geometry

**Motifs**

- Spark ✦
- Orbit / circle
- Code brackets `{ }` + magic elements

---

## 7. Logo Variants

You should prepare:

- Full logo (color)
- Icon only
- Monochrome (black / white)
- Dark mode version
- Transparent PNG
- SVG (recommended for dev use)

---

## 8. Design Tokens

```json
{
  "color": {
    "primary": "#007BFF",
    "primary-hover": "#3399FF",
    "primary-active": "#0062CC",

    "accent": "#66CCFF",
    "accent-soft": "#99DDFF",

    "background": "#FFFFFF",
    "background-dark": "#101828",

    "text-primary": "#101828",
    "text-secondary": "#667085",

    "border": "#E4E7EC"
  },
  "radius": {
    "sm": "6px",
    "md": "10px",
    "lg": "16px",
    "xl": "24px"
  },
  "shadow": {
    "glow": "0 0 20px rgba(102, 204, 255, 0.35)",
    "soft": "0 4px 12px rgba(0,0,0,0.08)"
  }
}
```

---

## 9. Implementation Notes (Important for MeowKit)

Since MeowKit is a **developer tooling ecosystem**, your logo should support:

- CLI (low-detail rendering)
- Favicon (clear at 16–32px)
- Docs (VitePress)
- UI components

**Recommended**

- Create a simplified “icon-first” version
- Ensure recognizability without text
- Avoid dependency on gradients
