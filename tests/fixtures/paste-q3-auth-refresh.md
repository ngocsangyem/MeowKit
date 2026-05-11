story: Update sign-in form copy
description: Replace dated CTA copy on the public sign-in form. Marketing-approved strings.
ac:
  - Hero heading reads "Welcome back"
  - Submit button reads "Sign in"
  - Helper text under email field reads "Use the address you registered with"
---
story: Add Google OAuth login
description: New social-login path. Users click "Continue with Google" and complete the OAuth consent flow, then land on /dashboard.
ac:
  - Google button initiates OAuth authorization
  - Successful callback creates a server-side session cookie
  - Failed OAuth shows an inline error without redirect
  - Token refresh path uses the standard library client
---
story: Sliding session expiry
description: Sessions extend on activity. Idle sessions log out at 24h. The session middleware needs to update last-active timestamps on every authenticated request.
ac:
  - Every authenticated request refreshes the expiry timestamp
  - Sessions idle for 24h log out and redirect to /login
  - Logout button clears the session cookie immediately
  - Background jobs do not touch user session expiry
  - Admin dashboard displays per-user last-active time
---
story: Self-serve account recovery and admin reset
description: Password reset flow plus admin reset shortcut plus audit log plus notification webhooks plus refactor of legacy reset module. Migrate to the new identity provider. Replace SMS-OTP with email verification. Breaking change to the API.
ac:
  - Self-serve email reset sends a one-time link valid for 30 minutes
  - Admin can trigger reset from the admin dashboard
  - Reset events post to the notification webhook
  - All resets are recorded in the audit log
  - Legacy SMS-OTP endpoints return 410
  - Identity provider migration leaves no orphaned tokens
  - Refactor moves the reset logic out of the auth module
  - Stripe billing dashboard notes the reset for fraud detection
