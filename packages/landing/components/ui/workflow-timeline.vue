<script setup lang="ts">
const props = withDefaults(defineProps<{
  scrollProgress?: number
}>(), { scrollProgress: 0 })

const phases = [
  { num: '1.0', label: 'Orient', desc: 'Detect task domain, classify complexity, assign model tier and agents.', gate: false },
  { num: '2.0', label: 'Plan', desc: 'Scope-adaptive plan with acceptance criteria. No code until the plan is approved.', gate: true },
  { num: '3.0', label: 'Test', desc: 'Write failing tests first when TDD is enabled. Correctness proof before implementation.', gate: false },
  { num: '4.0', label: 'Build', desc: 'Implement against the approved plan and passing tests. File ownership enforced.', gate: false },
  { num: '5.0', label: 'Review', desc: 'Adversarial structural audit across 5 dimensions. Security scan for BLOCK patterns.', gate: true },
  { num: '6.0', label: 'Ship', desc: 'PR creation, conventional commit, deploy pipeline. Only after Gate 2 clears.', gate: false },
  { num: '7.0', label: 'Reflect', desc: 'Capture lessons, update memory files, run retrospective. Knowledge persists.', gate: false },
]

// Node i activates when line reaches its position (i / (N-1) of total track height)
const activeIndex = computed(() =>
  Math.min(Math.floor(props.scrollProgress * (phases.length - 1)), phases.length - 1),
)

// Measure actual track height: distance from timeline top to top of last stage numeral,
// so the connector line spans first→last stage exactly.
const timelineRef = ref<HTMLElement | null>(null)
const trackHeight = ref('0px')

function updateTrackHeight() {
  const timeline = timelineRef.value
  if (!timeline) return
  const nodes = timeline.querySelectorAll<HTMLElement>('.timeline__stage')
  const lastNode = nodes[nodes.length - 1]
  if (!lastNode) return
  const lastNodeTop = lastNode.getBoundingClientRect().top - timeline.getBoundingClientRect().top
  trackHeight.value = `${Math.max(0, lastNodeTop)}px`
}

onMounted(() => {
  updateTrackHeight()
  window.addEventListener('resize', updateTrackHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTrackHeight)
})
</script>

<template>
  <div ref="timelineRef" class="timeline" role="list" aria-label="7-phase workflow">
    <!-- Connector line: height measured in JS to span first→last stage exactly -->
    <div class="timeline__track" aria-hidden="true" :style="{ height: trackHeight }">
      <div
        class="timeline__track-fill"
        :style="{ transform: `scaleY(${scrollProgress})` }"
      />
    </div>

    <div
      v-for="(phase, i) in phases"
      :key="phase.num"
      role="listitem"
      class="timeline__item"
      :class="{ 'timeline__item--active': i <= activeIndex }"
    >
      <span class="timeline__stage" aria-hidden="true">{{ phase.num }}</span>

      <div class="timeline__content">
        <div class="timeline__header">
          <h3 class="timeline__label">{{ phase.label }}</h3>
          <span v-if="phase.gate" class="timeline__gate-badge">GATE</span>
        </div>
        <p class="timeline__desc">{{ phase.desc }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ─ Connector: hairline rail at the left edge + accent fill scrubbed by scroll ─ */
.timeline__track {
  position: absolute;
  left: 0;
  top: 0.7rem;
  width: 1px;
  background: var(--color-rule-2);
  overflow: hidden;
  z-index: var(--z-base);
}

.timeline__track-fill {
  position: absolute;
  inset: 0;
  background: var(--color-accent);
  transform-origin: top center;
  transform: scaleY(0);
  transition: transform 0.06s linear;
}

/* ─ Items ─ */
.timeline__item {
  display: flex;
  gap: var(--space-md);
  position: relative;
  padding-inline-start: var(--space-md);
  padding-block-end: var(--space-lg);
  opacity: 0.35;
  transition: opacity var(--dur-long) var(--ease-out);
}

.timeline__item--active {
  opacity: 1;
}

.timeline__item:last-child {
  padding-block-end: 0;
}

/* ─ Stage numeral — the machine register carries the sequence ─ */
.timeline__stage {
  flex-shrink: 0;
  width: 3.5ch;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-variant-numeric: tabular-nums;
  line-height: 1.6;
  color: var(--color-muted);
  transition: color var(--dur-long) var(--ease-out);
}

.timeline__item--active .timeline__stage {
  color: var(--color-accent);
}

/* ─ Content ─ */
.timeline__content {
  flex: 1;
  min-width: 0;
}

.timeline__header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-block-end: var(--space-2xs);
}

.timeline__label {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--text-base);
  letter-spacing: -0.01em;
  color: var(--color-ink);
  margin: 0;
}

.timeline__gate-badge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  padding: var(--space-2xs) var(--space-xs);
  border: var(--rule-hair) solid var(--color-accent);
  border-radius: var(--radius-sm);
  color: var(--color-accent);
  letter-spacing: 0.08em;
}

.timeline__desc {
  font-size: var(--text-sm);
  color: var(--color-muted);
  line-height: 1.6;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .timeline__item { opacity: 1; }
}
</style>
