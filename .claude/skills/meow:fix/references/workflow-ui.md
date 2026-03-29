# UI Fix Workflow

For visual bugs, layout issues, responsive problems, and frontend interaction errors.

## Steps

### Step 1: Reproduce
- Use `meow:browse` skill to navigate to the affected page
- Take screenshot of the issue: `snapshot -i -a -o`
- Check browser console for JS errors: `console --errors`
- Test on multiple viewports if responsive issue

### Step 2: Diagnose
- Inspect affected component(s) in source
- Check: CSS specificity conflicts, missing responsive breakpoints, JS state issues
- Use Explore subagents to find related components/styles

### Step 3: Fix

**Layout issues:**
- Check flexbox/grid container properties
- Verify overflow handling
- Check z-index stacking

**Responsive issues:**
- Add/fix media queries or responsive classes
- Test at: mobile (375px), tablet (768px), desktop (1024px+)

**Interaction issues:**
- Check event handlers and state management
- Verify async operations complete before UI updates
- Check for race conditions in state updates

**Vue-specific:**
- NEVER use `v-html` with user content (MeowKit security rule — BLOCK)
- Check reactivity: `ref()` vs `reactive()`, computed dependencies
- Check component lifecycle hooks

### Step 4: Visual Verify
Use `meow:browse` to verify the fix:
- Take after-screenshot, compare with before
- Test all affected viewports
- Check console is clean

### Step 5: Review & Complete
Use reviewer agent. Include before/after screenshots in the report.
