---
title: MeowKit Agentic Harness Architecture Audit
date: 2026-07-10
status: approved-brainstorm-report
language: vi
mode:
  - brainstorm
  - html
scope:
  - /Users/sangnguyen/Desktop/claude-tool/meowkit
  - /Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental
evidence_policy: source-first with targeted runtime probes
---

# MeowKit Agentic Harness Architecture Audit

## Phạm vi và cách đọc

Report đánh giá HEAD hiện tại của hai repository:

- MeowKit: commit `4f2cab0`, ngày 2026-07-07.
- `harness-experimental`: commit `14e6f10`, ngày 2026-07-08.

Các report cũ chỉ được dùng để tạo hypothesis. Kết luận dưới đây được xác minh lại trên source, test definitions và runtime probe hiện tại.

### Nhãn bằng chứng

| Nhãn | Nghĩa |
|---|---|
| `VERIFIED_SOURCE` | Đã đọc implementation hoặc cấu hình runtime trực tiếp. |
| `VERIFIED_TEST` | Có test cụ thể khóa behavior; test source đã được kiểm tra. |
| `VERIFIED_RUNTIME` | Đã chạy command/probe trên source build hiện tại. |
| `INFERRED` | Suy luận từ nhiều nguồn đã xác minh; chưa có execution proof đầy đủ. |
| `ASSUMPTION` | Chưa đủ bằng chứng; không dùng làm nền cho quyết định bắt buộc. |
| `GAP` | Producer, consumer, enforcement hoặc contract bị thiếu/không khớp. |
| `RECOMMENDATION` | Hướng cải tiến; không phải mô tả behavior hiện tại. |

### Runtime probes đã chạy

CLI được compile từ source hiện tại vào `/tmp`; dependency chỉ được symlink read-only. Working tree của cả hai repository giữ sạch.

| Probe | Kết quả |
|---|---|
| TypeScript CLI compile | `PASS` |
| `mewkit validate --workflow` | `6 passed` |
| `mewkit validate --ownership` | `1 passed` |
| `mewkit validate --plugin` | `7 passed` |
| `mewkit validate --substrate` | `2 failed`, `1 warning`: view stale, 160 artifact chưa tag |
| `mewkit inventory --check` | `FAIL`: 5 count-drift issues |
| Hard-gate behavioral probe | Gate 1/privacy/injection/runtime shell pass; contract gate chưa được probe |
| Claude→Codex hook transform | 22 registrations → 15; rơi 7 registrations |
| `harness-cli` Rust tests | Không chạy được: môi trường không có `cargo`; giữ ở mức source + CI/test-definition evidence |

## 0. Problem-First Framing

### 0.1 Solution-jumping diagnosis

MeowKit đã tích lũy nhiều capability: 124 skills, 39 agents, 25 commands, rules, hooks, memory, wiki, migration, plugin và visualizer. Tín hiệu thật phía dưới không phải “cần thêm capability”, mà là khó chứng minh các capability đang nối thành một vòng thực thi đáng tin cậy.

### 0.2 Underlying problem

Agent và maintainer chưa có một authority machine-readable trả lời đồng thời:

1. Capability nào tồn tại?
2. Runtime nào thực sự hỗ trợ nó?
3. Ai kích hoạt nó?
4. Nó đọc/ghi artifact nào?
5. Enforcement là hard, advisory hay prose-only?
6. Evidence nào chứng minh workflow đã hoàn tất?

### 0.3 Assumption challenges

| Giả định | Rủi ro nếu sai | Cách kiểm tra |
|---|---|---|
| Skill có trigger nghĩa là tự chạy | Model không gọi skill, Phase 0 không xảy ra | Trace activation; kiểm tra host-supported trigger contract |
| Plan tồn tại nghĩa là đã được duyệt | Plan cũ/rỗng mở khóa source write | Probe Gate 1 bằng plan stale/unapproved/wrong slug |
| Provider có surface `hooks` nghĩa là giữ enforcement | Migration làm rơi matcher hoặc đổi semantics | Golden transform từ chính `settings.json` shipping |
| Checkpoint giúp resume đầy đủ | Checkpoint thiếu phase, blockers, decisions | Resume drill sau compact/kill |
| Test file tồn tại nghĩa là behavior được bảo vệ | Fixture synthetic che giấu production mismatch | Chạy test với canonical shipping fixture |
| Nhiều context hơn làm agent ít hallucinate | Context noise làm retrieval tệ hơn | Đo always-on/conditional/on-demand riêng |

### 0.4 Problem statement

Người dùng MeowKit cần một harness giúp agent hiểu đúng context, làm theo workflow, để lại state có thể resume và tạo evidence đáng tin cậy trên nhiều runtime. Hiện tại nhiều primitive tốt đã tồn tại, nhưng producer–consumer gaps, behavioral routing và provider downgrade làm reliability phụ thuộc quá nhiều vào việc model “nhớ làm đúng”.

### 0.5 Ba cách nhìn thay thế

| Frame | Cách hiểu | Không gian giải pháp |
|---|---|---|
| A — Content toolkit | MeowKit là thư viện prompt/skill lớn | Tối ưu catalog, search và docs |
| B — Claude control plane | MeowKit là installation + policy layer cho Claude Code | Làm hook/state/gate thật chặt, portability chỉ best-effort |
| C — Portable artifact manager | MeowKit quản lý contract và artifact theo provider | Core contract + provider adapter + downgrade report |

