# HTML Template Contract

Expose `window.onFrame(frameIndex, totalFrames)` in the template when JavaScript drives the animation:

```javascript
window.onFrame = function(frameIndex, totalFrames) {
  const t = frameIndex / totalFrames;
  document.documentElement.style.setProperty('--progress', t);
};
```

The hook lets the renderer seek a deterministic state for each PNG. Without it, the capture helper waits between frames and records CSS animations at natural speed.

## Canvas and WebGL

The same contract applies to canvas and WebGL. Pause an internal `requestAnimationFrame` loop and advance the underlying animation state manually.

```javascript
import gsap from 'gsap';

const tl = gsap.timeline({ paused: true });
window.onFrame = (i, total) => {
  tl.progress(i / total);
};
```
