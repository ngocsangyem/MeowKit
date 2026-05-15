<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const ValuePropSection = defineAsyncComponent(() => import('~/components/sections/value-prop-section.vue'))
const HowItWorksSection = defineAsyncComponent(() => import('~/components/sections/how-it-works-section.vue'))
const FeaturesGridSection = defineAsyncComponent(() => import('~/components/sections/features-grid-section.vue'))
const TechnicalSpecsSection = defineAsyncComponent(() => import('~/components/sections/technical-specs-section.vue'))
const InstallationSection = defineAsyncComponent(() => import('~/components/sections/installation-section.vue'))
const CtaSection = defineAsyncComponent(() => import('~/components/sections/cta-section.vue'))

const siteUrl = 'https://meowkit.dev'
// nuxt-seo-utils auto-appends "| MeowKit" — keep this title without the brand prefix
const title = 'Enforced Discipline for AI Coding Agents'
const ogTitle = 'MeowKit — Enforced Discipline for AI Coding Agents'
const description = 'Hard gates, TDD, security scanning, and human approval — so your AI agent ships production-quality code, not untested prototypes.'

// Core SEO meta — nuxt-seo-utils propagates site defaults from nuxt.config
useSeoMeta({
  title,
  description,
  ogTitle,
  ogDescription: description,
  ogType: 'website',
  ogUrl: siteUrl,
  ogLocale: 'en_US',
  ogImage: `${siteUrl}/meow-og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'MeowKit — Enforced Discipline for AI Coding Agents',
  twitterCard: 'summary_large_image',
  twitterTitle: ogTitle,
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
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
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
            '@type': 'SoftwareApplication',
            '@id': `${siteUrl}/#software`,
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
          {
            '@type': 'FAQPage',
            '@id': `${siteUrl}/#faq`,
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What is MeowKit?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'MeowKit is an AI agent toolkit for Claude Code. It installs a .claude/ directory that enforces a structured 7-phase workflow with hard gates, TDD, security scanning, and human approval — so your AI agent ships production-quality code, not untested prototypes.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does the 7-phase workflow work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Every task follows the same enforced sequence: Orient → Plan [Gate 1] → Test → Build → Review [Gate 2] → Ship → Reflect. Two hard gates block shipping unreviewed or untested code — no bypasses, no self-approval.',
                },
              },
              {
                '@type': 'Question',
                name: 'What are the two hard gates?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Gate 1 requires an approved plan before any code is written. Gate 2 requires a passing review verdict before shipping. Both must be cleared by a human — AI agents cannot self-approve.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is MeowKit free to use?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. MeowKit is MIT licensed and free to use. Install with: npx mewkit init',
                },
              },
              {
                '@type': 'Question',
                name: 'What is the 4-layer security scanning in MeowKit?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'MeowKit enforces prompt injection defense across input, instruction, context, and output layers. Untrusted content is treated as data — never instructions. It also blocks hardcoded secrets, SQL injection patterns, and other OWASP Top 10 vulnerabilities.',
                },
              },
            ],
          },
        ],
      }),
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
