import { defineConfig } from 'vitepress'
import llmstxt from 'vitepress-plugin-llms'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  vite: {
    plugins: [llmstxt()],
    optimizeDeps: {
      include: ['mermaid'],
    },
    ssr: {
      noExternal: ['mermaid'],
    },
  },
  title: 'MeowKit',
  description: 'AI agent toolkit for Claude Code — 74+ skills, 16 agents, structured workflow with hard gates, TDD, security scanning, and scale-adaptive routing.',
  lang: 'en-US',
  cleanUrls: true,
  sitemap: {
    hostname: 'https://docs.meowkit.dev',
  },
  srcExclude: ['**/plans/**'],
  head: [
    // Favicons — SVG preferred, raster as legacy fallback
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    // Open Graph defaults
    ['meta', { property: 'og:image', content: 'https://docs.meowkit.dev/og-image.png' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    // SEO essentials
    ['meta', { name: 'author', content: 'ngocsangyem' }],
    ['meta', { name: 'keywords', content: 'claude code, ai agent, toolkit, skills, tdd, code review, meowkit, claude, anthropic' }],
    ['meta', { name: 'twitter:image', content: 'https://docs.meowkit.dev/og-image.png' }],
    ['meta', { name: 'theme-color', content: '#1a1a2e' }],
    // Structured data — SoftwareApplication
    ['script', { type: 'application/ld+json' }, JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'MeowKit',
      description: 'AI agent toolkit for Claude Code with 74+ skills, 16 agents, structured workflow with hard gates, TDD, security scanning, and scale-adaptive routing.',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Linux, Windows',
      url: 'https://docs.meowkit.dev',
      author: { '@type': 'Person', name: 'ngocsangyem', url: 'https://github.com/ngocsangyem' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      license: 'https://opensource.org/licenses/MIT',
    })],
  ],
  transformHead({ pageData }) {
    const head: ([string, Record<string, string>] | [string, Record<string, string>, string])[] = []
    const hostname = 'https://docs.meowkit.dev'
    const pagePath = pageData.relativePath
      .replace(/\.md$/, '')
      .replace(/index$/, '')
    const url = `${hostname}/${pagePath}`

    // Canonical
    head.push(['link', { rel: 'canonical', href: url }])

    // Open Graph per-page
    head.push(['meta', { property: 'og:url', content: url }])
    head.push(['meta', { property: 'og:type', content: 'article' }])
    head.push(['meta', { property: 'og:title', content: pageData.title || 'MeowKit' }])
    head.push(['meta', {
      property: 'og:description',
      content: pageData.frontmatter.description as string || 'AI agent toolkit for Claude Code',
    }])
    head.push(['meta', { property: 'og:site_name', content: 'MeowKit' }])

    // Twitter Card
    head.push(['meta', { name: 'twitter:card', content: 'summary_large_image' }])
    head.push(['meta', { name: 'twitter:title', content: pageData.title || 'MeowKit' }])
    head.push(['meta', {
      name: 'twitter:description',
      content: pageData.frontmatter.description as string || 'AI agent toolkit for Claude Code',
    }])

    // BreadcrumbList for nested pages
    const pathParts = pagePath.split('/').filter(Boolean)
    if (pathParts.length > 1) {
      const breadcrumbs = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: pathParts.map((part, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: part.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          item: `${hostname}/${pathParts.slice(0, i + 1).join('/')}`,
        })),
      }
      head.push(['script', { type: 'application/ld+json' }, JSON.stringify(breadcrumbs)])
    }

    return head
  },
  appearance: 'dark',
  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo-dark.svg' },
    siteTitle: false,
    nav: [
      { text: 'Guide', link: '/introduction' },
      { text: 'CLI', link: '/cli/' },
      { text: 'Reference', link: '/reference/agents/' },
      { text: 'Workflows', link: '/workflows/' },
      { text: 'Cheatsheet', link: '/cheatsheet' },
      {
        text: 'Resources',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Migration: TDD optional', link: '/migration/tdd-optional' },
          { text: 'GitHub Releases', link: 'https://github.com/ngocsangyem/MeowKit/releases' },
          { text: 'npm: mewkit', link: 'https://www.npmjs.com/package/mewkit' },
        ],
      },
    ],
    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/introduction' },
            { text: 'Why MeowKit', link: '/why-meowkit' },
            { text: 'Installation', link: '/installation' },
            { text: 'Quick Start', link: '/quick-start' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'What\'s New', link: '/guide/whats-new',
              items: [
                { text: 'v2.7.0 — The Namespace Rename Release', link: '/guide/whats-new/v2.7.0' },
                { text: 'v2.6.0 — The Skills Compliance Release', link: '/guide/whats-new/v2.6.0' },
                { text: 'v2.5.0 — The Native Fit Release', link: '/guide/whats-new/v2.5.0' },
                { text: 'v2.4.5 — The Thinking Skills Release', link: '/guide/whats-new/v2.4.5' },
                { text: 'v2.4.0 — The Agent Constitution Release', link: '/guide/whats-new/v2.4.0' },
                { text: 'v2.3.12 — Pack + chom v2 Rigor', link: '/guide/whats-new/v2.3.12' },
                { text: 'v2.3.10 — Jira + Confluence + Sprint Planning', link: '/guide/whats-new/v2.3.10' },
                { text: 'v2.3.1 — Plan Creator Intelligence', link: '/guide/whats-new/v2.3.1' },
                { text: 'v2.3.0 — The Hook Dispatch Release', link: '/guide/whats-new/v2.3.0' },
                { text: 'v2.2.0 — Generator/Evaluator Harness', link: '/guide/whats-new/v2.2.0' },
                { text: 'v2.0.0 — The Leverage Release', link: '/guide/whats-new/v2.0.0' },
                { text: 'v1.4.0 — Plan Intelligence', link: '/guide/whats-new/v1.4.0' },
                { text: 'v1.3.2 — Plan Quality', link: '/guide/whats-new/v1.3.2' },
                { text: 'v1.3.1 — Red Team Depth', link: '/guide/whats-new/v1.3.1' },
                { text: 'v1.3.0 — Integration Integrity', link: '/guide/whats-new/v1.3.0' },
                { text: 'v1.2.0 — Memory Activation', link: '/guide/whats-new/v1.2.0' },
                { text: 'v1.1.0 — Reasoning Depth', link: '/guide/whats-new/v1.1.0' },
                { text: 'v1.0.0 — Disciplined Velocity', link: '/guide/whats-new/v1.0.0' },
              ],
              collapsed: true,
            },
            { text: 'Understanding the MeowKit\'s Harness', link: '/guide/understanding-the-harness' },
            { text: 'Philosophy', link: '/guide/philosophy' },
            { text: 'Workflow Phases (0-6)', link: '/guide/workflow-phases' },
            { text: 'Model Routing', link: '/guide/model-routing' },
            { text: 'Memory System', link: '/guide/memory-system' },
            { text: 'Agent-Skill Architecture', link: '/guide/agent-skill-architecture' },
            { text: 'Debugging & Thinking Skills', link: '/guide/debugging-skills-decision-guide' },
            { text: 'Task System', link: '/guide/task-system' },
            { text: 'Harness Architecture', link: '/guide/harness-architecture' },
            { text: 'Adaptive Density', link: '/guide/adaptive-density' },
            { text: 'Rubric Library', link: '/guide/rubric-library' },
            { text: 'Middleware Layer', link: '/guide/middleware-layer' },
            { text: 'Trace & Benchmark', link: '/guide/trace-and-benchmark' },
          ],
        },
      ],
      '/cli/': [
        {
          text: 'CLI Reference',
          items: [
            { text: 'Overview', link: '/cli/' },
            { text: 'Commands', link: '/cli/commands' },
            { text: 'CLI Usage — Migration', link: '/cli/cli-usage' },
            { text: 'Task Commands', link: '/cli/task-commands' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Agents',
          items: [
            { text: 'Overview', link: '/reference/agents/' },
            { text: 'orchestrator', link: '/reference/agents/orchestrator' },
            { text: 'planner', link: '/reference/agents/planner' },
            { text: 'brainstormer', link: '/reference/agents/brainstormer' },
            { text: 'researcher', link: '/reference/agents/researcher' },
            { text: 'architect', link: '/reference/agents/architect' },
            { text: 'tester', link: '/reference/agents/tester' },
            { text: 'security', link: '/reference/agents/security' },
            { text: 'developer', link: '/reference/agents/developer' },
            { text: 'ui-ux-designer', link: '/reference/agents/ui-ux-designer' },
            { text: 'reviewer', link: '/reference/agents/reviewer' },
            { text: 'evaluator', link: '/reference/agents/evaluator' },
            { text: 'shipper', link: '/reference/agents/shipper' },
            { text: 'documenter', link: '/reference/agents/documenter' },
            { text: 'analyst', link: '/reference/agents/analyst' },
            { text: 'journal-writer', link: '/reference/agents/journal-writer' },
            { text: 'git-manager', link: '/reference/agents/git-manager' },
          ],
        },
        {
          text: 'Harness Pipeline',
          collapsed: true,
          items: [
            { text: 'mk:harness', link: '/reference/skills/harness' },
            { text: 'mk:sprint-contract', link: '/reference/skills/sprint-contract' },
            { text: 'mk:evaluate', link: '/reference/skills/evaluate' },
            { text: 'mk:rubric', link: '/reference/skills/rubric' },
            { text: 'mk:trace-analyze', link: '/reference/skills/trace-analyze' },
            { text: 'mk:benchmark', link: '/reference/skills/benchmark' },
          ],
        },
        {
          text: 'Pipeline Skills',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/reference/skills/' },
            { text: 'mk:cook', link: '/reference/skills/cook' },
            { text: 'mk:fix', link: '/reference/skills/fix' },
            { text: 'mk:ship', link: '/reference/skills/ship' },
            { text: 'mk:verify', link: '/reference/skills/verify' },
            { text: 'mk:workflow-orchestrator', link: '/reference/skills/workflow-orchestrator' },
            { text: 'mk:session-continuation', link: '/reference/skills/session-continuation' },
          ],
        },
        {
          text: 'Quality & Review',
          collapsed: true,
          items: [
            { text: 'mk:review', link: '/reference/skills/review' },
            { text: 'mk:elicit', link: '/reference/skills/elicit' },
            { text: 'mk:nyquist', link: '/reference/skills/nyquist' },
            { text: 'mk:cso', link: '/reference/skills/cso' },
            { text: 'mk:vulnerability-scanner', link: '/reference/skills/vulnerability-scanner' },
            { text: 'mk:clean-code', link: '/reference/skills/clean-code' },
            { text: 'mk:lint-and-validate', link: '/reference/skills/lint-and-validate' },
            { text: 'mk:simplify', link: '/reference/skills/simplify' },
          ],
        },
        {
          text: 'Planning & Design',
          collapsed: true,
          items: [
            { text: 'mk:plan-creator', link: '/reference/skills/plan-creator' },
            { text: 'mk:validate-plan', link: '/reference/skills/validate-plan' },
            { text: 'mk:plan-ceo-review', link: '/reference/skills/plan-ceo-review' },
            { text: 'mk:office-hours', link: '/reference/skills/office-hours' },
            { text: 'mk:brainstorming', link: '/reference/skills/brainstorming' },
            { text: 'mk:party', link: '/reference/skills/party' },
            { text: 'mk:decision-framework', link: '/reference/skills/decision-framework' },
            { text: 'mk:intake', link: '/reference/skills/intake' },
          ],
        },
        {
          text: 'Exploration & Research',
          collapsed: true,
          items: [
            { text: 'mk:scout', link: '/reference/skills/scout' },
            { text: 'mk:investigate', link: '/reference/skills/investigate' },
            { text: 'mk:docs-finder', link: '/reference/skills/docs-finder' },
            { text: 'mk:web-to-markdown', link: '/reference/skills/web-to-markdown' },
            { text: 'mk:sequential-thinking', link: '/reference/skills/sequential-thinking' },
            { text: 'mk:problem-solving', link: '/reference/skills/problem-solving' },
            { text: 'mk:chom', link: '/reference/skills/chom' },
            { text: 'mk:henshin', link: '/reference/skills/henshin' },
            { text: 'mk:pack', link: '/reference/skills/pack' },
          ],
        },
        {
          text: 'Browser & QA',
          collapsed: true,
          items: [
            { text: 'mk:qa-manual', link: '/reference/skills/qa-manual' },
            { text: 'mk:qa', link: '/reference/skills/qa' },
            { text: 'mk:browse', link: '/reference/skills/browse' },
            { text: 'mk:agent-browser', link: '/reference/skills/agent-browser' },
            { text: 'mk:playwright-cli', link: '/reference/skills/playwright-cli' },
          ],
        },
        {
          text: 'Frontend',
          collapsed: true,
          items: [
            { text: 'mk:typescript', link: '/reference/skills/typescript' },
            { text: 'mk:vue', link: '/reference/skills/vue' },
            { text: 'mk:angular', link: '/reference/skills/angular' },
            { text: 'mk:react-patterns', link: '/reference/skills/react-patterns' },
            { text: 'mk:frontend-design', link: '/reference/skills/frontend-design' },
            { text: 'mk:ui-design-system', link: '/reference/skills/ui-design-system' },
          ],
        },
        {
          text: 'Backend & Data',
          collapsed: true,
          items: [
            { text: 'mk:api-design', link: '/reference/skills/api-design' },
            { text: 'mk:build-fix', link: '/reference/skills/build-fix' },
            { text: 'mk:database', link: '/reference/skills/database' },
          ],
        },
        {
          text: 'Analysis & Media',
          collapsed: true,
          items: [
            { text: 'mk:multimodal', link: '/reference/skills/multimodal' },
            { text: 'mk:llms', link: '/reference/skills/llms' },
          ],
        },
        {
          text: 'Safety & Scoping',
          collapsed: true,
          items: [
            { text: 'mk:careful', link: '/reference/skills/careful' },
            { text: 'mk:freeze', link: '/reference/skills/freeze' },
            { text: 'mk:skill-template-secure', link: '/reference/skills/skill-template-secure' },
          ],
        },
        {
          text: 'Infrastructure',
          collapsed: true,
          items: [
            { text: 'mk:agent-detector', link: '/reference/skills/agent-detector' },
            { text: 'mk:lazy-agent-loader', link: '/reference/skills/lazy-agent-loader' },
            { text: 'mk:scale-routing', link: '/reference/skills/scale-routing' },
            { text: 'mk:skill-creator', link: '/reference/skills/skill-creator' },
            { text: 'mk:project-organization', link: '/reference/skills/project-organization' },
            { text: 'mk:bootstrap', link: '/reference/skills/bootstrap' },
            { text: 'mk:worktree', link: '/reference/skills/worktree' },
          ],
        },
        {
          text: 'External Integrations',
          collapsed: true,
          items: [
            { text: 'mk:jira', link: '/reference/skills/jira' },
            { text: 'mk:figma', link: '/reference/skills/figma' },
          ],
        },
        {
          text: 'Documentation & Release',
          collapsed: true,
          items: [
            { text: 'mk:docs-init', link: '/reference/skills/docs-init' },
            { text: 'mk:document-release', link: '/reference/skills/document-release' },
            { text: 'mk:retro', link: '/reference/skills/retro' },
          ],
        },
        {
          text: 'Reference Toolkits',
          collapsed: true,
          items: [
            { text: 'mk:development', link: '/reference/skills/development' },
            { text: 'mk:memory', link: '/reference/skills/memory' },
            { text: 'mk:testing', link: '/reference/skills/testing' },
          ],
        },
        {
          text: 'Templates',
          items: [
            { text: 'Overview', link: '/reference/templates/' },
            { text: 'Feature Implementation', link: '/reference/templates/feature-implementation' },
            { text: 'Bug Fix', link: '/reference/templates/bug-fix' },
            { text: 'Refactor', link: '/reference/templates/refactor' },
            { text: 'Security Audit', link: '/reference/templates/security-audit' },
          ],
        },
        {
          text: 'Indexes',
          items: [
            { text: 'Rules Index', link: '/reference/rules-index' },
            { text: 'Agents Index', link: '/reference/agents-index' },
            { text: 'Skills Index', link: '/reference/skills-index' },
          ],
        },
        {
          text: 'Configuration',
          items: [
            { text: 'Hooks', link: '/reference/hooks' },
            { text: 'Configuration', link: '/reference/configuration' },
          ],
        },
      ],
      '/workflows/': [
        {
          text: 'Workflows',
          items: [
            { text: 'Overview', link: '/workflows/' },
            { text: 'Starting a New Project', link: '/workflows/new-project' },
            { text: 'Adding a Feature', link: '/workflows/add-feature' },
            { text: 'Autonomous Build', link: '/workflows/autonomous-build' },
            { text: 'Fixing a Bug', link: '/workflows/fix-bug' },
            { text: 'Code Review', link: '/workflows/code-review' },
            { text: 'Shipping Code', link: '/workflows/ship-code' },
            { text: 'Security Audit', link: '/workflows/security-audit' },
            { text: 'Refactoring', link: '/workflows/refactoring' },
            { text: 'Writing Tests', link: '/workflows/writing-tests' },
            { text: 'QA Testing', link: '/workflows/qa-testing' },
            { text: 'Documentation', link: '/workflows/documentation' },
            { text: 'Sprint Retrospective', link: '/workflows/retrospective' },
            { text: 'Architecture Decisions', link: '/workflows/architecture' },
            { text: 'Frontend Development', link: '/workflows/frontend' },
            { text: 'Researching Libraries', link: '/workflows/research' },
            { text: 'Maintaining Old Projects', link: '/workflows/maintenance' },
            { text: 'PRD Intake Automation', link: '/workflows/prd-intake' },
            { text: 'Tickets with Media', link: '/workflows/ticket-with-media' },
            { text: 'Ticket Evaluation & Estimation', link: '/workflows/ticket-evaluation' },
            { text: 'Spec to Sprint Planning', link: '/workflows/spec-to-sprint' },
            { text: 'Ticket to Code', link: '/workflows/ticket-to-code' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ngocsangyem/MeowKit' },
    ],
    search: {
      provider: 'local',
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Built with MeowKit',
    },
  },
}))
