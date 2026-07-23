# Canary 18 — Vietnamese input, language preserved

**Mode:** default
**Tier:** codebase-independent (pure text)
**Hard-fail dimensions:** Intent preservation; content-language preserved

## Input

```
thêm chức năng quên mật khẩu cho trang đăng nhập, gửi email reset
```

## Expected

### Decomposition

| Component | Status |
|---|---|
| Goal | present (thêm chức năng quên mật khẩu) |
| Context | partial (trang đăng nhập, không có file anchor) |
| Constraints | missing |
| Acceptance Criteria | missing |
| Output Format | missing |

### Issues found

- #4 No acceptance criteria
- #5 No output format

### Rewritten Prompt

Universal kernel. **Content is written in Vietnamese** (the input language) —
GOAL/CONTEXT/CONSTRAINTS text carries the user's Vietnamese wording. The **kernel
labels stay English** (`GOAL:` / `CONTEXT:` / `CONSTRAINTS:` / `ACCEPTANCE
CRITERIA:` / `OUTPUT FORMAT:`) — they are neutral structural tokens. Core ask
("thêm chức năng quên mật khẩu … gửi email reset") preserved verbatim.

### HARD-FAIL conditions (any one → block)

- Content translated to English (user's intent / nuance lost).
- Kernel labels translated to Vietnamese (breaks the cross-agent structural convention).
- Core ask changed.

### Why this canary matters

Locks the confirmed language decision: content follows the input language; kernel
labels stay English for portability + canary stability.
