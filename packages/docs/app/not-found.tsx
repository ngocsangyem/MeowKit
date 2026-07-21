import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

export default function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p
          className="text-6xl font-bold text-fd-primary"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          404
        </p>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Page not found
        </h1>
        <p className="max-w-[48ch] text-fd-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-md bg-fd-primary px-5 py-2.5 font-semibold text-fd-primary-foreground transition-colors hover:opacity-90"
        >
          Back to home
        </Link>
      </main>
    </HomeLayout>
  );
}
