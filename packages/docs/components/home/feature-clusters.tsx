// Clustered feature grid. Ported 1:1 from home-feature-clusters.vue.
const clusters = [
  {
    title: 'Enforcement',
    lede: 'What a hook enforces, and what the workflow asks of the agent.',
    items: [
      {
        title: 'Ship Check',
        detail:
          'On commit, push, merge and PR, a hook runs lint on the changed files, their related tests and a type-check, and refuses the command when one fails.',
      },
      {
        title: 'Credential Guard',
        detail:
          'A hook blocks reads of .env files, keys and credential files before the agent sees them, on every runtime that carries the guard. Codex checks shell commands only.',
      },
      {
        title: 'Plan and Review',
        detail:
          'The agent writes a plan and agrees it with you before building, and puts its diff through review before shipping. These are practices in the workflow; no hook blocks an edit on them.',
      },
      {
        title: 'Adversarial Review',
        detail:
          'Parallel reviewers each take one lens (scope, failure modes, security, assumptions) and report against the diff before a verdict.',
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
        title: 'Team Memory',
        detail:
          'Two committed files, decisions.md and gotchas.md, record why a choice was made and what a failure taught. Agents read them with grep at the start of a task.',
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
          'Template-driven task files help agents resume work without losing context. Four task types (feature, bug fix, refactor, security) with acceptance criteria, constraints, and live agent state tracking.',
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
            {/* Cluster titles are the display moment: Newsreader at its text weight,
                which is the weight the brand's serif is cut for. */}
            <h2
              className="text-[28px] font-normal tracking-[-0.022em]"
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
                {/* Card titles stay in Onest — inside a grid of twelve, the sans is the
                    faster read and the serif is reserved for the section above them. */}
                <h3 className="mb-2 text-base font-medium tracking-tight">
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
