/**
 * OrchViz — Cyber-Noir Color Palette
 *
 * Aligned with Agent Flow's visual DNA.
 * Tier colors map to MeowKit agent classification.
 */

export const COLORS = {
  // Backgrounds
  bg: '#0B0E14',
  nodeInterior: '#141820',
  glass: 'rgba(20,24,32,0.92)',
  glassBorder: 'rgba(255,255,255,0.06)',

  // Agent tier accents
  cyan: '#7DD3FC',       // orchestrator
  emerald: '#34D399',    // executor
  purple: '#CC88FF',     // validator
  amber: '#FDBA74',      // support

  // Status
  error: '#FF5566',
  warning: '#FDBA74',
  success: '#34D399',

  // Text
  text: '#E0E0E8',
  muted: '#6A6A80',
  dim: '#4A4A5E',

  // Message bubbles
  bubbleAssistant: '#7DD3FC',
  bubbleUser: '#34D399',
  bubbleThinking: '#CC88FF',
  bubbleReport: '#34D399',

  // Tool cards
  toolRunning: '#FDBA74',
  toolComplete: '#6A6A80',
  toolError: '#FF5566',

  // Cost
  costPill: 'rgba(125,211,252,0.12)',
  costText: '#7DD3FC',
} as const;

/** Get tier color by tier name */
export function tierColor(tier: string): string {
  switch (tier) {
    case 'orchestrator': return COLORS.cyan;
    case 'executor': return COLORS.emerald;
    case 'validator': return COLORS.purple;
    case 'support': return COLORS.amber;
    default: return COLORS.muted;
  }
}

/** Convert hex color + alpha to rgba string. e.g. '#7DD3FC', 0.5 → 'rgba(125,211,252,0.5)' */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
