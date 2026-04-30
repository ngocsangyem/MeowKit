# Technique: Multi-Alternative Exploration

## When to Apply
Default technique. Use when the problem is "how to build X" and multiple architecturally distinct approaches exist.

## Process
1. Identify the core requirement (what must be true for any solution)
2. Generate 3 distinct approaches that satisfy the core requirement differently
3. For each approach: state the mechanism, key trade-off, and one risk
4. Compare approaches on: complexity, maintainability, time-to-ship, scalability

## Output Shape
| # | Approach | Mechanism | Key Trade-off | Risk |
|---|----------|-----------|---------------|------|

## Example
**Problem:** "How should we handle real-time notifications?"
| # | Approach | Mechanism | Key Trade-off | Risk |
|---|----------|-----------|---------------|------|
| 1 | WebSocket server | Persistent connection per client | Low latency / high server memory | Connection management at scale |
| 2 | Server-Sent Events | One-way push over HTTP | Simple / no bidirectional | Browser connection limits |
| 3 | Polling with long-poll | HTTP request held open | No infrastructure / higher latency | Thundering herd on reconnect |
