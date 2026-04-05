#!/usr/bin/env node
/**
 * OrchViz — Relay Server Builder
 *
 * Bundles the TypeScript relay server into a single CJS file for production use.
 * Uses esbuild to compile scripts/server.ts + all dependencies.
 *
 * Usage: node scripts/build-relay.js
 * Output: dist/relay.cjs
 */
'use strict';

const { build } = require('esbuild');
const path = require('path');

build({
  entryPoints: [path.join(__dirname, 'server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.join(__dirname, '..', 'dist', 'relay.cjs'),
  external: ['fsevents'],
  sourcemap: true,
  minify: false,
}).then(() => {
  console.log('Built dist/relay.cjs');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
