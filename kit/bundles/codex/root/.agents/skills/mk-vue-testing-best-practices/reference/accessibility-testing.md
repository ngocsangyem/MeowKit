---
title: Accessibility Assertions in Vue Tests — Roles, Focus, Keyboard, axe
impact: MEDIUM
impactDescription: Role-based queries catch most a11y regressions for free; focus and keyboard paths need explicit tests
type: best-practice
tags: [vue3, testing, accessibility, a11y, getByRole, focus, keyboard, axe]
---

# Accessibility Assertions in Vue Tests — Roles, Focus, Keyboard, axe

**Impact: MEDIUM** - Querying by role/label (see `testing-component-blackbox-approach.md`)
already doubles as an a11y check: the test fails when an element loses its accessible name.
This reference covers only the *delta* — focus, keyboard, and automated scanning. For a full
a11y audit of the UI itself, use the project's UI-guidelines skill, not this one.

## Task Checklist

- [ ] Query by role/label (`getByRole`, `getByLabelText`) so missing names fail the test
- [ ] Assert focus management for dialogs/menus: `document.activeElement` after open/close
- [ ] Drive keyboard interactions with `trigger('keydown', { key: 'Escape' })`, not only clicks
- [ ] Run `axe` on rendered output for an automated baseline (component-level)

```javascript
import { render, screen, fireEvent } from '@testing-library/vue'
import { axe } from 'vitest-axe'
import Dialog from './Dialog.vue'

test('moves focus to the dialog and closes on Escape', async () => {
  render(Dialog, { props: { open: true } })
  const dialog = screen.getByRole('dialog', { name: /settings/i })
  expect(dialog.contains(document.activeElement)).toBe(true)

  await fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('has no detectable a11y violations', async () => {
  const { container } = render(Dialog, { props: { open: true } })
  expect(await axe(container)).toHaveNoViolations()
})
```

## Reference
- [Testing Library — Accessible queries](https://testing-library.com/docs/queries/byrole/)
- [vitest-axe](https://github.com/chaance/vitest-axe)
