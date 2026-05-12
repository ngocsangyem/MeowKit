<script setup lang="ts">
const features = [
  {
    icon: '◈',
    title: '17 Specialist Agents',
    body: 'Dedicated agents for planning, security, review, testing, documentation, and more — each with scoped file ownership and model-tier routing.',
  },
  {
    icon: '◆',
    title: '77 Domain Skills',
    body: 'From database migrations to multimodal AI, frontend design to CTF research — skills activate only when the task demands them.',
  },
  {
    icon: '◑',
    title: 'Cross-Session Memory',
    body: 'Lessons, fixes, review patterns, and architecture decisions persist across sessions. The harness learns from every run.',
  },
  {
    icon: '◎',
    title: 'Scale-Adaptive Intelligence',
    body: 'Domain complexity CSV classifies every task into TRIVIAL, STANDARD, or COMPLEX — routing the right model and scaffolding density automatically.',
  },
  {
    icon: '✦',
    title: 'Party Mode',
    body: 'Multi-agent deliberation for architectural decisions. Multiple agents argue different positions before a decision is made.',
  },
  {
    icon: '◉',
    title: 'Adversarial Review',
    body: 'Gate 2 runs parallel reviewers across correctness, security, design, scope, and craft. Any FAIL blocks the ship.',
  },
  {
    icon: '⬡',
    title: 'Zero External Dependencies',
    body: 'Pure prompt engineering — no SDK required. Works offline, works in any Claude Code environment, no vendor lock-in.',
  },
  {
    icon: '⊞',
    title: 'TDD Pipeline',
    body: 'Opt-in test-first enforcement with RED → GREEN → REFACTOR gates. Self-healing loop with 3-attempt cap and human escalation.',
  },
]

const gridRef = ref<HTMLElement | null>(null)

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
    { threshold: 0.12 },
  )

  if (gridRef.value) {
    observer.observe(gridRef.value)
    gridRef.value.querySelectorAll('.feat-card').forEach((el, i) => {
      ;(el as HTMLElement).style.setProperty('--i', String(i))
    })
  }
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <section id="features" class="section-padding" aria-labelledby="features-heading">
    <div class="container-landing">
      <!-- Header -->
      <div class="feat-header reveal">
        <p class="feat-eyebrow">Capabilities</p>
        <h2 id="features-heading" class="feat-heading">
          Everything the harness<br />
          <span class="gradient-text">enforces for you</span>
        </h2>
      </div>

      <!-- Grid -->
      <div ref="gridRef" class="feat-grid stagger-children">
        <article
          v-for="feat in features"
          :key="feat.title"
          class="feat-card glass"
        >
          <span class="feat-card__icon" aria-hidden="true">{{ feat.icon }}</span>
          <h3 class="feat-card__title">{{ feat.title }}</h3>
          <p class="feat-card__body">{{ feat.body }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.feat-header {
  text-align: center;
  margin-bottom: 3rem;
}

.feat-eyebrow {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #66CCFF;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 0.875rem;
}

.feat-heading {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0;
}

.feat-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .feat-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .feat-grid { grid-template-columns: repeat(4, 1fr); }
}

.feat-card {
  border-radius: var(--radius-md, 10px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
}

.feat-card:hover {
  box-shadow: 0 0 20px rgba(102, 204, 255, 0.1);
  transform: translateY(-2px);
  border-color: rgba(102, 204, 255, 0.15);
}

.feat-card__icon {
  font-size: 1.375rem;
  color: #66CCFF;
  line-height: 1;
}

.feat-card__title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #F8FAFC;
  margin: 0;
}

.feat-card__body {
  font-size: 0.875rem;
  color: #94A3B8;
  line-height: 1.6;
  margin: 0;
}
</style>