Kết luận: MeowKit hiện là tổ hợp của B và C. Không nên tự mô tả là universal agent runtime.

### 0.6 Evidence status

`Strong` cho cấu trúc CLI, Claude hooks, migration contracts, memory/wiki primitives và test inventory. `Medium` cho end-to-end agent behavior vì chưa có trace corpus chứng minh model thực sự gọi đầy đủ skills/agents trong production. `Weak` cho parity giữa native Codex plugin và Claude flat-copy.

### 0.7 Validation plan

- Dùng canonical shipping artifacts làm fixtures.
- Probe producer → state → consumer, không chỉ validate schema.
- Chạy resume drills theo session/plan slug.
- So sánh provider downgrade ở registration và enforcement level.
- Kill recommendation nếu chỉ thêm metadata nhưng không có consumer.

### 0.8 Draft stakeholder message

> MeowKit đã có nhiều primitive đáng giữ. Trước khi thêm feature, cần khóa các đường thực thi hiện có bằng producer rõ ràng, evidence có scope và provider downgrade trung thực. Mục tiêu không phải giảm tham vọng; mục tiêu là biến capability đã có thành behavior có thể chứng minh.

## 1. Executive Summary

### Kết luận ngắn

MeowKit **không phải một đống Markdown rời rạc**. Nó có control plane thật: CLI cài đặt/nâng cấp/migrate/validate, hook lifecycle thật trên Claude Code, memory/wiki có code và tests, provider contracts, plugin generation, task artifacts và nhiều guardrail chạy được.

Nhưng MeowKit cũng **chưa phải coherent agentic harness khép kín**. Khoảng cách lớn nhất nằm giữa specification và execution:

- Skill/agent routing chủ yếu behavioral.
- Một số state quan trọng có reader nhưng thiếu producer.
- Gate 1 yếu hơn wording “approved plan”.
- Gate 2 và precompletion chưa đủ ràng buộc evidence.
- Provider portability có thể giữ file nhưng làm mất enforcement.
- Tool discovery chưa có capability registry chung.

Đánh giá tổng thể:

| Trục | Mức hiện tại | Kết luận |
|---|---|---|
| Claude Code installation/control plane | Mạnh | Dùng được, có runtime wiring và tests đáng kể |
| Workflow specification | Mạnh | Canonical YAML và drift checks tốt |
| Workflow enforcement | Trung bình | Gate 1 thật nhưng approval tùy chọn; Gate 2 behavioral |
| Long-running continuity | Trung bình | Plan checkbox tốt; checkpoint/state bridge còn nông |
| Capability discoverability | Trung bình | Catalog lớn; activation và external-tool discovery yếu |
| Anti-hallucination | Trung bình | Có context/privacy/wiki guardrails; nhiều điểm vẫn prose-only |
| Model-agnostic portability | Trung bình-thấp | Adapter architecture tốt; semantic parity chưa được chứng minh |

### Gap lớn nhất

Không có một **runtime evidence loop có scope** nối:

`intent → active plan → phase → action → verification → verdict/result → checkpoint/resume`.

Plan artifacts tồn tại, hooks tồn tại, checkpoints tồn tại, verification script tồn tại; nhưng state producer và scope binding chưa đủ để biến chúng thành một chuỗi chắc chắn.

### Ưu tiên cao nhất

1. Tạo một state writer API duy nhất cho `active-plan` và `verification-required`.
2. Scope verification theo session + plan slug + command evidence.
3. Làm provider downgrade explicit, đặc biệt Claude→Codex hooks.
4. Mở rộng inventory thành capability/wiring authority, không chỉ file inventory.

### Trả lời trực tiếp 15 câu hỏi

1. **Coherent harness hay tập hợp rời rạc?** Partially coherent harness. Claude control plane khá coherent; agent execution loop chưa khép kín.
2. **Wiring thật với CLI/workflow?** Install/update/migration/plugin/validation/inventory/memory/wiki có wiring thật; hooks có wiring thật trên Claude; skills/agents chủ yếu behavioral.
3. **Tồn tại nhưng khó discover?** External tools, wiki CLI help, session-continuation automation, provider-specific downgrade và nhiều on-demand skills.
4. **Buộc lấy context trước hành động?** Claude SessionStart loader và prose Phase 0 có; host-independent hard requirement chưa có.
5. **Không quên tiến độ?** Plan/phase checkbox có giá trị; active-plan/checkpoint bridge chưa đủ chắc.
6. **Không tự sáng tạo khi thiếu context?** Có privacy/injection/context/wiki guardrails, nhưng không có universal evidence-required policy.
7. **Skills actionable?** Nhiều skill rất actionable; một số automation claim không có runtime consumer.
8. **Hooks chạy thật?** Có trên Claude Code; targeted hard-gate probe pass. Provider parity không đồng đều.
9. **Commands chuẩn hóa workflow?** Có, nhưng slash-command và CLI command trùng tên khác semantics gây drift.
10. **Tools discoverable/typed/safe/reusable?** Skill-local tool guidance khá tốt; không có central capability registry cho equipped tools.
11. **CLI có trung tâm không?** Có cho control plane, không phải agent orchestrator.
12. **Model-specific ở đâu?** `.claude`, `$CLAUDE_PROJECT_DIR`, Claude hook matcher/tool names, command/agent formats và plugin assumptions.
13. **Nên model-agnostic phần nào?** State schema, evidence envelope, inventory, capability contract, reconciliation, trace classification.
14. **Harness-experimental tốt hơn gì?** Tool capability registry, run contract/result envelope, durable Symphony execution model.
15. **Cải tiến đầu tiên?** Đóng state/evidence loop và làm downgrade semantics machine-readable trước khi thêm capability.

