---
title: Test Forms — Drive Inputs Like a User, Assert Validation and Emitted Payloads
impact: HIGH
impactDescription: Form tests that set internal state or skip awaiting interactions miss validation regressions and submit-payload bugs
type: best-practice
tags: [vue3, testing, forms, setValue, validation, emitted, vitest, vue-test-utils, accessibility]
---

# Test Forms — Drive Inputs Like a User, Assert Validation and Emitted Payloads

**Impact: HIGH** - Forms are where async, validation, and emitted payloads intersect. Tests
that mutate component state directly (instead of `setValue`/`trigger`) or that skip `await`
silently pass while real validation and submit logic regress.

## Task Checklist

- [ ] Fill fields with `await field.setValue(...)`, never by writing to `wrapper.vm`
- [ ] Query fields accessibly — by label/role first, `data-testid` as fallback
- [ ] Submit with `await form.trigger('submit')` (covers `submit.prevent`), not by calling the handler
- [ ] Assert the emitted payload shape: `wrapper.emitted('submit')[0]`
- [ ] Test the invalid path: validation messages shown, submit NOT emitted
- [ ] `await flushPromises()` for async submit; assert loading → success/error states

**Incorrect:**
```javascript
// BAD: mutates internals, calls the handler directly, no await
test('submits the form', () => {
  const wrapper = mount(ContactForm)
  wrapper.vm.email = 'a@b.com'      // implementation detail
  wrapper.vm.submit()               // bypasses native submit + validation
  expect(wrapper.emitted('submit')).toBeTruthy()
})
```

**Correct — happy path:**
```javascript
import { mount, flushPromises } from '@vue/test-utils'
import ContactForm from './ContactForm.vue'

test('emits the trimmed payload and shows success', async () => {
  const wrapper = mount(ContactForm)

  await wrapper.find('[data-testid="name"]').setValue('  Ada  ')
  await wrapper.find('[data-testid="email"]').setValue('ada@example.com')
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  expect(wrapper.emitted('submit')[0]).toEqual([{ name: 'Ada', email: 'ada@example.com' }])
  expect(wrapper.find('[data-testid="success"]').exists()).toBe(true)
})
```

**Correct — invalid path (the one most suites forget):**
```javascript
test('blocks submit and shows an error when email is invalid', async () => {
  const wrapper = mount(ContactForm)

  await wrapper.find('[data-testid="email"]').setValue('not-an-email')
  await wrapper.find('form').trigger('submit')

  expect(wrapper.find('[role="alert"]').text()).toMatch(/valid email/i)
  expect(wrapper.emitted('submit')).toBeUndefined()
})
```

## Accessible Field Queries

Prefer `@testing-library/vue` `getByLabelText` / `getByRole` so the test fails when a field
loses its label — which is also an accessibility regression:

```javascript
import { render, screen, fireEvent } from '@testing-library/vue'

test('binds the email field to its label', async () => {
  render(ContactForm)
  await fireEvent.update(screen.getByLabelText(/email/i), 'ada@example.com')
  expect(screen.getByLabelText(/email/i)).toHaveValue('ada@example.com')
})
```

## Async Submit States

Assert the full lifecycle, not just the end: disabled/loading while in-flight, then success
or error. Mock the network at the boundary (MSW or a stubbed action) — see
`testing-async-await-flushpromises.md` and `testing-pinia-store-setup.md`.

## Reference
- [Vue Test Utils — Forms](https://test-utils.vuejs.org/guide/essentials/forms.html)
- [Testing Library — Queries](https://testing-library.com/docs/queries/about/)
