import Link from 'next/link';

// Placeholder home page — the full landing (hero, feature clusters) is built
// in the navigation/landing parity phase.
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        MeowKit
      </h1>
      <p className="text-fd-muted-foreground">
        Production-discipline harness for AI coding agents.
      </p>
      <Link
        href="/introduction"
        className="rounded-md bg-fd-primary px-4 py-2 font-semibold text-fd-primary-foreground"
      >
        Get Started
      </Link>
    </main>
  );
}
