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
  description: 'AI agent toolkit for Claude Code — 49 skills, 14 agents, structured workflow with hard gates, TDD, security scanning, and scale-adaptive routing.',
  srcExclude: ['**/plans/**'],
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['meta', { property: 'og:image', content: '/og-image.png' }],
  ],
  appearance: 'dark',
  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo-dark.svg' },
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
          { text: 'GitHub Releases', link: 'https://github.com/ngocsangyem/MeowKit/releases' },
          { text: 'npm: create-meowkit', link: 'https://www.npmjs.com/package/create-meowkit' },
          { text: 'npm: meowkit-cli', link: 'https://www.npmjs.com/package/meowkit-cli' },
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
            { text: 'What\'s New', link: '/guide/whats-new' },
            { text: 'Philosophy', link: '/guide/philosophy' },
            { text: 'Workflow Phases (0-6)', link: '/guide/workflow-phases' },
            { text: 'Model Routing', link: '/guide/model-routing' },
            { text: 'Memory System', link: '/guide/memory-system' },
            { text: 'Agent-Skill Architecture', link: '/guide/agent-skill-architecture' },
            { text: 'Task System', link: '/guide/task-system' },
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
            { text: 'shipper', link: '/reference/agents/shipper' },
            { text: 'documenter', link: '/reference/agents/documenter' },
            { text: 'analyst', link: '/reference/agents/analyst' },
            { text: 'journal-writer', link: '/reference/agents/journal-writer' },
            { text: 'git-manager', link: '/reference/agents/git-manager' },
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
            { text: 'meow:workflow-orchestrator', link: '/reference/skills/workflow-orchestrator' },
            { text: 'meow:session-continuation', link: '/reference/skills/session-continuation' },
          ],
        },
        {
          text: 'Quality & Review',
          collapsed: true,
          items: [
            { text: 'meow:review', link: '/reference/skills/review' },
            { text: 'meow:cso', link: '/reference/skills/cso' },
            { text: 'meow:vulnerability-scanner', link: '/reference/skills/vulnerability-scanner' },
            { text: 'meow:clean-code', link: '/reference/skills/clean-code' },
            { text: 'meow:lint-and-validate', link: '/reference/skills/lint-and-validate' },
          ],
        },
        {
          text: 'Planning & Design',
          collapsed: true,
          items: [
            { text: 'meow:plan-creator', link: '/reference/skills/plan-creator' },
            { text: 'meow:plan-ceo-review', link: '/reference/skills/plan-ceo-review' },
            { text: 'meow:plan-eng-review', link: '/reference/skills/plan-eng-review' },
            { text: 'meow:office-hours', link: '/reference/skills/office-hours' },
            { text: 'meow:brainstorming', link: '/reference/skills/brainstorming' },
            { text: 'meow:party', link: '/reference/skills/party' },
          ],
        },
        {
          text: 'Exploration & Research',
          collapsed: true,
          items: [
            { text: 'meow:scout', link: '/reference/skills/scout' },
            { text: 'meow:investigate', link: '/reference/skills/investigate' },
            { text: 'meow:docs-finder', link: '/reference/skills/docs-finder' },
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
            { text: 'meow:skill-creator', link: '/reference/skills/skill-creator' },
            { text: 'meow:project-organization', link: '/reference/skills/project-organization' },
            { text: 'meow:bootstrap', link: '/reference/skills/bootstrap' },
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
