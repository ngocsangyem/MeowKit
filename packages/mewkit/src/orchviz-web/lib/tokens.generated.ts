// AUTO-GENERATED — do not edit by hand.
// Source: assets/design-tokens.json
// Run: npm run tokens

import type { CSSProperties } from 'react'

export const MK_TOKENS = {
  color: {
    surface: {
      bg: "#05070A",
      bgSecondary: "#0A1F44",
      surface: "#111418",
      surfaceAlpha: "rgba(17,20,24,0.9)"
    },
    border: {
      default: "rgba(255,255,255,0.05)",
      strong: "rgba(255,255,255,0.10)"
    },
    text: {
      primary: "#F8FAFC",
      secondary: "#94A3B8",
      muted: "#64748B"
    },
    brand: {
      mascot: "#2563EB",
      mascotDeep: "#1E3FA8",
      active: "#E1E1E1"
    },
    signal: {
      queued: "rgba(255,255,255,0.18)",
      thinking: "#60A5FA",
      running: "#2563EB",
      done: "#34D399",
      failed: "#F87171"
    }
  },
  typography: {
    family: {
      ui: "'Inter', system-ui, sans-serif",
      mono: "'Fira Code', 'Geist Mono', ui-monospace, monospace"
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    scale: {
      hero: {
        size: "60px",
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        weight: 400,
        family: "'Inter', system-ui, sans-serif"
      },
      h2: {
        size: "32px",
        lineHeight: 1.15,
        letterSpacing: "-0.01em",
        weight: 500,
        family: "'Inter', system-ui, sans-serif"
      },
      h3: {
        size: "11px",
        lineHeight: 1.4,
        letterSpacing: "0.16em",
        weight: 500,
        family: "'Fira Code', 'Geist Mono', ui-monospace, monospace",
        transform: "uppercase"
      },
      lede: {
        size: "20px",
        lineHeight: 1.5,
        letterSpacing: "0",
        weight: 400,
        family: "'Inter', system-ui, sans-serif"
      },
      body: {
        size: "16px",
        lineHeight: 1.55,
        letterSpacing: "0",
        weight: 400,
        family: "'Inter', system-ui, sans-serif"
      },
      caption: {
        size: "13px",
        lineHeight: 1.45,
        letterSpacing: "0",
        weight: 400,
        family: "'Inter', system-ui, sans-serif"
      },
      label: {
        size: "11px",
        lineHeight: 1.4,
        letterSpacing: "0.10em",
        weight: 500,
        family: "'Fira Code', 'Geist Mono', ui-monospace, monospace",
        transform: "uppercase"
      },
      code: {
        size: "12.5px",
        lineHeight: 1.5,
        letterSpacing: "0",
        weight: 400,
        family: "'Fira Code', 'Geist Mono', ui-monospace, monospace"
      }
    }
  },
  geometry: {
    frame: {
      width: "1280px",
      height: "820px"
    },
    ring: {
      ring1: "230px",
      ring2: "380px"
    },
    node: {
      orchestrator: "56px",
      default: "38px",
      selected: "46px",
      compact: {
        orchestrator: "44px",
        default: "26px",
        selected: "36px"
      }
    },
    panel: {
      width: "360px"
    },
    compass: {
      planner: "-1.5708rad",
      coder: "0rad",
      reviewer: "3.1416rad",
      tests: "1.5708rad"
    },
    spread: {
      ring1Arc: "0.85π",
      ring2Arc: "0.40π"
    }
  },
  radius: {
    sm: "2px",
    md: "4px",
    lg: "6px",
    xl: "8px"
  },
  stroke: {
    hairline: "1px",
    active: "1.5px",
    pulse: "6px"
  },
  effects: {
    glassBlur: "blur(12px)",
    mascotGlow: "0 0 12px rgba(37,99,235,0.7)",
    panelShadow: "0 16px 48px rgba(0,0,0,0.45)",
    wireGlow: "0 0 8px rgba(37,99,235,0.8)"
  },
  motion: {
    duration: {
      snap: "150ms",
      selection: "200ms",
      panel: "250ms",
      cable: "1600ms",
      pulse: "2200ms",
      dash: "900ms"
    },
    easing: {
      default: "cubic-bezier(0.2, 0.7, 0.2, 1)",
      linear: "linear"
    }
  },
  cables: {
    endpointRadius: "2.5px",
    bulletRadius: "3.5px",
    activeDashArray: "3 3"
  }
} as const

export type MkTokens = typeof MK_TOKENS

export const MK_VAR: Record<string, string> = {
  "--mk-color-surface-bg": "#05070A",
  "--mk-color-surface-bg-secondary": "#0A1F44",
  "--mk-color-surface-surface": "#111418",
  "--mk-color-surface-surface-alpha": "rgba(17,20,24,0.9)",
  "--mk-color-border-default": "rgba(255,255,255,0.05)",
  "--mk-color-border-strong": "rgba(255,255,255,0.10)",
  "--mk-color-text-primary": "#F8FAFC",
  "--mk-color-text-secondary": "#94A3B8",
  "--mk-color-text-muted": "#64748B",
  "--mk-color-brand-mascot": "#2563EB",
  "--mk-color-brand-mascot-deep": "#1E3FA8",
  "--mk-color-brand-active": "#E1E1E1",
  "--mk-color-signal-queued": "rgba(255,255,255,0.18)",
  "--mk-color-signal-thinking": "#60A5FA",
  "--mk-color-signal-running": "#2563EB",
  "--mk-color-signal-done": "#34D399",
  "--mk-color-signal-failed": "#F87171",
  "--mk-typography-family-ui": "'Inter', system-ui, sans-serif",
  "--mk-typography-family-mono": "'Fira Code', 'Geist Mono', ui-monospace, monospace",
  "--mk-typography-weight-regular": "400",
  "--mk-typography-weight-medium": "500",
  "--mk-typography-weight-semibold": "600",
  "--mk-typography-weight-bold": "700",
  "--mk-typography-scale-hero-size": "60px",
  "--mk-typography-scale-hero-line-height": "1.05",
  "--mk-typography-scale-hero-letter-spacing": "-0.02em",
  "--mk-typography-scale-hero-weight": "400",
  "--mk-typography-scale-hero-family": "'Inter', system-ui, sans-serif",
  "--mk-typography-scale-h2-size": "32px",
  "--mk-typography-scale-h2-line-height": "1.15",
  "--mk-typography-scale-h2-letter-spacing": "-0.01em",
  "--mk-typography-scale-h2-weight": "500",
  "--mk-typography-scale-h2-family": "'Inter', system-ui, sans-serif",
  "--mk-typography-scale-h3-size": "11px",
  "--mk-typography-scale-h3-line-height": "1.4",
  "--mk-typography-scale-h3-letter-spacing": "0.16em",
  "--mk-typography-scale-h3-weight": "500",
  "--mk-typography-scale-h3-family": "'Fira Code', 'Geist Mono', ui-monospace, monospace",
  "--mk-typography-scale-h3-transform": "uppercase",
  "--mk-typography-scale-lede-size": "20px",
  "--mk-typography-scale-lede-line-height": "1.5",
  "--mk-typography-scale-lede-letter-spacing": "0",
  "--mk-typography-scale-lede-weight": "400",
  "--mk-typography-scale-lede-family": "'Inter', system-ui, sans-serif",
  "--mk-typography-scale-body-size": "16px",
  "--mk-typography-scale-body-line-height": "1.55",
  "--mk-typography-scale-body-letter-spacing": "0",
  "--mk-typography-scale-body-weight": "400",
  "--mk-typography-scale-body-family": "'Inter', system-ui, sans-serif",
  "--mk-typography-scale-caption-size": "13px",
  "--mk-typography-scale-caption-line-height": "1.45",
  "--mk-typography-scale-caption-letter-spacing": "0",
  "--mk-typography-scale-caption-weight": "400",
  "--mk-typography-scale-caption-family": "'Inter', system-ui, sans-serif",
  "--mk-typography-scale-label-size": "11px",
  "--mk-typography-scale-label-line-height": "1.4",
  "--mk-typography-scale-label-letter-spacing": "0.10em",
  "--mk-typography-scale-label-weight": "500",
  "--mk-typography-scale-label-family": "'Fira Code', 'Geist Mono', ui-monospace, monospace",
  "--mk-typography-scale-label-transform": "uppercase",
  "--mk-typography-scale-code-size": "12.5px",
  "--mk-typography-scale-code-line-height": "1.5",
  "--mk-typography-scale-code-letter-spacing": "0",
  "--mk-typography-scale-code-weight": "400",
  "--mk-typography-scale-code-family": "'Fira Code', 'Geist Mono', ui-monospace, monospace",
  "--mk-geometry-frame-width": "1280px",
  "--mk-geometry-frame-height": "820px",
  "--mk-geometry-ring-ring1": "230px",
  "--mk-geometry-ring-ring2": "380px",
  "--mk-geometry-node-orchestrator": "56px",
  "--mk-geometry-node-default": "38px",
  "--mk-geometry-node-selected": "46px",
  "--mk-geometry-node-compact-orchestrator": "44px",
  "--mk-geometry-node-compact-default": "26px",
  "--mk-geometry-node-compact-selected": "36px",
  "--mk-geometry-panel-width": "360px",
  "--mk-geometry-compass-planner": "-1.5708rad",
  "--mk-geometry-compass-coder": "0rad",
  "--mk-geometry-compass-reviewer": "3.1416rad",
  "--mk-geometry-compass-tests": "1.5708rad",
  "--mk-geometry-spread-ring1-arc": "0.85π",
  "--mk-geometry-spread-ring2-arc": "0.40π",
  "--mk-radius-sm": "2px",
  "--mk-radius-md": "4px",
  "--mk-radius-lg": "6px",
  "--mk-radius-xl": "8px",
  "--mk-stroke-hairline": "1px",
  "--mk-stroke-active": "1.5px",
  "--mk-stroke-pulse": "6px",
  "--mk-effects-glass-blur": "blur(12px)",
  "--mk-effects-mascot-glow": "0 0 12px rgba(37,99,235,0.7)",
  "--mk-effects-panel-shadow": "0 16px 48px rgba(0,0,0,0.45)",
  "--mk-effects-wire-glow": "0 0 8px rgba(37,99,235,0.8)",
  "--mk-motion-duration-snap": "150ms",
  "--mk-motion-duration-selection": "200ms",
  "--mk-motion-duration-panel": "250ms",
  "--mk-motion-duration-cable": "1600ms",
  "--mk-motion-duration-pulse": "2200ms",
  "--mk-motion-duration-dash": "900ms",
  "--mk-motion-easing-default": "cubic-bezier(0.2, 0.7, 0.2, 1)",
  "--mk-motion-easing-linear": "linear",
  "--mk-cables-endpoint-radius": "2.5px",
  "--mk-cables-bullet-radius": "3.5px",
  "--mk-cables-active-dash-array": "3 3"
}

/**
 * Resolve a typography scale token into a CSSProperties bag.
 * Use:  style={typoStyle('label')}
 */
export function typoStyle(scale: keyof MkTokens['typography']['scale']): CSSProperties {
  const s = MK_TOKENS.typography.scale[scale] as Record<string, string | number>
  const style: CSSProperties = {
    fontSize: String(s.size),
    lineHeight: typeof s.lineHeight === 'number' ? s.lineHeight : Number(s.lineHeight) || s.lineHeight as never,
    letterSpacing: String(s.letterSpacing),
    fontWeight: typeof s.weight === 'number' ? s.weight : Number(s.weight) || (s.weight as never),
    fontFamily: String(s.family),
  }
  if ('transform' in s && s.transform) {
    style.textTransform = s.transform as CSSProperties['textTransform']
  }
  return style
}

/**
 * NOTE: lane / ring / compass / spread tokens are emitted but NOT bound to
 * runtime layout. The lane glyph activation is gated to claude-runtime
 * agents whose name matches the MeowKit role pattern; binding is deferred
 * to the constellation lane layout effort.
 */
