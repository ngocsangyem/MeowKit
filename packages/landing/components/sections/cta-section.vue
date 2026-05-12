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
    { threshold: 0.2 },
  )

  sectionRef.value?.querySelectorAll('.reveal').forEach(el => observer!.observe(el))
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <section class="section-padding cta" aria-labelledby="cta-heading" ref="sectionRef">
    <!-- Gradient backdrop -->
    <div class="cta__backdrop" aria-hidden="true" />

    <div class="container-landing cta__inner">
      <div class="reveal">
        <p class="cta__eyebrow">Ship better. Now.</p>
        <h2 id="cta-heading" class="cta__heading">
          Ready to ship<br />
          <span class="gradient-text">production-quality AI code?</span>
        </h2>
        <p class="cta__sub">
          The harness is free, open-source, and works inside Claude Code today.
          No sign-up. No external dependencies. Just discipline.
        </p>

        <div class="cta__actions">
          <UButton
            as="a"
            href="#install"
            size="xl"
            trailing-icon="i-heroicons-arrow-right"
            class="cta__primary"
          >
            Get Started Free
          </UButton>
          <div class="cta__links">
            <a
              href="https://meowkit.dev/docs"
              class="cta__link"
              target="_blank"
              rel="noopener noreferrer"
            >Documentation ↗</a>
            <a
              href="https://github.com/meowkit"
              class="cta__link"
              target="_blank"
              rel="noopener noreferrer"
            >GitHub ↗</a>
          </div>
        </div>
      </div>

      <!-- Decorative glow orb -->
      <div class="cta__orb" aria-hidden="true" />
    </div>
  </section>
</template>

<style scoped>
.cta {
  position: relative;
  overflow: hidden;
  text-align: center;
}

.cta__backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0, 123, 255, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.cta__orb {
  position: absolute;
  width: 600px;
  height: 600px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(102, 204, 255, 0.04) 0%, transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: pulse-glow 4s ease-in-out infinite;
}

.cta__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cta__eyebrow {
  font-size: 0.8125rem;
  font-family: "Fira Code", monospace;
  color: #66CCFF;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin: 0 0 0.875rem;
}

.cta__heading {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0 0 1.25rem;
}

.cta__sub {
  font-size: 1.0625rem;
  color: #94A3B8;
  line-height: 1.7;
  max-width: 36rem;
  margin: 0 auto 2.5rem;
}

.cta__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.cta__primary {
  padding: 1rem 2rem;
  font-size: 1.0625rem;
}

.cta__links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.cta__link {
  font-size: 0.9375rem;
  color: #94A3B8;
  text-decoration: none;
  transition: color 0.2s ease;
}
.cta__link:hover { color: #F8FAFC; }
</style>
