// Clustered feature grid. Ported 1:1 from home-feature-clusters.vue.
const clusters = [
  {
    title: 'Enforcement',
    lede: 'Hard stops the agent cannot talk its way past.',
    items: [
      {
        title: 'Two Hard Gates',
        detail:
          'No code ships without an approved plan (Gate 1) and a passing review (Gate 2). The agent cannot self-approve.',
      },
      {
        title: '4-Layer Security',
        detail:
          'Prompt injection defense across input boundary, instruction anchoring, context isolation, and output validation.',
      },
      {
        title: 'Hook-Based Enforcement',
        detail:
          'Shell hooks block sensitive file reads and source writes before they happen — not after the agent has rationalized past the rule. Rules define why; hooks enforce what.',
      },
      {
        title: 'Adversarial Review',
        detail:
          'Three parallel reviewers — Blind Hunter, Edge Case Hunter, Criteria Auditor — catch 2-3x more bugs than single-pass review.',
      },
    ],
  },
  {
    title: 'Intelligence',
    lede: 'The right specialist, skill, and context for every task.',
    items: [
      {
        title: 'Specialist Agents',
        detail:
          'Each agent owns a specific concern — planning, testing, reviewing, shipping. No two agents modify the same files.',
      },
      {
        title: 'Domain Skills',
        detail:
          'From docs retrieval to multimodal analysis, code review to QA testing. Step-file architecture loads skills on demand, keeping context tight.',
      },
      {
        title: 'Cross-Session Memory',
        detail:
          'Lessons, patterns, and costs persist across sessions. After 10 sessions, the analyst proposes CLAUDE.md improvements.',
      },
      {
        title: 'Scale-Adaptive Intelligence',
        detail:
          'Auto-classifies task complexity by domain at Phase 0. Fintech and healthcare route to COMPLEX automatically — no manual guessing.',
      },
    ],
  },
  {
    title: 'Workflow',
    lede: 'Discipline that survives interruptions and long sessions.',
    items: [
      {
        title: 'TDD Opt-In',
        detail:
          'Opt-in via --tdd or MEOWKIT_TDD=1. When enabled, failing tests must exist before implementation. Default mode keeps spike work fast; production builds opt in for strict discipline.',
      },
      {
        title: 'Structured Task System',
        detail:
          'Template-driven task files help agents resume work without losing context. Five template types with acceptance criteria, constraints, and live agent state tracking.',
      },
      {
        title: 'Party Mode',
        detail:
          '/mk:party for multi-agent deliberation. 2-4 agents debate architecture decisions with forced synthesis before any code is written.',
      },
      {
        title: 'Navigation Help',
        detail:
          '/mk:help scans plans, reviews, tests, and git to determine where you are in the pipeline and prints the single next action. Re-orient instantly after any interruption.',
      },
    ],
  },
];

export function FeatureClusters() {
  return (
    <section
      aria-label="MeowKit features"
      className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8 md:px-12 lg:px-16"
    >
      {clusters.map((cluster) => (
        <div
          key={cluster.title}
          className="border-t border-fd-border pt-8 [&+&]:mt-16"
        >
          <header className="mb-8">
            <h2
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {cluster.title}
            </h2>
            <p className="mt-2 text-[15px] text-fd-muted-foreground">
              {cluster.lede}
            </p>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cluster.items.map((item) => (
              <article
                key={item.title}
                className="rounded-lg border border-fd-border bg-fd-card p-6 transition-colors hover:border-fd-primary/40"
              >
                <h3
                  className="mb-2 text-base font-semibold tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-fd-muted-foreground">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
