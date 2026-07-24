// Canonical site origin. Driven by NEXT_PUBLIC_SITE_URL so preview deploys
// don't assert the production domain; falls back to the production URL.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://docs.meowkit.dev';

export const siteName = 'MeowKit';

export const siteDescription =
  'AI agent toolkit for Claude Code — skills, agents, and a structured workflow with hard gates, TDD, security scanning, and scale-adaptive routing.';
