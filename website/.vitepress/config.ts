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
  description: 'AI agent toolkit for Claude Code — 68+ skills, 15 agents, structured workflow with hard gates, TDD, security scanning, and scale-adaptive routing.',
  lang: 'en-US',
  cleanUrls: true,
  sitemap: {
    hostname: 'https://docs.meowkit.dev',
  },
  srcExclude: ['**/plans/**'],
  head: [
    // Favicons
    ['link', { rel: 'icon', href: '/favicon.ico' }],
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
      description: 'AI agent toolkit for Claude Code with 68+ skills, 15 agents, structured workflow with hard gates, TDD, security scanning, and scale-adaptive routing.',
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
    logo: { light: '/logo.webp', dark: '/logo.webp' },
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
          { text: 'npm: create-meowkit', link: 'https://www.npmjs.com/package/create-meowkit' },
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
            { text: 'create-meowkit', link: '/cli/create-meowkit' },
            { text: 'Commands', link: '/cli/commands' },
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
            { text: 'meow:harness', link: '/reference/skills/harness' },
            { text: 'meow:sprint-contract', link: '/reference/skills/sprint-contract' },
            { text: 'meow:evaluate', link: '/reference/skills/evaluate' },
            { text: 'meow:rubric', link: '/reference/skills/rubric' },
            { text: 'meow:trace-analyze', link: '/reference/skills/trace-analyze' },
            { text: 'meow:benchmark', link: '/reference/skills/benchmark' },
          ],
        },
        {
          text: 'Pipeline Skills',
          collapsed: true,
          items: [
            { text: 'Overview', link: '/reference/skills/' },
            { text: 'meow:cook', link: '/reference/skills/cook' },
            { text: 'meow:fix', link: '/reference/skills/fix' },
            { text: 'meow:ship', link: '/reference/skills/ship' },
            { text: 'meow:verify', link: '/reference/skills/verify' },
            { text: 'meow:workflow-orchestrator', link: '/reference/skills/workflow-orchestrator' },
            { text: 'meow:session-continuation', link: '/reference/skills/session-continuation' },
          ],
        },
        {
          text: 'Quality & Review',
          collapsed: true,
          items: [
            { text: 'meow:review', link: '/reference/skills/review' },
            { text: 'meow:elicit', link: '/reference/skills/elicit' },
            { text: 'meow:nyquist', link: '/reference/skills/nyquist' },
            { text: 'meow:cso', link: '/reference/skills/cso' },
            { text: 'meow:vulnerability-scanner', link: '/reference/skills/vulnerability-scanner' },
            { text: 'meow:clean-code', link: '/reference/skills/clean-code' },
            { text: 'meow:lint-and-validate', link: '/reference/skills/lint-and-validate' },
            { text: 'meow:simplify', link: '/reference/skills/simplify' },
          ],
        },
        {
          text: 'Planning & Design',
          collapsed: true,
          items: [
            { text: 'meow:plan-creator', link: '/reference/skills/plan-creator' },
            { text: 'meow:validate-plan', link: '/reference/skills/validate-plan' },
            { text: 'meow:plan-ceo-review', link: '/reference/skills/plan-ceo-review' },
            { text: 'meow:plan-eng-review', link: '/reference/skills/plan-eng-review' },
            { text: 'meow:office-hours', link: '/reference/skills/office-hours' },
            { text: 'meow:brainstorming', link: '/reference/skills/brainstorming' },
            { text: 'meow:party', link: '/reference/skills/party' },
            { text: 'meow:decision-framework', link: '/reference/skills/decision-framework' },
            { text: 'meow:intake', link: '/reference/skills/intake' },
          ],
        },
        {
          text: 'Exploration & Research',
          collapsed: true,
          items: [
            { text: 'meow:scout', link: '/reference/skills/scout' },
            { text: 'meow:investigate', link: '/reference/skills/investigate' },
            { text: 'meow:docs-finder', link: '/reference/skills/docs-finder' },
            { text: 'meow:web-to-markdown', link: '/reference/skills/web-to-markdown' },
            { text: 'meow:sequential-thinking', link: '/reference/skills/sequential-thinking' },
          ],
        },
        {
          text: 'Browser & QA',
          collapsed: true,
          items: [
            { text: 'meow:qa-manual', link: '/reference/skills/qa-manual' },
            { text: 'meow:qa', link: '/reference/skills/qa' },
            { text: 'meow:browse', link: '/reference/skills/browse' },
            { text: 'meow:agent-browser', link: '/reference/skills/agent-browser' },
            { text: 'meow:playwright-cli', link: '/reference/skills/playwright-cli' },
          ],
        },
        {
          text: 'Frontend',
          collapsed: true,
          items: [
            { text: 'meow:typescript', link: '/reference/skills/typescript' },
            { text: 'meow:vue', link: '/reference/skills/vue' },
            { text: 'meow:angular', link: '/reference/skills/angular' },
            { text: 'meow:react-patterns', link: '/reference/skills/react-patterns' },
            { text: 'meow:frontend-design', link: '/reference/skills/frontend-design' },
            { text: 'meow:ui-design-system', link: '/reference/skills/ui-design-system' },
          ],
        },
        {
          text: 'Backend & Data',
          collapsed: true,
          items: [
            { text: 'meow:api-design', link: '/reference/skills/api-design' },
            { text: 'meow:build-fix', link: '/reference/skills/build-fix' },
            { text: 'meow:database', link: '/reference/skills/database' },
          ],
        },
        {
          text: 'Analysis & Media',
          collapsed: true,
          items: [
            { text: 'meow:multimodal', link: '/reference/skills/multimodal' },
            { text: 'meow:llms', link: '/reference/skills/llms' },
          ],
        },
        {
          text: 'Safety & Scoping',
          collapsed: true,
          items: [
            { text: 'meow:careful', link: '/reference/skills/careful' },
            { text: 'meow:freeze', link: '/reference/skills/freeze' },
            { text: 'meow:skill-template-secure', link: '/reference/skills/skill-template-secure' },
          ],
        },
        {
          text: 'Infrastructure',
          collapsed: true,
          items: [
            { text: 'meow:agent-detector', link: '/reference/skills/agent-detector' },
            { text: 'meow:lazy-agent-loader', link: '/reference/skills/lazy-agent-loader' },
            { text: 'meow:scale-routing', link: '/reference/skills/scale-routing' },
            { text: 'meow:skill-creator', link: '/reference/skills/skill-creator' },
            { text: 'meow:project-organization', link: '/reference/skills/project-organization' },
            { text: 'meow:bootstrap', link: '/reference/skills/bootstrap' },
            { text: 'meow:worktree', link: '/reference/skills/worktree' },
          ],
        },
        {
          text: 'External Integrations',
          collapsed: true,
          items: [
            { text: 'meow:jira', link: '/reference/skills/jira' },
            { text: 'meow:figma', link: '/reference/skills/figma' },
          ],
        },
        {
          text: 'Documentation & Release',
          collapsed: true,
          items: [
            { text: 'meow:docs-init', link: '/reference/skills/docs-init' },
            { text: 'meow:document-release', link: '/reference/skills/document-release' },
            { text: 'meow:retro', link: '/reference/skills/retro' },
          ],
        },
        {
          text: 'Reference Toolkits',
          collapsed: true,
          items: [
            { text: 'meow:development', link: '/reference/skills/development' },
            { text: 'meow:documentation', link: '/reference/skills/documentation' },
            { text: 'meow:memory', link: '/reference/skills/memory' },
            { text: 'meow:shipping', link: '/reference/skills/shipping' },
            { text: 'meow:testing', link: '/reference/skills/testing' },
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
