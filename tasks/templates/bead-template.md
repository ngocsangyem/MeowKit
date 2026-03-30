# Bead Template

Use this template when decomposing COMPLEX tasks (5+ files) into atomic work units.
Add beads section to the plan file after the Technical Approach section.

## Beads

| Bead | Scope | Dependencies | Est. Size | Status |
|------|-------|-------------|-----------|--------|
| `bead-01-[description]` | `src/path/**` | none | ~150 lines | pending |
| `bead-02-[description]` | `src/other/**` | bead-01 | ~100 lines | pending |
| `bead-03-[description]` | `tests/**` | bead-01, bead-02 | ~50 lines | pending |

### bead-01-[description]

**Scope:** Files this bead creates or modifies (glob patterns)
**Acceptance Criteria:**
- [ ] [Binary pass/fail check 1]
- [ ] [Binary pass/fail check 2]
**Dependencies:** none
**Estimated Size:** ~150 lines

### bead-02-[description]

**Scope:** Files this bead creates or modifies
**Acceptance Criteria:**
- [ ] [Binary pass/fail check 1]
- [ ] [Binary pass/fail check 2]
**Dependencies:** bead-01
**Estimated Size:** ~100 lines

---

## Bead Rules

- Each bead is completable in one context window (~70K tokens)
- Target ~150 lines for implementation beads, ~50 lines for test-only beads
- Every bead gets its own atomic git commit
- Dependencies must form a DAG (no circular dependencies)
- Progress tracked in `session-state/build-progress.json`
