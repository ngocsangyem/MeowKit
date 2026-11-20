<script setup lang="ts">
// Sections are auto-imported from ~/components (pathPrefix: false).
useReveal()

const siteUrl = 'https://meowkit.dev'
// nuxt-seo-utils auto-appends "| MeowKit" — keep this title without the brand prefix
const title = 'A Workflow Kit for AI Coding Agents'
const ogTitle = 'MeowKit: A Workflow Kit for AI Coding Agents'
const description = 'A kit of agents, skills, rules and hooks for AI coding agents. It installs on six runtimes, writes plans and review verdicts you read, and refuses a commit when lint, related tests or the type-check fail.'

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
  ogImageAlt: 'MeowKit: A Workflow Kit for AI Coding Agents',
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
            keywords: 'AI coding agent, Claude Code, Codex, Cursor, Grok, Pi, OMP, developer tools, workflow',
            featureList: [
              'Seven-phase workflow: plan, build, verify, review, ship',
              'Ship check: lint, related tests and type-check before a commit',
              'Credential-file guard',
              'Opt-in TDD',
              'Installs on six runtimes',
              '127 skills, 42 agents',
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
                  text: 'MeowKit is a kit of agents, skills, rules and hooks for AI coding agents. One authored kit installs on Claude Code, Codex, Cursor, Grok, Pi and OMP with mewkit init. It gives the agent a seven-phase workflow, and one hook refuses a commit or push when lint, the related tests or the type-check fail.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does the 7-phase workflow work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Every task follows the same sequence: Orient, Plan, Test, Build (with Simplify and Verify), Review, Ship, Reflect. For a non-trivial task the agent writes a plan and agrees it with you before building, and the reviewer writes a verdict across five dimensions. Both are practices; no hook blocks an edit or a commit on a missing plan or verdict.',
                },
              },
              {
                '@type': 'Question',
                name: 'What does MeowKit enforce?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'One check is enforced by a hook: the ship check. On git commit, git push, git merge and gh pr create or merge, it runs lint on the changed files, the tests related to them and a type-check, and refuses the command when one fails. A credential guard also blocks reads of .env, key and credential files. Test results, review verdicts and advice are evidence for you to read; none of them approves anything.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is MeowKit free to use?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. MeowKit is MIT licensed and free to use. Install the mewkit binary with the script in the docs, then run: mewkit init',
                },
              },
              {
                '@type': 'Question',
                name: 'How does MeowKit handle security?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'A credential guard blocks reads of .env, key and credential files; how far it reaches differs by runtime, and the docs list each one. The rules treat file content, tool output and memory as data and never as instructions, and tell the agent not to write hardcoded secrets or string-built SQL. Those rules are instructions to the agent, not a scanner.',
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
  <!-- No wrapper element: every block of <main> is a <section> of its own.
       Safe as a fragment root because no page transition is configured. -->
  <HeroSection />
  <WorkflowSection />
  <GateRuleSection />
  <FeaturesGridSection />
  <QuestionsSection />
  <InstallationSection />
  <CtaSection />
</template>
