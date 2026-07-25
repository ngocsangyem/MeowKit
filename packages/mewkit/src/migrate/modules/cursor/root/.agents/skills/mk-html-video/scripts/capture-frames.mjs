#!/usr/bin/env node
// Usage: node capture-frames.mjs <htmlFile> <frameDir> <fps> <durationSecs> <width> <height> [bgColor]

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const [, , htmlFile, frameDir, fps, duration, width, height, bgColor] = process.argv;
const totalFrames = Math.ceil(Number(fps) * Number(duration));

if (!htmlFile || !frameDir || !Number.isFinite(totalFrames) || totalFrames < 1) {
  console.error('Usage: capture-frames.mjs <htmlFile> <frameDir> <fps> <durationSecs> <width> <height> [bgColor]');
  process.exit(2);
}

fs.mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: Number(width) || 1920, height: Number(height) || 1080 });
  await page.goto(`file://${path.resolve(htmlFile)}`, { waitUntil: 'networkidle' });

  if (bgColor) {
    await page.addStyleTag({ content: `body { background: ${bgColor} !important; }` });
  }

  await page.waitForTimeout(200);
  const hasFrameHook = await page.evaluate(() => typeof window.onFrame === 'function');

  for (let i = 0; i < totalFrames; i += 1) {
    if (hasFrameHook) {
      await page.evaluate(({ frameIndex, total }) => window.onFrame(frameIndex, total), {
        frameIndex: i,
        total: totalFrames,
      });
    } else {
      await page.waitForTimeout(1000 / Number(fps));
    }

    const frame = String(i).padStart(6, '0');
    await page.screenshot({ path: path.join(frameDir, `frame_${frame}.png`), type: 'png' });
    if (i % 30 === 0) process.stderr.write(`  frame ${i}/${totalFrames}\n`);
  }

  process.stderr.write(`Captured ${totalFrames} frames to ${frameDir}\n`);
} finally {
  await browser.close();
}
