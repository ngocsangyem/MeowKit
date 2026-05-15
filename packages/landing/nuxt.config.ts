import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: true,
  css: ['./assets/css/main.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  devtools: { enabled: true },
  app: {
    buildAssetsDir: '/assets/',
  },

  // @nuxt/ui must be first — it registers the Tailwind v4 Vite plugin internally
  modules: [
    '@nuxt/ui',
    '@nuxt/image',
    '@nuxt/fonts',
    '@nuxtjs/seo',
    '@vueuse/nuxt',
    '@vercel/analytics/nuxt',
    '@vercel/speed-insights/nuxt',
  ],

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },

  // ─── Site / SEO ─────────────────────────────────────────────────────────
  site: {
    url: 'https://meowkit.dev',
    name: 'MeowKit',
    description: 'Hard gates, TDD, security scanning, and human approval — so your AI agent ships production-quality code, not untested prototypes.',
    defaultLocale: 'en',
  },

  ogImage: {
    zeroRuntime: true,
  },

  robots: {
    sitemap: '/sitemap.xml',
  },

  sitemap: {
    strictNuxtContentPaths: false,
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'MeowKit',
      url: 'https://meowkit.dev',
      logo: 'https://meowkit.dev/meow-og.png',
    },
  },

  // ─── Fonts ──────────────────────────────────────────────────────────────
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600] },
      { name: 'Fira Code', provider: 'google', weights: [400, 500] },
    ],
    defaults: { preload: true },
  },

  // ─── Image ──────────────────────────────────────────────────────────────
  image: {
    quality: 85,
    format: ['webp', 'png'],
  },

  // ─── @nuxt/ui ───────────────────────────────────────────────────────────
  ui: {
    theme: {
      colors: ['primary', 'neutral'],
    },
  },

  $development: {
    ogImage: { enabled: false },
  },

  linkChecker: {
    skipInspections: ['absolute-site-urls'],
  },

  components: {
    dirs: [
      { path: '~/components', pathPrefix: false },
    ],
  },

  imports: {
    dirs: ['composables/**'],
  },

  typescript: {
    strict: true,
  },
})
