<script setup lang="ts">
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
    { threshold: 0.1 },
  )

  sectionRef.value?.querySelectorAll('.reveal').forEach(el => observer!.observe(el))
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <section id="how-it-works" class="section-padding hiw" aria-labelledby="hiw-heading">
    <div class="container-landing" ref="sectionRef">
      <!-- Header -->
      <div class="hiw__header reveal">
        <p class="hiw__eyebrow">Process</p>
        <h2 id="hiw-heading" class="hiw__heading">
          The 7-Phase<br />
          <span class="gradient-text">Workflow</span>
        </h2>
        <p class="hiw__sub">
          Every task follows the same enforced sequence — orient, plan, test, build, review, ship, reflect.
          Two hard gates block shipping unreviewed or untested code.
        </p>
      </div>

      <!-- Main content: timeline + comparison -->
      <div class="hiw__body">
        <div class="hiw__timeline reveal">
          <WorkflowTimeline />
        </div>
        <div class="hiw__comparison reveal">
          <p class="hiw__comparison-label">See the difference</p>
          <CodeComparison />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hiw {
  background: linear-gradient(180deg, transparent 0%, rgba(10, 31, 68, 0.3) 50%, transparent 100%);
}

.hiw__header {
  text-align: center;
  margin-bottom: 4rem;
}

.hiw__eyebrow {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #66CCFF;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 0.875rem;
}

.hiw__heading {
  font-size: clamp(1.875rem, 4vw, 3rem);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0 0 1rem;
}

.hiw__sub {
  font-size: 1.0625rem;
  color: #94A3B8;
  line-height: 1.7;
  max-width: 38rem;
  margin: 0 auto;
}

.hiw__body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .hiw__body {
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
  }
}

.hiw__comparison-label {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: rgba(148, 163, 184, 0.6);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 1.25rem;
}
</style>
