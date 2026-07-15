# Gate 2 Approval Receipt

- **Status:** proposed (design only — enforcement explicitly deferred)
- **Date:** 2026-07-15

## Context

Gate 2 requires that a human explicitly approved a change before it ships. The structural
check in `.claude/hooks/lib/gate2-check.sh` enforces what it can at `git commit` / `push`
/ `merge`: a verdict for the active plan exists, names no FAIL dimension and no security
BLOCK, and any present workflow-evidence index does not contradict it.

That check cannot prove the thing Gate 2 is actually about.

Every artifact it reads — the verdict file, the evidence index, the active-plan pointer —
is an ordinary file in the working tree, writable by the same session that produced the
change under review. A session that wanted to ship unreviewed code does not need to defeat
the check; it needs to write a passing verdict file, which costs one tool call. The check
raises the cost of an *accidental* ungated ship to near-certain detection, and the cost of
a *deliberate* one to approximately nothing.

So today's honest claim is: **the paperwork is present and self-consistent.** Not: *a
human approved this.* The rule text, the hook output, and this ADR all say so in those
words, because the gap is not closable by any amount of additional file parsing. Reading
more files written by the same untrusted author yields no new trust.

Two properties are missing, and neither is structural:

1. **Authenticity** — the approval came from a human, through the host's UI, not from the
   agent's file writer.
2. **Binding** — the approval refers to *this* verdict and *this* revision, not an earlier
   state that has since changed underneath it.

A receipt is the smallest artifact that could carry both.

## Decision

Specify a **Gate 2 approval receipt**: a record emitted by the *host runtime* (not the
agent) when a human answers a Gate 2 approval prompt. Design only. Nothing in this ADR is
enforced, and no adapter capability flag for receipts lands before the phase that
implements it.

### Shape

| Field | Purpose |
|---|---|
| `verdictDigest` | SHA-256 of the verdict file's bytes at approval time. Binds the receipt to exactly what was shown. |
| `revision` | The commit SHA / tree digest the verdict reviewed. Binds it to the code. |
| `planPath` | The plan the approval belongs to. Prevents replay against a different task. |
| `sessionId` | Host session that presented the prompt. |
| `choice` | The option the human selected, verbatim — including rejections. |
| `timestamp` | When it was answered. |
| `issuer` | Which host emitted it, so a verifier knows whose signature to expect. |
| `signature` | Host-held key over the fields above. **This is the whole point.** |

Without `signature`, a receipt is just another agent-writable file and buys nothing over
today's verdict. An unsigned receipt format would be *worse* than none: it would look like
proof while being forgeable, which is how a safety mechanism becomes a liability.

### Verification (when enforced, later)

1. Recompute `verdictDigest` from the verdict on disk; mismatch ⇒ the verdict changed
   after approval ⇒ block.
2. Check `revision` against what is being shipped; mismatch ⇒ approval predates the code
   ⇒ block.
3. Verify `signature` against the issuer's public key; unverifiable ⇒ treat as absent.
4. Absent receipt ⇒ **today's structural behavior**, unchanged. Not a new block.

Step 4 is deliberate. Hosts that cannot emit receipts must not become unusable.

### Host capability

Receipts require a host that (a) owns the approval UI and (b) can sign. That is a property
of the runtime, not of this toolkit — the toolkit is the outer harness and cannot
manufacture a trusted signer inside a process the agent already controls.

| Host capability | Behavior |
|---|---|
| Emits signed receipts | Verify per above; a valid receipt is real approval proof |
| No receipt support | Structural check only; hook keeps stating approval is unproven |

No host is assumed to support this today. Enumerating which do is the implementing phase's
job, via the existing provider-adapter conformance surface — not a hardcoded list here.

## Consequences

- The structural check stays as-is and keeps disclaiming what it cannot prove. This ADR
  does not make it stronger; it names precisely what would.
- No adapter capability flag, no `canEmitApprovalReceipt`, no schema change lands until
  the implementing phase. Adding a flag now would advertise a capability nothing verifies.
- The forgeability of self-attested verdicts is **accepted and documented**, not silently
  tolerated. Anyone reading the rule, the hook output, or this ADR learns it.
- If no host ever emits receipts, this ADR stays proposed forever and the honest
  disclaimer stands permanently. That is an acceptable outcome — the alternative is
  claiming a proof we do not have.

## Unresolved questions

- Key distribution: how does a verifier learn an issuer's public key without a trusted
  channel the agent could also poison?
- Is a receipt worth issuing for a *rejection*, as an audit trail of what was refused?
- Should `revision` bind the tree digest rather than the commit SHA, given that at
  PreToolUse time the commit being approved does not exist yet?
