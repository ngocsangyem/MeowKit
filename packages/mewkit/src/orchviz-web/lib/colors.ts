/**
 * Color palette and role color definitions.
 *
 * Re-derived from the MeowKit Constellation tokens (see tokens.generated.ts /
 * design-tokens.json). The exported `COLORS` shape is preserved for backward
 * compatibility with every canvas drawer; values are sourced from tokens with
 * a small "Orchviz extensions" block for concepts the constellation token set
 * does not cover (paused state, tool-calling distinction, role bubbles, etc.).
 */

import type { AgentState, ContextBreakdown } from './agent-types'
import { MK_TOKENS } from './tokens.generated'

const T = MK_TOKENS

// State taxonomy bridge: runtime AgentState ↔ token signal.* (lossy by design).
// - tool_calling: kept as Orchviz extension amber to preserve workflow legibility.
// - paused / waiting_permission: kept as Orchviz extension amber; not in tokens.
const EXT = {
  paused: '#ffaa33',
  pausedDim: '#ffaa3380',
  pausedBg: 'rgba(255, 170, 51, 0.15)',
  pausedBorder: 'rgba(255, 170, 51, 0.35)',
  pausedScrim: 'rgba(255, 170, 51, 0.04)',
  toolCalling: '#ffbb44',
} as const

// Mascot blue at varying alphas — replaces the old holo-cyan glass family.
const MASCOT_GLASS = {
  bg03: 'rgba(37, 99, 235, 0.03)',
  bg05: 'rgba(37, 99, 235, 0.05)',
  bg10: 'rgba(37, 99, 235, 0.10)',
  border06: 'rgba(37, 99, 235, 0.06)',
  border08: 'rgba(37, 99, 235, 0.08)',
  border10: 'rgba(37, 99, 235, 0.10)',
  border12: 'rgba(37, 99, 235, 0.12)',
  border15: 'rgba(37, 99, 235, 0.15)',
  border20: 'rgba(37, 99, 235, 0.20)',
  border25: 'rgba(37, 99, 235, 0.25)',
  border30: 'rgba(37, 99, 235, 0.30)',
  border40: 'rgba(37, 99, 235, 0.40)',
  selected15: 'rgba(225, 225, 225, 0.15)',
} as const

const ROLE_BUBBLE = {
  // assistant — sourced from mascot blue family
  assistantBg: 'rgba(37, 99, 235, 0.12)',
  assistantBgSelected: 'rgba(37, 99, 235, 0.22)',
  assistantText: '#A8C5FF',
  // thinking — purple extension
  thinkingBg: 'rgba(140, 100, 200, 0.12)',
  thinkingBgSelected: 'rgba(140, 100, 200, 0.20)',
  thinkingText: '#C0A0E0',
  // user — gold extension
  userBg: 'rgba(200, 160, 80, 0.12)',
  userBgSelected: 'rgba(200, 160, 80, 0.20)',
  userText: '#E0C888',
} as const

