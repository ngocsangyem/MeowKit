/**
 * OrchViz — Next.js Configuration
 * Static export for standalone deployment.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
