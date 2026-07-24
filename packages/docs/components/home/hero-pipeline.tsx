// CSS-art hero: the MeowKit ship pipeline. Ported 1:1 from the VitePress
// home-hero-pipeline.vue — pure markup on the brand theme tokens.
type Step = { kind: 'phase' | 'gate'; label: string; detail?: string };

const steps: Step[] = [
  { kind: 'phase', label: 'plan' },
  { kind: 'gate', label: 'GATE 1', detail: 'human approval' },
  { kind: 'phase', label: 'build · simplify · verify' },
  { kind: 'gate', label: 'GATE 2', detail: 'review verdict' },
  { kind: 'phase', label: 'ship' },
];

export function HeroPipeline() {
  return (
    <div
      aria-label="MeowKit workflow: plan, Gate 1 human approval, build, Gate 2 review verdict, ship"
      className="w-full max-w-[300px] rounded-lg border border-fd-border bg-fd-card p-4 pb-5 shadow-sm"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      <div className="mb-4 flex items-baseline justify-between border-b border-fd-border pb-3">
        <span className="text-xs font-medium tracking-wider text-fd-muted-foreground">
          workflow
        </span>
        <span className="text-[11px] text-fd-primary">2 hard gates</span>
      </div>
      <ol className="relative m-0 list-none p-0">
        {/* vertical connector */}
        <span
          aria-hidden
          className="absolute bottom-2 left-[5px] top-2 w-px bg-fd-border"
        />
        {steps.map((step) => {
          const isGate = step.kind === 'gate';
          return (
            <li
              key={step.label}
              className="relative flex items-baseline gap-2 py-2 pl-6"
            >
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 size-[11px] -translate-y-1/2 rounded-full border ${
                  isGate
                    ? 'border-fd-primary bg-fd-primary'
                    : 'border-fd-border bg-fd-card'
                }`}
              />
              <span
                className={`text-[13px] break-words ${
                  isGate
                    ? 'font-medium tracking-wide text-fd-primary'
                    : 'text-fd-foreground'
                }`}
              >
                {step.label}
              </span>
              {step.detail ? (
                <span className="text-[11px] break-words text-fd-muted-foreground">
                  {step.detail}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