export const COLORS = {
  // ─── Backgrounds & surfaces (token-mapped) ──────────────────────────────────
  void: T.color.surface.bg,
  hexGrid: T.color.surface.bgSecondary,

  // Brand wires — replace holo-cyan with mascot blue.
  holoBase: T.color.brand.mascot,
  holoBright: T.color.text.primary,
  holoHot: '#FFFFFF',

  // Agent states (canvas)
  idle: T.color.signal.queued,
  thinking: T.color.signal.thinking,
  tool_calling: EXT.toolCalling,
  complete: T.color.signal.done,
  error: T.color.signal.failed,
  paused: EXT.paused,
  waiting_permission: EXT.paused,
  pausedDim: EXT.pausedDim,
  pausedBg: EXT.pausedBg,
  pausedBorder: EXT.pausedBorder,
  pausedScrim: EXT.pausedScrim,

  // Edge / particle colors
  dispatch: '#CC88FF',
  return: T.color.signal.done,
  tool: EXT.toolCalling,
  message: T.color.brand.mascot,

  // Context breakdown segments
  contextSystem: T.color.text.muted,
  contextUser: T.color.brand.mascot,
  contextToolResults: EXT.toolCalling,
  contextReasoning: '#CC88FF',
  contextSubagent: T.color.signal.done,

  // UI Chrome
  nodeInterior: 'rgba(17, 20, 24, 0.5)',
  textPrimary: T.color.text.primary,
  textDim: T.color.text.secondary,
  textMuted: T.color.text.muted,

  // Glass card / panels
  glassBg: T.color.surface.surfaceAlpha,
  glassBorder: T.color.border.default,
  glassHighlight: T.color.border.strong,

  // Modal scrim — bg surface at low/zero alpha
  scrimVisible: 'rgba(5, 7, 10, 0.55)',
  scrimHidden: 'rgba(5, 7, 10, 0)',
  scrimGate: 'rgba(5, 7, 10, 0.65)',

  // Mascot-blue background opacities (replaces scattered holo rgba literals)
  holoBg03: MASCOT_GLASS.bg03,
  holoBg05: MASCOT_GLASS.bg05,
  holoBg10: MASCOT_GLASS.bg10,
  holoBorder06: MASCOT_GLASS.border06,
  holoBorder08: MASCOT_GLASS.border08,
  holoBorder10: MASCOT_GLASS.border10,
  holoBorder12: MASCOT_GLASS.border12,

  // Panel chrome
  panelBg: T.color.surface.surfaceAlpha,
  panelSeparator: T.color.border.default,

  // Toggle button states
  toggleActive: MASCOT_GLASS.border15,
  toggleInactive: MASCOT_GLASS.bg05,
  toggleBorder: MASCOT_GLASS.border10,

  // Live indicator
  liveDot: T.color.signal.failed,
  liveText: '#FF8A8A',
  liveResumeBg: 'rgba(248, 113, 113, 0.15)',
  liveResumeBorder: 'rgba(248, 113, 113, 0.35)',

  // Discovery type colors — Orchviz extensions (no constellation token)
  discoveryFile: T.color.brand.mascot,
  discoveryPattern: '#CC88FF',
  discoveryFinding: T.color.signal.done,
  discoveryCode: EXT.toolCalling,

  // Session tab states
  tabSelectedBg: MASCOT_GLASS.border15,
  tabInactiveBg: MASCOT_GLASS.bg03,
  tabSelectedBorder: MASCOT_GLASS.border30,
  tabInactiveBorder: MASCOT_GLASS.border08,
  tabClose: '#FF6688',

  // Role colors (message bubbles) — Orchviz extensions
  roleAssistantBg: ROLE_BUBBLE.assistantBg,
  roleAssistantBgSelected: ROLE_BUBBLE.assistantBgSelected,
  roleAssistantText: ROLE_BUBBLE.assistantText,
  roleThinkingBg: ROLE_BUBBLE.thinkingBg,
  roleThinkingBgSelected: ROLE_BUBBLE.thinkingBgSelected,
  roleThinkingText: ROLE_BUBBLE.thinkingText,
  roleUserBg: ROLE_BUBBLE.userBg,
  roleUserBgSelected: ROLE_BUBBLE.userBgSelected,
  roleUserText: ROLE_BUBBLE.userText,

  // Result/success
  resultBg: 'rgba(52, 211, 153, 0.05)',
  resultBorder: 'rgba(52, 211, 153, 0.10)',

  // Unread indicator
  unreadDot: '#FF8A8A',

  // Play button
  playBtnBg: 'rgba(37, 99, 235, 0.12)',
  playBtnActiveBg: 'rgba(37, 99, 235, 0.20)',
  playBtnBorder: MASCOT_GLASS.border40,
  playBtnGlow: '0 0 12px rgba(37, 99, 235, 0.15)',

  // Scrubber
  scrubberFill: 'linear-gradient(90deg, rgba(37,99,235,0.3), rgba(37,99,235,0.6))',
  scrubberHeadGlow: '0 0 10px rgba(37, 99, 235, 0.6), 0 0 20px rgba(37, 99, 235, 0.2)',
  reviewBtnBorder: MASCOT_GLASS.border25,

  // Cost overlay
  costActiveBg: 'rgba(52, 211, 153, 0.15)',

  // Canvas drawing — bubble base colors (partial rgba, alpha appended at draw time)
  bubbleThinkingBase: 'rgba(140, 100, 200,',
  bubbleUserBase: 'rgba(200, 160, 80,',
  bubbleAssistantBase: 'rgba(37, 99, 235,',

  // Canvas drawing — tool card backgrounds (partial rgba, alpha appended at draw time)
  toolCardErrorBase: 'rgba(40, 10, 15,',
  toolCardSelectedBase: 'rgba(37, 99, 235,',
  toolCardBase: 'rgba(17, 20, 24,',

  // Canvas drawing — agent/tool card backgrounds
  cardBgDark: 'rgba(5, 7, 10, 0.8)',
  cardBg: 'rgba(17, 20, 24, 0.6)',
  cardBgSelected: 'rgba(17, 20, 24, 0.8)',
  cardBgError: 'rgba(40, 10, 15, 0.8)',
  cardBgSelectedHolo: MASCOT_GLASS.selected15,
  cardBgFaintOverlay: 'rgba(0, 0, 0, 0.01)',

  // Active tool indicator (detail card)
  toolIndicatorBg: 'rgba(255, 187, 68, 0.10)',
  toolIndicatorBorder: 'rgba(255, 187, 68, 0.20)',
  toolIndicatorText: EXT.toolCalling,

  // Canvas drawing — cost labels
  costText: T.color.signal.done,
  costTextDim: 'rgba(52, 211, 153, 0.5)',
  costPillBg: 'rgba(17, 20, 24, 0.75)',
  costPillStroke: 'rgba(52, 211, 153, 0.30)',

  // Canvas drawing — cost panel bar fills
  barFillMain: 'rgba(37, 99, 235, 0.15)',
  barFillSub: 'rgba(204, 136, 255, 0.15)',

  // ─── Transcript / message feed colors ───────────────────────────────────────
  userMsgBg: 'rgba(255, 187, 68, 0.06)',
  userMsgBorder: 'rgba(255, 187, 68, 0.12)',
  userLabel: 'rgba(255, 187, 68, 0.6)',
  userText: '#FFCC66',

  assistantLabel: 'rgba(37, 99, 235, 0.6)',
  assistantText: T.color.text.primary,

  thinkingBgExpanded: 'rgba(180, 140, 255, 0.06)',
  thinkingBgCollapsed: 'rgba(180, 140, 255, 0.03)',
  thinkingBorder: 'rgba(180, 140, 255, 0.08)',
  thinkingLabel: 'rgba(187, 153, 255, 0.45)',
  thinkingArrow: 'rgba(187, 153, 255, 0.35)',
  thinkingPreview: '#BB99FF',
  thinkingTextExpanded: 'rgba(187, 153, 255, 0.5)',
  thinkingBorderLeft: 'rgba(180, 140, 255, 0.15)',

  toolCallBg: 'rgba(255, 187, 68, 0.05)',
  toolCallBorder: 'rgba(255, 187, 68, 0.10)',

  bashResultBg: 'rgba(0, 0, 0, 0.25)',
  toolResultBg: 'rgba(52, 211, 153, 0.04)',
  bashResultBorder: 'rgba(255, 187, 68, 0.10)',
  toolResultBorder: 'rgba(52, 211, 153, 0.08)',
  bashResultText: 'rgba(248, 250, 252, 0.5)',
  toolResultText: 'rgba(52, 211, 153, 0.5)',
  textFaint: 'rgba(248, 250, 252, 0.38)',

  // Search highlight
  searchHighlightBg: 'rgba(255, 187, 68, 0.30)',

  // ─── Diff / code block colors ───────────────────────────────────────────────
  codeBlockBg: 'rgba(0, 0, 0, 0.3)',
  diffRemoved: T.color.signal.failed,
  diffRemovedBg: 'rgba(248, 113, 113, 0.08)',
  diffAdded: T.color.signal.done,
  diffAddedBg: 'rgba(52, 211, 153, 0.08)',

  // ─── Tool content colors ────────────────────────────────────────────────────
  filePathActive: T.color.brand.mascot,
  filePathInactive: 'rgba(37, 99, 235, 0.6)',
  todoCompleted: T.color.signal.done,
  todoCompletedText: 'rgba(52, 211, 153, 0.6)',
  todoPending: 'rgba(37, 99, 235, 0.4)',
  contentDim: 'rgba(248, 250, 252, 0.55)',
  searchIcon: 'rgba(37, 99, 235, 0.4)',

  // ─── Panel header / chrome text ─────────────────────────────────────────────
  panelLabel: T.color.text.secondary,
  panelLabelDim: T.color.text.muted,
  scrollBtnText: T.color.brand.mascot,
  scrollbarThumb: MASCOT_GLASS.border15,
} as const