## 2. Repository & Package Map

### 2.1 MeowKit

| Khu vực | Path | Vai trò thực tế | Evidence |
|---|---|---|---|
| Canonical Claude surface | [`.claude/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude) | Source-of-truth cho flat-copy và nguồn sinh plugin | `VERIFIED_SOURCE` |
| CLI package | [`packages/mewkit/src/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src) | Control plane TypeScript | `VERIFIED_SOURCE` |
| CLI entrypoint | [`index.ts`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src/index.ts:126) | `minimist` + switch dispatch commands | `VERIFIED_SOURCE` |
| CLI commands | [`commands/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src/commands) | init, upgrade, validate, doctor, task, memory, trace, inventory, migrate, wiki, plugin | `VERIFIED_SOURCE` |
| Migration adapters | [`migrate/providers/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src/migrate/providers) | Provider capability contract + converter/config | `VERIFIED_SOURCE` |
| Wiki runtime | [`wiki/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src/wiki) | Candidate, scan, approval, canonical commit, index | `VERIFIED_SOURCE`, `VERIFIED_TEST` |
| Orchviz | [`orchviz/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src/orchviz) | Session/event visualization và plan interaction | `VERIFIED_SOURCE` |
| Skills | [`.claude/skills/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/skills) | 124 procedural/domain skills | `VERIFIED_RUNTIME` qua inventory |
| Agents | [`.claude/agents/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/agents) | 39 specialist definitions + indexes | `VERIFIED_SOURCE` |
| Commands | [`.claude/commands/mk/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/commands/mk) | 25 slash-command front doors | `VERIFIED_SOURCE` |
| Hooks | [`.claude/hooks/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/hooks) | Shell/Node lifecycle enforcement và capture | `VERIFIED_RUNTIME` |
| Hook wiring | [`settings.json`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/settings.json:17) | 22 registrations trên 7+ lifecycle events | `VERIFIED_SOURCE` |
| Workflow spec | [`workflow.yaml`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/workflow.yaml:16) | Canonical 7-phase contract | `VERIFIED_RUNTIME` drift check |
| Durable tasks | [`tasks/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/tasks) | plans, phases, contracts, reviews, active/backlog | `VERIFIED_SOURCE` |
| Runtime state | [`session-state/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/session-state) | checkpoint, counters, sentinels, state cache | `VERIFIED_SOURCE` |
| Local memory | [`.claude/memory/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/memory) | Machine-local JSON/JSONL knowledge and trace | `VERIFIED_SOURCE` |
| Generated plugin | [`plugin/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/plugin) | Claude/Codex plugin payload | `VERIFIED_SOURCE` |
| Tests/fixtures | [`src/__tests__/`](/Users/sangnguyen/Desktop/claude-tool/meowkit/src/__tests__), [`packages/mewkit/src/**/__tests__`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src) | Hook, memory, migration, plugin, wiki, inventory, orchviz tests | `VERIFIED_TEST` |

### 2.2 CLI command roles

| Command | Runtime responsibility | Ghi chú |
|---|---|---|
| `init` / `upgrade` | Download release, smart update, merge settings, preserve edits | Control-plane thật |
| `setup` / `doctor` | Dependency/config preparation và diagnostics | `doctor` có mutation nhỏ như chmod/probe; không hoàn toàn read-only |
| `validate` | Structure/wiring validation | Tự ghi rõ không validate behavior |
| `inventory` | Artifact governance/count/substrate | Chưa bao phủ toàn bộ surface |
| `migrate` / `providers` | Provider conversion và capability summary | Architecture tốt; semantics cần proof |
| `memory` / `wiki` / `trace` | Persistence, curated knowledge, advisory diagnostics | Các subsystem có code thật |
| `task` | Tạo/list task artifacts | Chưa là state orchestrator |
| `orchviz` | Quan sát session/plan | Optional UX, không phải workflow authority |
| `build-plugin` | Regenerate plugin payload + manifests | Có transform/idempotency tests |

### 2.3 `harness-experimental`

| Khu vực | Path | Vai trò thực tế |
|---|---|---|
| Rust workspace | [`Cargo.toml`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/Cargo.toml:1) | Hai crates: `harness-cli`, `harness-symphony` |
| Harness CLI | [`crates/harness-cli/`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/crates/harness-cli) | Intake/story/decision/trace/tool registry/verification/query |
| Symphony runner | [`crates/harness-symphony/`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/crates/harness-symphony) | Queue, worktree, agent launch, run/result/changeset |
| SQLite schema | [`scripts/schema/001-init.sql`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/scripts/schema/001-init.sql:23) | Canonical store cho harness-cli |
| Agent boot shim | [`AGENTS.md`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/AGENTS.md:9) | Stable read order và CLI query requirements |
| Tool registry | [`domain.rs`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/crates/harness-cli/src/domain.rs:115) | Capability-first optional tool model |
| Run/result | [`run.rs`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/crates/harness-symphony/src/run.rs:69) | `SUMMARY.md`, `RESULT.json`, validation/promotion |
| Web UI | [`web-ui/`](/Users/sangnguyen/Desktop/claude-tool/docs/harness-experimental/crates/harness-symphony/web-ui) | Symphony board/status viewer |

