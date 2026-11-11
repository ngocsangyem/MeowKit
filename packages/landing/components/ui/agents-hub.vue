<script setup lang="ts">
/* Feature picture 4: the three install targets around the kit.
 * Names are set as plain text — no third-party logo is reproduced here. */
const CENTRE = { x: 50, y: 56 }
const spokes = [
  { label: 'Claude Code', x: 68, y: 18 },
  { label: 'Codex', x: 18, y: 86 },
  { label: 'Cursor', x: 82, y: 88 },
]
</script>

<template>
  <div class="hub" aria-hidden="true">
    <svg class="hub__wires" viewBox="0 0 100 100" preserveAspectRatio="none">
      <line
        v-for="s in spokes"
        :key="s.label"
        :x1="CENTRE.x" :y1="CENTRE.y" :x2="s.x" :y2="s.y"
        vector-effect="non-scaling-stroke"
      />
    </svg>

    <span class="hub__node hub__node--centre" :style="{ left: `${CENTRE.x}%`, top: `${CENTRE.y}%` }">
      <svg class="hub__mark" viewBox="100 54 152 152"><path d="M116 60l38 38h44l38-38v146H116z" /></svg>
      MeowKit
    </span>

    <span
      v-for="s in spokes"
      :key="s.label"
      class="hub__node"
      :style="{ left: `${s.x}%`, top: `${s.y}%` }"
    >{{ s.label }}</span>
  </div>
</template>

<style scoped>
.hub {
  position: relative;
  width: min(100%, 420px);
  aspect-ratio: 4 / 3;
  margin-inline: auto;
}

.hub__wires { position: absolute; inset: 0; width: 100%; height: 100%; }
/* the hairline colour is all but invisible on the haze stage this sits on —
 * the wires carry the diagram, so they take the muted ink instead */
.hub__wires line { stroke: var(--mk-muted); stroke-width: 1; opacity: 0.55; }

.hub__node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: var(--mk-space-2xs);
  padding: 6px var(--mk-space-xs);
  border: 1px solid var(--mk-line);
  border-radius: var(--mk-radius-button);
  background: var(--mk-paper);
  font-size: 12px;
  color: var(--mk-muted);
  white-space: nowrap;
  box-shadow: var(--mk-lift-card);
}

.hub__node--centre {
  padding: var(--mk-space-2xs) var(--mk-space-sm);
  border-color: var(--mk-ink);
  background: var(--mk-ink);
  font-family: var(--mk-font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--mk-paper);
}
.hub__mark { width: 11px; height: 11px; fill: var(--mk-sky); overflow: visible; }
</style>
