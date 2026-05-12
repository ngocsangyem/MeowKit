<script setup lang="ts">
</script>

<template>
  <section
    class="hero"
    aria-labelledby="hero-heading"
  >
    <!-- Radial gradient wash behind content -->
    <div class="hero__glow-wash" aria-hidden="true" />

    <div class="hero-content container-landing hero__content">
      <!-- Logo with aura -->
      <div class="logo-hero-wrap" aria-hidden="true">
        <img
          src="~/assets/branding/meow-logo-animated.svg"
          alt=""
          width="230"
          height="80"
          class="hero__logo"
          draggable="false"
        />
      </div>

      <!-- Headline -->
      <h1 id="hero-heading" class="hero__heading">
        Enforced Discipline<br />
        <span class="gradient-text">for AI Coding Agents</span>
      </h1>

      <!-- Subheadline -->
      <p class="hero__sub">
        Hard gates, TDD, security scanning, and human approval —<br class="hidden sm:inline" />
        so your AI agent ships production-quality code, not untested prototypes.
      </p>

      <!-- CTAs -->
      <div class="hero__ctas">
        <UButton
          as="a"
          href="#install"
          size="xl"
          trailing-icon="i-heroicons-arrow-right"
          class="hero__cta-primary"
        >
          Get Started
        </UButton>
        <UButton
          as="a"
          href="#how-it-works"
          color="neutral"
          variant="outline"
          size="xl"
        >
          How It Works
        </UButton>
      </div>

      <!-- Badges -->
      <div class="hero__badges" aria-label="Key stats">
        <span class="hero__badge">77 Skills</span>
        <span class="hero__badge-sep" aria-hidden="true">·</span>
        <span class="hero__badge">17 Agents</span>
        <span class="hero__badge-sep" aria-hidden="true">·</span>
        <span class="hero__badge">7-Phase Workflow</span>
        <span class="hero__badge-sep" aria-hidden="true">·</span>
        <span class="hero__badge">MIT Licensed</span>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div class="hero__scroll">
      <ScrollIndicator />
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding-top: 5rem; /* clear fixed navbar */
}

.hero__glow-wash {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 123, 255, 0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 50% 100%, rgba(102, 204, 255, 0.05) 0%, transparent 60%);
  pointer-events: none;
}

.hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1.75rem;
  padding: 3rem 1rem;
}

.hero__logo {
  width: clamp(140px, 30vw, 230px);
  height: auto;
  filter: drop-shadow(0 0 16px rgba(102, 204, 255, 0.2));
}

.hero__heading {
  font-size: clamp(2rem, 5vw, 3.75rem);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #F8FAFC;
  margin: 0;
}

.hero__sub {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: #94A3B8;
  line-height: 1.7;
  max-width: 42rem;
  margin: 0;
}

.hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.875rem;
  justify-content: center;
}

.hero__cta-primary {
  padding: 0.875rem 1.75rem;
  font-size: 1rem;
}

.hero__badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #94A3B8;
  margin-top: 0.5rem;
}

.hero__badge {
  font-family: "Fira Code", monospace;
  color: rgba(102, 204, 255, 0.7);
}

.hero__badge-sep {
  color: rgba(255, 255, 255, 0.15);
}

.hero__scroll {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
}
</style>