## 3. Harness Coherence Analysis

### 3.1 Wiring matrix

| Quan hệ | Mức | Evidence | Đánh giá |
|---|---|---|---|
| CLI ↔ `.claude` assets | **Strongly connected** | `init`, smart-update, plugin generation, migration | CLI quản lý lifecycle artifact tốt |
| CLI ↔ skills | **Weakly connected** | CLI cài/validate/inventory; không kích hoạt skill | File management ≠ runtime use |
| CLI ↔ commands | **Weakly connected** | Cùng tên nhưng semantics khác ở `upgrade`, `validate` | Discoverability drift |
| Commands ↔ workflows | **Weak/medium** | Command front doors trỏ skills; host/model thực hiện prose | Có convention, thiếu state transition API |
| Skills ↔ tools | **Weakly connected** | Tool guidance nằm rải trong skill; không có registry chung | Agent phải tự probe hoặc nhớ tên tool |
| Agents ↔ workflows | **Behavioral** | Index và routing rules tồn tại | Không có runtime dispatcher đảm bảo handoff |
| Hooks ↔ Claude lifecycle | **Strongly connected** | `settings.json`, dispatcher, behavioral probe pass | Đây là phần harness mạnh nhất |
| Hooks ↔ non-Claude runtime | **Weak/adapter-dependent** | Codex transform rơi matcher | File presence không đồng nghĩa parity |
| Workflow ↔ gates | **Mixed** | Gate 1 hook; Gate 2 behavioral | Spec mạnh hơn enforcement |
| Plans ↔ long-running state | **Medium** | Checkboxes canonical; active-plan producer thiếu | Resume phụ thuộc agent tự tìm đúng plan |
| Verification ↔ completion | **Weak** | Marker producer thiếu; evidence check còn rộng | Chưa đủ chống false completion |
| Memory/wiki ↔ workflow | **Medium** | Immediate capture/wiki approval thật; load/use còn on-demand | Persistence tốt hơn consumption |

### 3.2 Strongly connected

- `settings.json` → hook scripts → handlers → session state.
- CLI `build-plugin` → transformed payload → marketplace manifests.
- CLI `migrate` → provider contract → converter → report/registry.
- Wiki candidate → scanner → approval → canonical page/index/trace.
- Workflow YAML → drift validator → CI.

### 3.3 Weakly connected

- Agent detector và session continuation dùng legacy trigger/prose, không có host consumer rõ.
- Plans là authority nhưng checkpoint chỉ biết plan khi `active-plan.json` tồn tại.
- Precompletion chỉ chạy khi `verification-required.json` tồn tại; chưa thấy production writer chắc chắn.
- Inventory có governance metadata nhưng không bao phủ modes, scripts, schemas, workflow, handlers, templates và external tools.

### 3.4 Exists but unused / documentation-only

- Claim autosave mỗi 5 phút/token milestone trong session continuation.
- “Runs first every message” khi trigger metadata không có runtime consumer.
- Một số architecture/trigger docs stale so với catalog thực tế.

### 3.5 Missing

- Capability-first equipped-tool registry.
- Machine-readable wiring manifest nối producer/consumer/enforcement.
- Scoped completion result envelope.
- Provider parity tests dùng canonical shipping settings.
- Cold-start resume drill tự động.

## 4. Agent Context & Long-Running Work Analysis

### 4.1 Context discovery

`VERIFIED_SOURCE`: Claude `SessionStart` gọi [`project-context-loader.sh`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/hooks/project-context-loader.sh:44), inject project context, directory/package/tool summaries có budget.

Điểm mạnh:

- Có bounded loader thay vì dump toàn repo.
- Có context tier model trong [`context-budget.ts`](/Users/sangnguyen/Desktop/claude-tool/meowkit/packages/mewkit/src/core/context-budget.ts:7).
- Có privacy block trước Read và injection checks cho Bash trên Claude.

Gap:

- `/mk:context-audit` cộng cả on-demand catalog như static overhead, tạo số liệu phóng đại.
- Fixed executable summary không thay thế capability registry.
- Non-Claude runtime có thể mất context/privacy hooks.

### 4.2 Context persistence

| Store | Authority | Đánh giá |
|---|---|---|
| Plan/phase Markdown checkboxes | Canonical workflow progress | Tốt, human-readable, diffable |
| `.plan-state.json` | Derived cache | Đúng khi luôn thua Markdown trong conflict |
| Latest checkpoint | Resume accelerator | Nông; thiếu phase/blocker/open decisions |
| Memory JSON/JSONL | Local reusable knowledge | Có validation/atomicity, nhưng machine-local |
| Wiki | Shared curated knowledge | Strong anti-poisoning architecture |
| Trace | Advisory telemetry | Có analysis, nhưng quality tier chưa buộc verification |

