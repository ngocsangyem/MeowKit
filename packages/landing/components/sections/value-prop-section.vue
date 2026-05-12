<script setup lang="ts">
const cards = [
  {
    icon: 'gate',
    title: 'Two Hard Gates',
    body: 'No code ships without an approved plan and a passing review. Every change must clear both stops — no bypasses, no self-approval.',
    accent: '#007BFF',
  },
  {
    icon: 'tdd',
    title: 'TDD Opt-In',
    body: 'Strict test-first discipline when enabled, fast spikes when you need speed. The harness adapts without relaxing quality standards.',
    accent: '#66CCFF',
  },
  {
    icon: 'security',
    title: '4-Layer Security',
    body: 'Prompt injection defense across input, instruction, context, and output layers. Untrusted content is data — never instructions.',
    accent: '#3399FF',
  },
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

  if (sectionRef.value) {
    observer.observe(sectionRef.value)
    sectionRef.value.querySelectorAll('.vp-card').forEach((el, i) => {
      ;(el as HTMLElement).style.setProperty('--i', String(i))
    })
  }
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <section class="section-padding" aria-labelledby="vp-heading">
    <div class="container-landing">
      <div ref="sectionRef" class="stagger-children">
        <div class="vp-header reveal">
          <p class="vp-eyebrow">Why MeowKit</p>
          <h2 id="vp-heading" class="vp-heading">
            The harness<br />
            <span class="gradient-text">is the product</span>
          </h2>
          <p class="vp-sub">
            Models provide intelligence. MeowKit provides the constraints,<br class="hidden md:inline" />
            safety gates, and repeatable workflows that production engineering demands.
          </p>
        </div>

        <div class="vp-grid">
          <article
            v-for="card in cards"
            :key="card.title"
            class="vp-card glass"
          >
            <div class="vp-card__icon" :style="{ '--accent': card.accent }">
              <!-- Gate icon -->
              <svg v-if="card.icon === 'gate'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 12c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286z" />
              </svg>
              <!-- TDD icon -->
              <svg v-else-if="card.icon === 'tdd'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
              </svg>
              <!-- Security icon -->
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h3 class="vp-card__title">{{ card.title }}</h3>
            <p class="vp-card__body">{{ card.body }}</p>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.vp-header {
  text-align: center;
  margin-bottom: 3rem;
}

.vp-eyebrow {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #66CCFF;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 0.875rem;
}

.vp-heading {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0 0 1rem;
}

.vp-sub {
  font-size: 1.0625rem;
  color: #94A3B8;
  line-height: 1.7;
  max-width: 38rem;
  margin: 0 auto;
}

.vp-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}

@media (min-width: 768px) {
  .vp-grid { grid-template-columns: repeat(3, 1fr); }
}

.vp-card {
  border-radius: var(--radius-lg, 16px);
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.vp-card:hover {
  box-shadow: 0 0 24px rgba(102, 204, 255, 0.12);
  transform: translateY(-2px);
}

.vp-card__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(0, 123, 255, 0.1);
  border: 1px solid rgba(102, 204, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.vp-card__icon svg {
  width: 24px;
  height: 24px;
  stroke: var(--accent, #66CCFF);
  color: var(--accent, #66CCFF);
}

.vp-card__title {
  font-size: 1.125rem;
  font-weight: 500;
  color: #F8FAFC;
  margin: 0;
}

.vp-card__body {
  font-size: 0.9375rem;
  color: #94A3B8;
  line-height: 1.65;
  margin: 0;
}
</style>
