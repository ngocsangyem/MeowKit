# Rendering Performance (MEDIUM priority)

DOM and rendering optimizations for smooth UI.

## rendering-content-visibility
**Problem:** Long lists render all items even when off-screen.
**Fix:** Use `content-visibility: auto` to skip rendering off-screen content.
```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px; /* estimated height */
}
```

## rendering-hoist-jsx
**Problem:** Static JSX recreated every render inside component body.
**Fix:** Extract static JSX outside the component.
```tsx
// BAD: recreated every render
function MyComponent() {
  const header = <h1>Title</h1> // new object each render
  return <div>{header}{/* dynamic content */}</div>
}

// GOOD: created once
const header = <h1>Title</h1>
function MyComponent() {
  return <div>{header}{/* dynamic content */}</div>
}
```

## rendering-conditional-render
**Problem:** `&&` operator can render `0` or `""` to the DOM.
**Fix:** Use ternary for explicit control.
```tsx
// BAD: renders "0" when count is 0
{count && <Badge count={count} />}

// GOOD: renders nothing when count is 0
{count > 0 ? <Badge count={count} /> : null}
```

## rendering-hydration-no-flicker
**Problem:** Client-only values (theme, auth state) cause flash of wrong content after hydration.
**Fix:** Use inline script to set values before React hydrates.
```html
<script dangerouslySetInnerHTML={{ __html: `
  document.documentElement.classList.toggle('dark',
    localStorage.theme === 'dark')
`}} />
```

## rendering-svg-precision
**Problem:** SVG paths with 6+ decimal precision bloat markup.
**Fix:** Reduce to 1-2 decimal places. Use SVGO for automated optimization.