### 4.3 Progress tracking

`VERIFIED_SOURCE`: plan/phase checkboxes được xem là canonical qua session. Đây là cơ chế “không quên” đáng tin nhất hiện tại.

`GAP`: project-manager/status/orchviz có thể đọc artifacts, nhưng không có single active-run authority được mọi producer cập nhật.

### 4.4 Task handoff

Handoff chủ yếu là Markdown/frontmatter + subagent prompt conventions. Không có versioned result envelope chung cho mọi phase. Handoff đủ cho người đọc cẩn thận, chưa đủ cho deterministic resume.

### 4.5 Verification checkpoints

`VERIFIED_RUNTIME`: Gate 1, `.env` privacy, remote-exec injection và shell runtime probes pass.

`GAP`:

- Gate 1 default chỉ kiểm tra plan file existence tại [`gate-enforcement.sh`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/hooks/gate-enforcement.sh:105); approval check chỉ bật bằng env tại line 132.
- Precompletion bỏ qua nếu thiếu `verification-required.json` tại [`pre-completion-check.sh`](/Users/sangnguyen/Desktop/claude-tool/meowkit/.claude/hooks/pre-completion-check.sh:48).
- Evidence có thể là file existence hoặc unscoped trace pass; verdict content/decision chưa được kiểm tra chặt.

### 4.6 Anti-hallucination guardrails

Điểm mạnh:

- Context-first rules và loader.
- Privacy/injection scanning.
- Wiki quarantine + approval re-scan.
- Provider documentation contracts.
- Test/source-first policies trong nhiều skills.

Giới hạn:

- Guardrail behavioral có thể bị compaction hoặc model bỏ qua.
- Stop safety sentinel ghi verified mà không chứng minh agent đã reread baseline.
- Agent-authored memory trust boundary yếu hơn immediate human capture.
- Provider conversion có thể downgrade hard guardrail thành candidate/advisory mà không chỉ ra registration loss.

### 4.7 Resume behavior

Kết luận: MeowKit giúp agent **ít quên hơn một prompt-only toolkit**, nhưng chưa đủ để hứa “không quên”. Cold resume đáng tin khi agent chủ động đọc plan và checkboxes; checkpoint tự động hiện chỉ là hint.

## 5. Component-by-Component Review

| Component | Path | Purpose | Actual Wiring | Discoverability | Practical Value | Gap | Recommendation |
|---|---|---|---|---|---|---|---|
| CLI | `packages/mewkit/src` | Artifact control plane | Mạnh | Cao qua help, trừ wiki | Cao | CWD/root semantics lệch; command coverage không đều | Chuẩn hóa root resolver; E2E entrypoint tests |
| Skills | `.claude/skills` | Procedures/domain knowledge | Behavioral | Catalog cao, activation trung bình | Cao nhưng không đồng đều | Trigger không có consumer; 160 untagged | Host-supported activation contract; tag-on-touch có deadline |
| Agents | `.claude/agents` | Specialist roles/handoffs | Behavioral | Index tốt | Trung bình-cao | Routing phụ thuộc model | Machine-readable role/phase contract |
| Slash commands | `.claude/commands/mk` | User front doors | Host-native Claude | Cao | Cao trên Claude | Trùng tên CLI khác semantics | Một command authority; wrappers gọi CLI/skill rõ ràng |
| Hooks | `.claude/hooks` | Lifecycle enforcement/capture | Mạnh trên Claude | Index tốt | Rất cao | Portability loss; producer gaps | Generated hook manifest + semantic parity tests |
| Workflow | `.claude/workflow.yaml` | Canonical lifecycle | Mixed enforcement | Cao | Cao | Gate 2 behavioral; state transitions prose | State writer + result envelope |
| Plans/contracts/reviews | `tasks/` | Durable workflow artifacts | Medium | Cao | Rất cao | Active plan binding thiếu | Scope bằng run/session/plan ID |
| Session state | `session-state/` | Ephemeral continuity | Mixed | Thấp | Trung bình | Readers không có writer; shallow checkpoint | Typed atomic state API |
| Memory | `.claude/memory` | Local lessons/trace | Mixed | Medium | Trung bình | Local-only; agent writes less guarded | Tách curated memory khỏi telemetry |
| Wiki | CLI + `packages/mewkit/src/wiki` | Shared durable knowledge | Mạnh | Medium | Cao | Approval actor/origin semantics | Tách content origin khỏi approval actor |
| Tools | Skill-local/MCP/CLI refs | External execution capabilities | Rời rạc | Thấp-trung bình | Tùy skill | Không central registry/probe/status | Mở rộng inventory thành capability registry |
| Inventory/substrate | `build-inventory.ts` | Governance map | Thật | CLI cao | Cao tiềm năng | Chỉ 5 artifact types; stale hiện tại | Bao phủ whole harness + generate docs |
| Migration | `migrate/` | Provider exports | Mạnh ở artifact conversion | CLI cao | Cao | Semantic enforcement loss | Report dropped registrations + enforcement downgrade |
| Native plugin | `plugin/` + builder | Claude/Codex distribution | Mạnh ở build | Medium | Cao | Codex manifest chỉ expose skills; payload hygiene | Regenerate-and-diff CI; surface parity statement |
| Tests/fixtures | multiple | Regression evidence | CI thật | Maintainer-facing | Cao | Synthetic fixture có thể che production mismatch | Canonical shipping fixtures và runtime matrix |

