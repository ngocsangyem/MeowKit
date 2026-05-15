export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: true,
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },

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
    // crawlLinks is intentionally omitted: `nuxt generate` already pre-renders all routes.
    // Adding prerender here with preset:'vercel' causes Nitro to emit SSR function routes
    // that intercept /__nuxt__/** asset requests, breaking static asset serving on Vercel.
    preset: 'vercel',
    compressPublicAssets: {
      brotli: true,
      gzip: true,
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
    urls: [
      {
        loc: '/',
        changefreq: 'weekly',
        priority: 1.0,
      },
    ],
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'MeowKit',
      url: 'https://meowkit.dev',
      logo: 'https://meowkit.dev/meow-og.png',
      sameAs: [
        'https://github.com/ngocsangyem/MeowKit',
        'https://www.npmjs.com/package/mewkit',
      ],
    },
  },

  // ─── Fonts ──────────────────────────────────────────────────────────────
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 600] },
      { name: 'Fira Code', provider: 'google', weights: [400], display: 'optional' },
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

  experimental: {
    inlineSSRStyles: true,
  },

  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('use-particles') || id.includes('particles-canvas')) {
              return 'particles'
            }
            if (id.includes('node_modules/vue') || id.includes('node_modules/@vue')) {
              return 'vendor-vue'
            }
          },
        },
      },
    },
  },
})