// ─── Role Colors (message feed & bubbles) ───────────────────────────────────

export const ROLE_COLORS: Record<string, { bg: string; bgSelected: string; text: string; label: string }> = {
  assistant: { bg: COLORS.roleAssistantBg, bgSelected: COLORS.roleAssistantBgSelected, text: COLORS.roleAssistantText, label: 'CLAUDE' },
  thinking:  { bg: COLORS.roleThinkingBg,  bgSelected: COLORS.roleThinkingBgSelected,  text: COLORS.roleThinkingText,  label: 'THINKING' },
  user:      { bg: COLORS.roleUserBg,       bgSelected: COLORS.roleUserBgSelected,       text: COLORS.roleUserText,       label: 'USER' },
} as const

// ─── Color Helper Functions ──────────────────────────────────────────────────

export function getStateColor(state: AgentState): string {
  switch (state) {
    case 'idle': return T.color.signal.queued
    case 'thinking': return T.color.signal.thinking
    case 'tool_calling': return EXT.toolCalling
    case 'complete': return T.color.signal.done
    case 'error': return T.color.signal.failed
    case 'paused': return EXT.paused
    case 'waiting_permission': return EXT.paused
  }
}

export function getDiscoveryTypeColor(type: string): string {
  switch (type) {
    case 'file': return COLORS.discoveryFile
    case 'pattern': return COLORS.discoveryPattern
    case 'finding': return COLORS.discoveryFinding
    default: return COLORS.discoveryCode
  }
}

/** Safely combine a partial rgba base (e.g. 'rgba(10, 15, 30,') with an alpha value */
export function withAlpha(rgbaBase: string, alpha: number): string {
  return `${rgbaBase} ${alpha})`
}

/** Build the context-breakdown color segments for a given breakdown. */
export function contextSegments(bd: ContextBreakdown) {
  return [
    { value: bd.systemPrompt, color: COLORS.contextSystem },
    { value: bd.userMessages, color: COLORS.contextUser },
    { value: bd.toolResults, color: COLORS.contextToolResults },
    { value: bd.reasoning, color: COLORS.contextReasoning },
    { value: bd.subagentResults, color: COLORS.contextSubagent },
  ]
}