## 6. Comparison With `harness-experimental`

| Area | MeowKit | harness-experimental | Tốt hơn | Vì sao | Nên học |
|---|---|---|---|---|---|
| Context engineering | Active SessionStart loader + tier model | Post-hoc context scoring, path heuristics | MeowKit | Chủ động và bounded hơn | Thêm trace-based adherence score, không copy hard-coded paths |
| Workflow orchestration | Host chạy skills/rules/hooks | Symphony queue/worktree/run engine | Harness cho durable run; MeowKit cho host-native flexibility | Hai mục tiêu khác nhau | Thin run contract, không copy full runner ngay |
| Agent state | JSON/JSONL + Markdown + derived SQLite | Hai SQLite authorities + run state | MeowKit cho inspectability; Harness cho transactional runs | MeowKit ít lock/corruption hơn | Operation log chỉ cho parallel isolated runs |
| Tool discoverability | Skill-local + fixed executable scan | Capability registry với kind/status/probe | Harness | Agent query được tool equipped theo capability | Mở rộng MeowKit inventory, không tạo registry thứ hai |
| Hook lifecycle | Real Claude lifecycle hooks | Không có hook framework tương đương | MeowKit | Enforcement trước/sau tool thật | Giữ MeowKit hooks |
| Verification | Hard-gate probes + CI | CLI chạy verify commands; Symphony chấp nhận claimed results | MeowKit cho hooks; Harness CLI cho explicit verify | Cả hai có gap | Result envelope phải gắn captured execution evidence |
| Reporting | Plans/reviews/checkpoint/trace/wiki | `SUMMARY.md` + versioned `RESULT.json` + changeset | Harness ở run completion | Machine-readable completion rõ hơn | Thêm compact result sidecar |
| Model agnosticism | 16 provider contracts/adapters | CLI neutral; Symphony chủ yếu custom/Codex | MeowKit | Provider semantics explicit hơn | Giữ provider contract model |
| Safety | Privacy/injection/wiki quarantine | Codex adapter có `danger-full-access` | MeowKit | Ít bypass mặc định hơn | Không copy permission policy Symphony |
| Packaging | npm CLI + flat-copy + Claude/Codex plugin | Installer phát hành harness-cli; Symphony source-built | MeowKit rộng hơn | Distribution surfaces nhiều hơn | Học checksum/release discipline, không assume Symphony packaged |

### Nên học từ `harness-experimental`

1. Capability-first optional tool discovery.
2. Versioned run contract và `RESULT.json` nhỏ gọn.
3. Queue/run isolation chỉ cho workflows thật sự cần durable execution.
4. Semantic changeset/operation log khi nhiều isolated run cần merge.
5. Context adherence scoring dựa trên trace.

### Không nên copy

1. Hai SQLite databases làm canonical authority.
2. Codex `approvalPolicy: never` + `danger-full-access`.
3. Chấp nhận agent self-report `pass` như verification proof.
4. TCP reachability như “HTTP health”.
5. Hard-coded repo paths trong context score.
6. Full Symphony runner trước khi có dữ liệu chứng minh host-native orchestration không đủ.
7. Config field không được enforcement: timeout và `single_active_run` hiện có mismatch trong Symphony source.

## 7. Model-Agnostic Assessment

### Phần đang generic tốt

- Provider contract type system và support summary.
- Pure conversion/reconciliation patterns.
- Artifact ownership/checksum/update model.
- Workflow phase schema.
- JSON/JSONL state và derived index principle.
- Wiki domain/application/infrastructure separation.
- Evidence labeling và task artifacts dạng Markdown.

### Phần bị model/runtime-specific

- `.claude/` là canonical authored surface.
- `$CLAUDE_PROJECT_DIR` và Claude event/tool matcher names.
- Slash commands, agent frontmatter, tool allowlists.
- Behavioral assumptions về Skill/Task/AskUserQuestion.
- Plugin namespace rewrite và payload shape.
- Model tier/routing names.
- Codex conversion phụ thuộc version capability table.

### Nên tách thành adapter

| Core contract | Adapter responsibility |
|---|---|
| Phase/gate/evidence schema | Hook event và deny protocol |
| Capability + required enforcement | Provider path/surface/tool matcher |
| Agent role + allowed effects | Agent frontmatter/TOML format |
| Command intent | Slash-command/workflow/skill rendering |
| Context request | SessionStart injection mechanism |
| Verification result | Provider-specific capture method |

### Nên giữ ở core

- Artifact identity, ownership, checksum.
- Run/plan/session IDs.
- State machine và evidence envelope.
- Capability requirements và downgrade semantics.
- Secret classification/redaction policy.
- Validation result schema.

### Nên là optional mode

- Orchviz.
- Figma/Jira/Confluence/browser integrations.
- Durable queue/Symphony-like runner.
- Wiki/SQLite index cho project nhỏ.
- Parallel worktree orchestration.

### Vấn đề Codex cụ thể đã được proof

