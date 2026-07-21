import Link from 'next/link';
import type { Metadata } from 'next';
import { HeroPipeline } from '@/components/home/hero-pipeline';
import { FeatureClusters } from '@/components/home/feature-clusters';

export const metadata: Metadata = {
  title: 'MeowKit — Enforced discipline for AI coding agents',
};

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:px-12 md:py-24 lg:px-16">
        <div className="flex flex-col gap-6">
          <h1
            className="text-4xl font-bold tracking-tight text-fd-primary md:text-5xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            MeowKit
          </h1>
          <p
            className="text-2xl font-bold tracking-tight md:text-3xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Enforced discipline for AI coding agents
          </p>
          <p className="max-w-[56ch] text-fd-muted-foreground">
            Hard gates, TDD, security scanning, and human approval — so your AI
            agent ships production-quality code, not untested prototypes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/quick-start"
              className="rounded-md bg-fd-primary px-5 py-2.5 font-semibold text-fd-primary-foreground transition-colors hover:opacity-90"
            >
              Get Started →
            </Link>
            <Link
              href="/introduction"
              className="rounded-md border border-fd-primary px-5 py-2.5 font-semibold text-fd-primary transition-colors hover:bg-fd-accent"
            >
              How It Works
            </Link>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <HeroPipeline />
        </div>
      </section>
      <FeatureClusters />
    </main>
  );
}
