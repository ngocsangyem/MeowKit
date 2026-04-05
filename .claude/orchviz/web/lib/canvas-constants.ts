/**
 * OrchViz — Canvas Rendering Constants
 *
 * All timing, sizing, and physics parameters for the Canvas 2D engine.
 * Adapted from Agent Flow's canvas-constants.ts.
 */

// ── Node Geometry ──
export const NODE = {
  radiusMain: 28,
  radiusSub: 20,
  spawnDistance: 250,   // px from parent on spawn
} as const;

// ── Animation Speeds ──
export const ANIM = {
  // Agent fade/scale
  agentFadeIn: 3.0,      // opacity/dt
  agentScaleIn: 4.0,     // scale/dt
  agentFadeOut: 0.4,
  agentScaleOut: 0.05,
  // Tool cards
  toolFadeIn: 4.0,
  toolFadeOut: 1.5,
  toolMinDisplayS: 4.0,  // seconds before complete fades
  toolMaxOrphanS: 10.0,
  // Camera
  autoFitLerp: 0.06,     // per frame
  inertiaDecay: 0.94,
  // Breathe
  breatheThinkSpeed: 2.0,
  breatheThinkAmp: 0.03,
  breatheIdleSpeed: 0.7,
  breatheIdleAmp: 0.015,
  // Scanline
  scanlineThinkSpeed: 40, // px/sec
  scanlineNormalSpeed: 15,
  // Orbit (thinking particles)
  orbitSpeed: 1.5,       // rad/sec
  orbitRadius: 12,       // px from node edge
  orbitCount: 3,
  orbitDotSize: 1.5,
  // UI throttle
  uiThrottleMs: 250,     // React state commit interval
} as const;

// ── Bezier Edges ──
export const BEAM = {
  curvature: 0.15,       // perpendicular offset = dist * this
  segments: 10,          // taper segments
  startWidth: 3,         // px
  endWidth: 1,
  activeGlowAdd: 3,      // extra width for glow overlay
  pulseSpeed: 4,         // Hz
} as const;

// ── Particles (Data Packets) ──
export const PARTICLE = {
  trailSegments: 6,
  trailAlphaBase: 0.5,
  wobbleFreqSpatial: 10,
  wobbleFreqTime: 3,
  wobbleAmp: 3,           // px
  glowRadius: 12,         // px
  baseSpeed: 0.004,       // progress/frame at 60fps
  baseSize: 2.5,
} as const;

// ── Message Bubbles ──
export const BUBBLE = {
  fadeIn: 0.3,            // seconds
  hold: 10.0,
  fadeOut: 1.5,
  maxWidth: 220,          // px
  maxLines: 4,
  gap: 6,                 // px between stacked bubbles
  anchorOffset: 8,        // px right of node
  borderRadius: 5,
  normal: { fontSize: 7, labelSize: 6, lineH: 10, padding: 6, headerH: 12 },
  thinking: { fontSize: 5.5, labelSize: 5, lineH: 7.5, padding: 5, headerH: 10 },
  triOffset: 4,
  triWidth: 5,
} as const;

// ── Tool Call Cards ──
export const TOOL_CARD = {
  maxWidth: 170,
  collapsedHeight: 20,
  expandedHeight: 32,
  borderRadius: 4,
  fontSize: 7,
  tokenFontSize: 6,
  errorFontSize: 6,
  spinRingPadding: 4,
  spinSpeed: 3,           // rad/sec
  spinArc: Math.PI * 1.5,
  errorGlowBase: 6,
  errorGlowPulse: 4,
} as const;

// ── Cost Labels ──
export const COST = {
  pillYOffset: 14,        // px above node center
  pillPadding: 12,
  pillHeight: 16,
  minDisplayCost: 0.001,  // $ threshold
  rate: 3.0,              // $/MTok (Claude Sonnet default)
} as const;

// ── Spawn/Complete Effects ──
export const SPAWN_FX = {
  duration: 0.8,          // seconds
  ringStart: 10,
  ringExpand: 60,
  maxAlpha: 0.7,
  flashThreshold: 0.3,
  flashAlpha: 0.6,
  flashBaseRadius: 20,
  flashMinRadius: 5,
  particleCount: 8,
  particleSize: 1.5,
} as const;

export const COMPLETE_FX = {
  duration: 1.0,
  ringStart: 20,
  ringExpand: 80,
  maxAlpha: 0.6,
  flashThreshold: 0.2,
  flashAlpha: 0.8,
} as const;

// ── Bloom Post-Processing ──
export const BLOOM = {
  enabled: false,         // RT3-3: default OFF, auto-enable if frame budget allows
  intensity: 0.35,
  blurRadii: [6, 4] as readonly number[],
  resolution: 0.5,        // half-res
  frameTimeThreshold: 12,  // ms — enable if frame time < this
} as const;

// ── Background ──
export const BG = {
  dotSpacing: 40,         // px
  dotRadius: 0.8,
  breatheSpeed: 8000,     // ms full cycle
  breatheMin: 0.03,
  breatheMax: 0.06,
} as const;

// ── d3-Force (RT3-2: scale by node count) ──
export const FORCE = {
  chargeBase: -1200,
  linkDistBase: 350,
  collideBase: 140,
  scaleThreshold: 15,     // scale params when count exceeds this
  centerGravity: 0.0003,
  velocityDecay: 0.4,
  alphaDecay: 0.02,
} as const;

// ── Hit Testing ──
export const HIT = {
  nodeExtraPx: 6,         // click radius beyond node edge
  edgeThresholdPx: 8,     // distance to bezier for click
  hoverThrottleMs: 100,
} as const;

// ── Performance ──
export const PERF = {
  maxEventBuffer: 5000,
  minVisibleOpacity: 0.05,
  maxBubblesPerAgent: 20,
} as const;
