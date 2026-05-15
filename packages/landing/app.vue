<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'en' },
  meta: [
    { name: 'theme-color', content: '#05070A' },
    { name: 'application-name', content: 'MeowKit' },
  ],
  link: [
    // SVG preferred by modern browsers; raster as legacy fallback
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
    { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'dns-prefetch', href: 'https://vitals.vercel-analytics.com' },
    { rel: 'dns-prefetch', href: 'https://va.vercel-scripts.com' },
  ],
})
</script>

<template>
  <!-- Global magic particle canvas — fixed, behind all content, loaded after hydration -->
  <ClientOnly>
    <LazyParticlesCanvas />
  </ClientOnly>

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
