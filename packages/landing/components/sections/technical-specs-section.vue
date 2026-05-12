<script setup lang="ts">
const stats = [
  { value: '77', label: 'Skills' },
  { value: '17', label: 'Agents' },
  { value: '21', label: 'Commands' },
  { value: '7', label: 'Modes' },
  { value: '19', label: 'Rules' },
  { value: '27', label: 'Hooks' },
]

const badges = [
  { text: 'Zero External Dependencies', icon: '◈' },
  { text: 'MIT License', icon: '◎' },
  { text: 'Works Offline', icon: '◆' },
  { text: 'SSR Compatible', icon: '◉' },
]

const sectionRef = ref<HTMLElement | null>(null)

let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer?.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.15 },
  )

  sectionRef.value?.querySelectorAll('.reveal, .stagger-children').forEach(el => observer!.observe(el))
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <section class="section-padding specs" aria-labelledby="specs-heading">
    <div class="container-landing" ref="sectionRef">
      <div class="specs__header reveal">
        <p class="specs__eyebrow">By the numbers</p>
        <h2 id="specs-heading" class="specs__heading">
          Built for scale,<br />
          <span class="gradient-text">measured in precision</span>
        </h2>
      </div>

      <!-- Stats grid -->
      <div class="specs__stats stagger-children">
        <div
          v-for="(stat, i) in stats"
          :key="stat.label"
          class="specs__stat glass"
          :style="{ '--i': i }"
        >
          <span class="specs__stat-value gradient-text">{{ stat.value }}</span>
          <span class="specs__stat-label">{{ stat.label }}</span>
        </div>
      </div>

      <!-- Badges -->
      <div class="specs__badges reveal">
        <span
          v-for="badge in badges"
          :key="badge.text"
          class="specs__badge"
        >
          <span class="specs__badge-icon" aria-hidden="true">{{ badge.icon }}</span>
          {{ badge.text }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.specs {
  background: linear-gradient(180deg, transparent 0%, rgba(10, 31, 68, 0.25) 50%, transparent 100%);
}

.specs__header {
  text-align: center;
  margin-bottom: 3rem;
}

.specs__eyebrow {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #66CCFF;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 0.875rem;
}

.specs__heading {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0;
}

.specs__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 2.5rem;
}

@media (min-width: 640px) {
  .specs__stats { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 1024px) {
  .specs__stats { grid-template-columns: repeat(6, 1fr); }
}

.specs__stat {
  border-radius: var(--radius-md, 10px);
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  text-align: center;
}

.specs__stat-value {
  font-size: 2.25rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.02em;
}

.specs__stat-label {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #94A3B8;
  letter-spacing: 0.04em;
}

.specs__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.specs__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.8125rem;
  color: #94A3B8;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--color-border);
}

.specs__badge-icon {
  color: #66CCFF;
  font-size: 0.75rem;
}
</style>
