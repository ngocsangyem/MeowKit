<script setup lang="ts">
const phases = [
  { num: '01', label: 'Orient', desc: 'Detect task domain, classify complexity, assign model tier and agents.', icon: '◎', gate: false },
  { num: '02', label: 'Plan', desc: 'Scope-adaptive plan with acceptance criteria. No code until the plan is approved.', icon: '◈', gate: true },
  { num: '03', label: 'Test', desc: 'Write failing tests first when TDD is enabled. Correctness proof before implementation.', icon: '◇', gate: false },
  { num: '04', label: 'Build', desc: 'Implement against the approved plan and passing tests. File ownership enforced.', icon: '◆', gate: false },
  { num: '05', label: 'Review', desc: 'Adversarial structural audit across 5 dimensions. Security scan for BLOCK patterns.', icon: '◉', gate: true },
  { num: '06', label: 'Ship', desc: 'PR creation, conventional commit, deploy pipeline. Only after Gate 2 clears.', icon: '▶', gate: false },
  { num: '07', label: 'Reflect', desc: 'Capture lessons, update memory files, run retrospective. Knowledge persists.', icon: '◑', gate: false },
]

const phaseRefs = ref<HTMLElement[]>([])
const activeIndex = ref(-1)

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Number((entry.target as HTMLElement).dataset.idx)
          if (!isNaN(idx) && idx > activeIndex.value) activeIndex.value = idx
        }
      }
    },
    { threshold: 0.5 },
  )

  phaseRefs.value.forEach(el => observer!.observe(el))
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="timeline" role="list" aria-label="7-phase workflow">
    <div
      v-for="(phase, i) in phases"
      :key="phase.num"
      ref="phaseRefs"
      :data-idx="i"
      role="listitem"
      class="timeline__item"
      :class="{ 'timeline__item--active': i <= activeIndex, 'timeline__item--gate': phase.gate }"
    >
      <!-- Connector line -->
      <div v-if="i < phases.length - 1" class="timeline__line" aria-hidden="true" />

      <!-- Phase node -->
      <div class="timeline__node" aria-hidden="true">
        <span class="timeline__icon">{{ phase.icon }}</span>
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
  gap: 0;
  position: relative;
}

.timeline__item {
  display: flex;
  gap: 1.25rem;
  position: relative;
  padding-bottom: 2rem;
  opacity: 0.4;
  transition: opacity 0.5s ease;
}
.timeline__item--active { opacity: 1; }
.timeline__item:last-child { padding-bottom: 0; }

.timeline__line {
  position: absolute;
  left: 19px;
  top: 40px;
  bottom: 0;
  width: 2px;
  background: linear-gradient(to bottom, rgba(102, 204, 255, 0.3), rgba(102, 204, 255, 0.05));
}

.timeline__node {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-dark-secondary, #0A1F44);
  border: 2px solid rgba(102, 204, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
  z-index: 1;
}

.timeline__item--active .timeline__node {
  border-color: rgba(102, 204, 255, 0.6);
  box-shadow: 0 0 12px rgba(102, 204, 255, 0.25);
}

.timeline__item--gate .timeline__node {
  background: rgba(0, 123, 255, 0.15);
}

.timeline__icon {
  font-size: 1rem;
  color: #66CCFF;
}

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
