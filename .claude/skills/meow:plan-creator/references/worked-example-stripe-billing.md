# Worked Example: Add Stripe Subscription Billing

A complete plan showing the expected detail level for a MeowKit 7-phase implementation.

---

## Overview

**Goal:** Users can subscribe to a paid plan, manage their subscription, and access gated features based on their active plan tier.

**Type:** Feature  
**Complexity:** COMPLEX (payments, auth, multi-file, external API)  
**Model tier:** COMPLEX (Opus) — payments domain, Rule 2 escalation mandatory

---

## Requirements

**Functional:**
- Users can select a plan (Free / Pro / Team) from a pricing page
- Users can subscribe with a credit card (Stripe Checkout)
- Subscription status is reflected immediately after payment
- Users can cancel, upgrade, or downgrade their subscription
- Webhook handler updates subscription state on Stripe events

**Non-functional:**
- Payment flow must not store raw card data (PCI scope reduction)
- Stripe webhook endpoint must verify signature before processing
- Subscription state must survive app restarts (persisted to DB)
- Failed webhooks must be retryable (idempotency keys)

**Out of scope:**
- Annual billing toggle (deferred to v2)
- Invoice PDF download (deferred)
- Promo codes (deferred)

---

## Architecture Changes

**New files:**
- `src/billing/stripe-client.ts` — initialized Stripe SDK singleton
- `src/billing/subscription-service.ts` — create/cancel/sync subscription logic
- `src/billing/webhook-handler.ts` — Stripe event processing
- `src/billing/plan-gate.ts` — middleware to check feature access by plan
- `src/api/billing/route.ts` — REST endpoints (create session, portal, status)
- `src/api/webhooks/stripe/route.ts` — webhook receiver

**Modified files:**
- `src/db/schema.ts` — add `subscriptions` table
- `src/middleware.ts` — add plan gate to protected routes
- `docs/project-context.md` — add billing domain to tech stack

**Environment variables added:**
- `STRIPE_SECRET_KEY` — server-side only
- `STRIPE_WEBHOOK_SECRET` — webhook signature verification
- `STRIPE_PRO_PRICE_ID`, `STRIPE_TEAM_PRICE_ID` — product price IDs

---

## Phase 0: Orient

**Agent:** orchestrator  
**Time budget:** 15 minutes

- Read `memory/lessons.md` for prior billing decisions
- Run `meow:scout` on `src/billing/` — confirm directory doesn't exist yet
- Run `meow:scale-routing` — confirm domain=fintech, level=high, model=COMPLEX
- Declare: `Task complexity: COMPLEX → Opus`
- Confirm no existing Stripe integration to avoid duplication

**Gate 1 inputs produced:** scope confirmed, blast radius mapped (6 new files, 3 modified)

---

## Phase 1: Plan (Gate 1)

**Agent:** planner + architect  
**Time budget:** 2 hours

- Researcher A: Stripe Checkout + Customer Portal integration patterns (2026)
- Researcher B: Next.js webhook handling, idempotency, event deduplication
- Architect: ADR for subscription state machine (pending → active → canceled → past_due)
- Output: `tasks/plans/YYMMDD-stripe-billing/plan.md` + phase-02 through phase-06 files
- **GATE 1 STOP** — human approves plan before any code

---

## Phase 2: Test RED

**Agent:** tester  
**Time budget:** 3 hours

Write failing tests for:
- `subscription-service.ts`: create session returns Stripe checkout URL
- `subscription-service.ts`: cancel marks subscription as canceled in DB
- `webhook-handler.ts`: `customer.subscription.updated` updates DB row
- `webhook-handler.ts`: invalid signature returns 400, no DB write
- `plan-gate.ts`: Free-tier user blocked from Pro feature route
- `plan-gate.ts`: Pro-tier user allowed through gate

All tests must fail (RED) before Phase 3 begins.

---

## Phase 3: Build GREEN

**Agent:** developer  
**Time budget:** 6 hours

**Step 3.1:** DB schema — add `subscriptions` table with: `id`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `plan`, `status`, `current_period_end`, `created_at`

**Step 3.2:** Stripe client — initialize SDK with `STRIPE_SECRET_KEY`, export singleton, never expose to client bundle

**Step 3.3:** Subscription service — `createCheckoutSession()`, `createPortalSession()`, `cancelSubscription()`, `syncFromWebhook(event)`

**Step 3.4:** Webhook handler — verify signature via `stripe.webhooks.constructEvent()`, process `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, use idempotency key = `stripe_event_id`

**Step 3.5:** Plan gate middleware — read `subscriptions` table, map plan to feature set, return 403 with `{ error: "upgrade_required", plan_required: "pro" }` on gate failure

**Step 3.6:** API routes — POST `/api/billing/session` (create checkout), POST `/api/billing/portal` (manage subscription), GET `/api/billing/status` (current plan)

All 6 tests must pass (GREEN) before Phase 4.

---

## Phase 4: Review (Gate 2)

**Agent:** reviewer + security  
**Time budget:** 2 hours

Security adversary checks (mandatory for payments):
- No raw card data touches our servers
- Webhook signature verified before any DB write
- `STRIPE_SECRET_KEY` never in client bundle (check Next.js build output)
- No SQL injection in subscription queries (parameterized only)
- Plan gate cannot be bypassed by client-supplied plan claim

Review dimensions: Correctness, Maintainability, Performance, Security, Coverage

**GATE 2 STOP** — human approves verdict before Phase 5

---

## Phase 5: Ship

**Agent:** shipper  
**Time budget:** 1 hour

- Run full test suite: `npm test` — all green
- Run type check: `npx tsc --noEmit` — 0 errors
- Commit: `feat: add Stripe subscription billing with webhook handler`
- PR: title "Add Stripe subscription billing", link to plan, include test evidence
- Verify webhook endpoint is registered in Stripe dashboard (staging first)

---

## Phase 6: Reflect

**Agent:** documenter + analyst  
**Time budget:** 30 minutes

- Update `docs/project-context.md`: add billing domain, Stripe SDK version, webhook event list
- Update `docs/system-architecture.md`: add subscription state machine diagram
- `meow:memory` session-capture: log any Stripe API surprises, webhook ordering issues
- Append `memory/lessons.md`: "Stripe webhook events arrive out of order — always check `current_period_end` before updating status"
- Docs impact: major

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Webhook delivery failure | Medium | High | Idempotency keys + Stripe retry dashboard |
| Race condition: webhook before session complete | Low | High | Check event type, not timing |
| Test card charges in production | Low | High | Enforce `STRIPE_SECRET_KEY` starts with `sk_test_` in non-prod |
| Subscription state desync | Medium | Medium | Daily reconciliation job (Phase 2 scope) |

---

## Success Criteria

- [ ] `npm test` passes with 0 failures
- [ ] `npx tsc --noEmit` exits 0
- [ ] Stripe test webhook `customer.subscription.updated` processed correctly in staging
- [ ] Free-tier user cannot access `/dashboard/pro-feature` (returns 403)
- [ ] Pro-tier user can access `/dashboard/pro-feature` (returns 200)
- [ ] Gate 2 verdict: no FAIL dimensions, security dimension PASS
