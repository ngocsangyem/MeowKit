<script setup lang="ts">
const siteUrl = 'https://meowkit.dev'
const title = 'MeowKit — Enforced Discipline for AI Coding Agents'
const description = 'Hard gates, TDD, security scanning, and human approval — so your AI agent ships production-quality code, not untested prototypes.'

// Core SEO meta — nuxt-seo-utils propagates site defaults from nuxt.config
useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogType: 'website',
  ogUrl: siteUrl,
  ogImage: `${siteUrl}/meow-og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'MeowKit — Enforced Discipline for AI Coding Agents',
  twitterCard: 'summary_large_image',
  twitterTitle: title,
  twitterDescription: description,
  twitterImage: `${siteUrl}/meow-og.png`,
  robots: 'index, follow',
  author: 'MeowKit',
})

useHead({
  link: [
    { rel: 'canonical', href: siteUrl },
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify([
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          url: siteUrl,
          name: 'MeowKit',
          description,
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/docs?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'MeowKit',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          url: siteUrl,
          description,
          license: 'https://opensource.org/licenses/MIT',
          datePublished: '2025-01-01',
          dateModified: new Date().toISOString().split('T')[0],
          keywords: 'AI coding agent, TDD, security, Claude Code, developer tools, harness, workflow',
          featureList: [
            'Two-gate approval workflow',
            'TDD enforcement',
            '4-layer security scanning',
            '77 skills, 17 agents',
            'MIT licensed',
          ],
        },
      ]),
    },
  ],
})
</script>

<template>
  <div>
    <HeroSection />
    <ValuePropSection />
    <HowItWorksSection />
    <FeaturesGridSection />
    <TechnicalSpecsSection />
    <InstallationSection />
    <CtaSection />
  </div>
</template>