`VERIFIED_RUNTIME`: canonical Claude settings có 22 hook registrations. Transform dùng current Codex capability table tạo 15 registrations; 7 bị loại. Chỉ matcher `Bash` còn ở Pre/PostToolUse. Hai Edit/Write pre-hooks chứa Gate 1 và privacy bị rơi.

Điều này mâu thuẫn với summary quá thô kiểu “Codex hooks documented/candidate”. Provider report phải nói rõ **surface present nhưng enforcement coverage giảm**.

## 8. Practical Improvement Plan

### Phase 1: Make Harness Discoverable

**Mục tiêu:** một inventory authority bao phủ toàn harness và equipped external capabilities.

**Files cần sửa:**

- `packages/mewkit/src/core/build-inventory.ts`
- `packages/mewkit/src/commands/inventory.ts`
- `.claude/harness-inventory.json`
- `.claude/agents/SKILLS_INDEX.md`
- `.claude/agents/AGENTS_INDEX.md`
- README/count generators

**Thay đổi:**

- Thêm modes, scripts, handlers, schemas, workflow, templates, tool capabilities.
- Fields: `capability`, `producer`, `consumer`, `activation`, `enforcement`, `probe`, `status`, `checked_at`.
- Sinh count/docs từ inventory; chặn stale view trong CI.
- Đưa `wiki` vào CLI help.

**Acceptance criteria:**

- `mewkit inventory --check` pass.
- `validate --substrate` không stale.
- Mọi critical artifact có owner, activation và consumer.
- Agent query được tool theo capability/status.

### Phase 2: Connect CLI, Commands, Skills, Workflows

**Mục tiêu:** command intent và state transition không còn chỉ nằm trong prose.

**Files cần sửa:**

- `packages/mewkit/src/index.ts`
- `.claude/commands/mk/*.md`
- `.claude/skills/workflow-orchestrator/**`
- `.claude/skills/plan-creator/**`
- `packages/mewkit/src/commands/task.ts`

**Wiring:**

- Canonical command registry cho CLI/slash semantics.
- Slash command là thin wrapper tới một intent/skill/CLI command xác định.
- State writer CLI/API cho plan activation và phase transitions.

**Acceptance criteria:**

- Không còn command cùng tên khác behavior mà không cảnh báo.
- Mọi workflow phase có machine-readable transition producer.
- E2E fixture chứng minh command → skill/CLI → artifact.

### Phase 3: Add Long-Running Task State

**Mục tiêu:** resume được bằng state nhỏ, không inject raw log.

**Strategy:**

- Markdown plan/checkbox vẫn canonical.
- `session-state/active-run.json` chứa run ID, plan path/slug, phase, blockers, open decisions, last verification reference.
- `RESULT.json` versioned, nhỏ, link tới Markdown/verdict/trace evidence.
- Checkpoint chỉ cache summary + pointers.

**Không tạo context rác:**

- Không auto-inject full trace/report.
- Chỉ inject active pointers + top blockers + next action.
- Raw logs chỉ query on demand.

**Acceptance criteria:**

- Kill/resume drill khôi phục đúng plan, phase, blocker và next action.
- Stale plan không mở khóa unrelated run.
- State conflict luôn thua canonical Markdown.

### Phase 4: Add Anti-Hallucination Guardrails

**Mục tiêu:** claim quan trọng luôn có source/evidence type.

**Thay đổi:**

- Verification scope: `run_id`, `session_id`, `plan_slug`, `command`, `exit_code`, `artifact_hash`, timestamp.
- Verdict phải parse decision/content; không chỉ file existence.
- Trace quality không thể là `detailed` nếu không có verification.
- Context audit tách always-on/conditional/on-demand.
- Wiki tách `content_origin` khỏi `approved_by`.

**Acceptance criteria:**

- Unscoped pass record không đóng được plan.
- Verdict rỗng/rejected không thỏa Gate 2.
- Context budget report không gọi toàn catalog là statically loaded.

### Phase 5: Improve Hooks Lifecycle

**Mục tiêu:** hook behavior có producer, contract và parity report.

**Thay đổi:**

- Generated managed-hook manifest từ settings/handlers.
- Writer thật cho `active-plan` và `verification-required`.
- Gate 1 wording khớp default; hoặc bật approval enforcement sau migration.
- Scope precompletion evidence.
- Provider conversion report: preserved/dropped/degraded registrations.

**Acceptance criteria:**

- Canonical shipping settings qua Claude và Codex golden tests.
- Không hook critical nào bị drop im lặng.
- `doctor --hard-gates` probe cả contract/verification path.

### Phase 6: Make It Model-Agnostic

**Mục tiêu:** generic core, explicit provider adapters, không giả vờ parity.

**Core vs adapter:**

- Core giữ intents, state, evidence, capability requirements.
- Adapter map sang paths, formats, hook events, deny semantics và tool names.
- Mỗi provider công bố role: full-harness, procedure, policy-advisory, config-only, disabled.

**Acceptance criteria:**

- Provider report nêu enforcement coverage, không chỉ enabled surface.
- Unsupported capability degrade rõ hoặc block install; không silent copy.
- Native plugin và migrate path có parity statement riêng.

### Phase 7: Tests, Fixtures, and Real-World Validation

**Mục tiêu:** test đường thực thi production, không chỉ schema/pure function.

**Test cases:**

