<script setup lang="ts">
const props = withDefaults(defineProps<{
  scrollProgress?: number
}>(), { scrollProgress: 0 })

const phases = [
  { num: '01', label: 'Orient', desc: 'Detect task domain, classify complexity, assign model tier and agents.', icon: '◎', gate: false },
  { num: '02', label: 'Plan', desc: 'Scope-adaptive plan with acceptance criteria. No code until the plan is approved.', icon: '◈', gate: true },
  { num: '03', label: 'Test', desc: 'Write failing tests first when TDD is enabled. Correctness proof before implementation.', icon: '◇', gate: false },
  { num: '04', label: 'Build', desc: 'Implement against the approved plan and passing tests. File ownership enforced.', icon: '◆', gate: false },
  { num: '05', label: 'Review', desc: 'Adversarial structural audit across 5 dimensions. Security scan for BLOCK patterns.', icon: '◉', gate: true },
  { num: '06', label: 'Ship', desc: 'PR creation, conventional commit, deploy pipeline. Only after Gate 2 clears.', icon: '▶', gate: false },
  { num: '07', label: 'Reflect', desc: 'Capture lessons, update memory files, run retrospective. Knowledge persists.', icon: '◑', gate: false },
]

// Node i activates when line reaches its position (i / (N-1) of total track height)
const activeIndex = computed(() =>
  Math.min(Math.floor(props.scrollProgress * (phases.length - 1)), phases.length - 1),
)

// Measure actual track height: distance from timeline top to top of last node.
// This equals the center-to-center span since track starts at top:20px (first node center)
// and should end at last node center (lastNodeTop + 20) — so height = lastNodeTop.
const timelineRef = ref<HTMLElement | null>(null)
const trackHeight = ref('0px')

function updateTrackHeight() {
  const timeline = timelineRef.value
  if (!timeline) return
  const nodes = timeline.querySelectorAll<HTMLElement>('.timeline__node')
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
    <!-- Single track line: height measured in JS to span first→last node center exactly -->
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
      :class="{
        'timeline__item--active': i <= activeIndex,
        'timeline__item--current': i === activeIndex,
        'timeline__item--gate': phase.gate,
      }"
    >
      <!-- Node: glows when active, pulses when current -->
      <div class="timeline__node" aria-hidden="true">
        <span class="timeline__icon">{{ phase.icon }}</span>
        <span v-if="i === activeIndex" class="timeline__pulse" />
      </div>

      <!-- Content -->
      <div class="timeline__content">
        <div class="timeline__header">
          <span class="timeline__num">{{ phase.num }}</span>
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

/* ─ Track: full-height background rail + animated fill ─ */
.timeline__track {
  position: absolute;
  left: 19px;   /* center of 40px node */
  top: 20px;    /* center of first node; height set by JS to reach last node center */
  width: 2px;
  background: rgba(102, 204, 255, 0.08);
  border-radius: 1px;
  overflow: hidden;
  z-index: 0;
}

.timeline__track-fill {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    #66CCFF 0%,
    rgba(102, 204, 255, 0.35) 100%
  );
  transform-origin: top center;
  transform: scaleY(0);
  transition: transform 0.06s linear;
  will-change: transform;
}

/* ─ Items ─ */
.timeline__item {
  display: flex;
  gap: 1.25rem;
  position: relative;
  padding-bottom: 1.25rem;
  opacity: 0.3;
  transition: opacity 0.45s ease;
}

.timeline__item--active {
  opacity: 1;
}

.timeline__item:last-child {
  padding-bottom: 0;
}

/* ─ Node ─ */
.timeline__node {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(10, 31, 68, 0.95);
  border: 2px solid rgba(102, 204, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  transition: border-color 0.4s ease, box-shadow 0.4s ease, background 0.4s ease;
}

.timeline__item--active .timeline__node {
  border-color: rgba(102, 204, 255, 0.5);
  box-shadow: 0 0 14px rgba(102, 204, 255, 0.22);
  background: rgba(102, 204, 255, 0.06);
}

/* Current node: brighter glow */
.timeline__item--current .timeline__node {
  border-color: rgba(102, 204, 255, 0.9);
  box-shadow: 0 0 24px rgba(102, 204, 255, 0.5), inset 0 0 8px rgba(102, 204, 255, 0.15);
  background: rgba(102, 204, 255, 0.12);
}

.timeline__item--gate.timeline__item--active .timeline__node {
  background: rgba(0, 123, 255, 0.12);
}

.timeline__icon {
  font-size: 1rem;
  color: #66CCFF;
  transition: filter 0.4s ease;
}

.timeline__item--current .timeline__icon {
  filter: drop-shadow(0 0 5px rgba(102, 204, 255, 0.9));
}

/* ─ Expanding pulse ring on current node ─ */
.timeline__pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1.5px solid rgba(102, 204, 255, 0.5);
  animation: node-pulse 1.6s ease-out infinite;
  pointer-events: none;
}

@keyframes node-pulse {
  0%   { transform: scale(1);   opacity: 0.7; }
  100% { transform: scale(1.9); opacity: 0; }
}

/* ─ Content ─ */
.timeline__content {
  flex: 1;
  padding-top: 0.5rem;
}

.timeline__header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 0.375rem;
}

.timeline__num {
  font-family: "Fira Code", monospace;
  font-size: 0.75rem;
  color: rgba(102, 204, 255, 0.5);
}

.timeline__label {
  font-size: 1rem;
  font-weight: 500;
  color: #F8FAFC;
  margin: 0;
  transition: text-shadow 0.4s ease;
}

.timeline__item--current .timeline__label {
  text-shadow: 0 0 20px rgba(102, 204, 255, 0.3);
}

.timeline__gate-badge {
  font-family: "Fira Code", monospace;
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  color: #85C2FF;
  letter-spacing: 0.08em;
}

.timeline__desc {
  font-size: 0.875rem;
  color: #94A3B8;
  line-height: 1.6;
  margin: 0;
}
</style>
