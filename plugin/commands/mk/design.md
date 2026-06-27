# /design — System Design Consultation

## Usage

```
/design [system or feature]
```

## Behavior

System design consultation. Output is design documentation only — does NOT generate implementation code.

### Execution Steps

1. **Identify components and boundaries.** Analyze the system or feature to determine:
   - What are the major components/services?
   - Where are the boundaries between them?
   - What are the responsibilities of each component?

2. **Draw data flow.** Produce an ASCII diagram showing:
   - How data flows between components
   - Entry points (API, UI, events)
   - Storage layers (databases, caches, queues)
   - External service integrations
   ```
   [Client] → [API Gateway] → [Auth Service]
                             → [User Service] → [PostgreSQL]
                             → [Notification Service] → [Email Provider]
   ```

3. **Identify integration points.** For each boundary crossing:
   - What protocol is used? (HTTP, gRPC, events, direct call)
   - What data format? (JSON, protobuf, etc.)
   - Sync or async?
   - What happens if this integration fails?

4. **Flag scalability concerns.** Identify potential bottlenecks:
   - Single points of failure
   - Components that won't scale horizontally
   - Data hotspots
   - Missing caching layers
   - Unbounded growth patterns

5. **Propose design with alternatives.** Present:
   - Recommended design with rationale
   - At least one alternative approach
   - Trade-offs between options (complexity, cost, performance, maintainability)
   - Recommendation with justification

### Output

Design documentation including: component diagram (ASCII), data flow, integration points, scalability analysis, and design alternatives. No implementation code is generated.