- Fresh init → plan → source write block/allow → verify → stop → resume.
- Unapproved/stale/wrong-slug plan.
- Missing/invalid/negative verdict.
- Compaction safety rearm.
- Claude canonical settings → each provider transform.
- Tool absent → clean degradation.
- Parallel run conflict/reconciliation.

**Fixtures:**

- Dùng shipping `.claude/settings.json`, không synthetic Bash matcher thay thế Edit/Write.
- Fixture project nhỏ cho Node, Python và polyglot.
- Trace corpus từ real prompts với expected capability use.

**Acceptance criteria:**

- Entrypoint/flag/exit-code tests cho mọi CLI command trọng yếu.
- Provider parity matrix sinh từ test results.
- Verification proof được rerun/captured, không self-report.
- Working tree sạch sau mọi probe.

## 9. Risk Register

| Risk | Khả năng/Tác động | Bằng chứng hiện tại | Mitigation |
|---|---|---|---|
| Nhiều docs, ít runtime wiring | Cao/Cao | Trigger và session-continuation claims | Gắn producer/consumer/activation vào inventory |
| Agent không discover capability | Cao/Cao | Không central tool registry | Capability query + status/probe |
| Hook không chạy đúng lifecycle | Trung bình/Cao | Claude pass; provider loss | Golden canonical transforms + runtime probes |
| Skill quá dài/context noise | Cao/Trung bình | 124 skills; audit overstated static load | Progressive disclosure + correct tier metrics |
| Workflow quá model-specific | Cao/Cao | Claude paths/matchers | Core contract + provider adapter |
| State files làm project rác | Trung bình/Trung bình | Nhiều state namespaces | Một ephemeral state dir, compact schema, TTL |
| Generic claim nhưng Claude-bound | Cao/Cao | `.claude` source + Codex drop | Role/enforcement coverage report |
| So sánh chỉ dựa docs | Trung bình/Cao | Prior reports đã stale | Source/test/runtime evidence labels |
| False completion | Cao/Cao | marker producer thiếu, file existence checks | Scoped result envelope + parsed verdict |
| False Gate 1 approval | Cao/Cao | Any plan file passes default | Bind active plan/run; enforce approval semantics |
| Plugin payload drift/hygiene | Trung bình/Trung bình | Generated payload lớn; no full regenerate-diff gate | Deterministic regenerate-and-diff CI |
| Doctor mutation bất ngờ | Thấp/Trung bình | chmod/probe behavior | `doctor` read-only; mutation sau `--fix` approval |
| SQLite authority fragmentation | Trung bình/Cao | Harness-experimental dùng hai DB domains | Giữ JSON/Markdown canonical; SQLite derived |
| Security downgrade khi migrate | Cao/Cao | Codex mất 7 hooks | Fail/warn on critical enforcement loss |

## 10. Final Recommendation

### Nên cải tiến đầu tiên

Đóng vòng `active plan → required verification → scoped result → checkpoint/resume`. Đây là dependency cho status, Gate 2, long-running continuity và anti-hallucination. Nếu chưa có vòng này, thêm agent/skill/hook chỉ tăng catalog chứ không tăng reliability.

### Nên giữ

- `.claude` như Claude provider source; không ép thành universal runtime folder.
- Provider contracts và migration adapters.
- Smart update/ownership/checksum model.
- Canonical workflow YAML và drift validation.
- Markdown plans/checklists làm durable human-readable authority.
- JSON/JSONL canonical state; SQLite chỉ derived index.
- Wiki candidate/quarantine/approval architecture.
- Hard-gate behavioral probe.

### Nên bỏ hoặc hạ claim

- “Auto-run” nếu host không có consumer.
- “Approved plan” khi default chỉ kiểm tra existence.
- “Hard Gate 2” trong provider summary khi implementation behavioral.
- “Hooks supported” nếu registration/enforcement coverage bị giảm.
- Autosave/session-continuation claims không có runtime producer.
- Duplicate command semantics giữa slash và CLI.

### Nên học từ `harness-experimental`

- Capability-first tool registry.
- Run contract + compact result envelope.
- Durable isolation/queue chỉ khi use case cần.
- Operation logs/changesets cho parallel reconciliation.

### Không nên copy

- Full Symphony runtime vào core MeowKit.
- Canonical SQLite kép.
- Codex unsafe permission defaults.
- Self-reported verification.
- Repo-specific context heuristics.

### Bước tiếp theo nếu implement

1. `/ck:plan --tdd` cho state/evidence refactor vì thay đổi critical workflow behavior.
2. Phase đầu chỉ sửa producer/state contracts và tests; chưa mở rộng catalog.
3. Chạy plan validation/red-team sau khi plan được tạo.
4. Dùng canonical shipping settings làm fixture khóa provider semantics.

## Unresolved Questions

1. Codex runtime target có matcher non-Bash nào ngoài capability table hiện tại không? Repository hiện giả định không.
2. Product muốn Gate 1 mặc định yêu cầu explicit human approval, hay chỉ cần plan existence nhưng phải đổi wording?
3. Native Codex plugin có chủ đích chỉ expose skills, hay phải đạt parity với `mewkit migrate codex`?
4. Durable runner có use case production thực sự, hay host-native orchestration vẫn là boundary đúng?

