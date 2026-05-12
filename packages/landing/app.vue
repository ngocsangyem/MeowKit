<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
})
</script>

<template>
  <!-- Global magic particle canvas — fixed, behind all content -->
  <ParticlesCanvas />

  <!-- UApp required for @nuxt/ui Toast, Tooltip, and Programmatic Overlays -->
  <UApp>
    <div class="relative z-10 min-h-screen flex flex-col">
      <TheNavbar />
      <main id="main-content" class="flex-1">
        <NuxtPage />
      </main>
      <TheFooter />
    </div>
  </UApp>
</template>
