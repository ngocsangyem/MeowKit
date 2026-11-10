# System design consultation

A design pass over a system or feature that does **not** yet exist in the tree, or exists only
as a sketch. Output is design documentation only — no implementation code is generated here.

Use this when the question is "how should this be built", and the main workflow when the
question is "where is the existing code shallow". The two differ in their subject: this one has
no code to grill a patch out of.

## Procedure

1. **Identify components and boundaries.** Name the major components or services, where the
   boundaries between them fall, and what each component is responsible for. A component whose
   responsibility cannot be stated in one sentence is two components.

2. **Draw the data flow** as ASCII — entry points (API, UI, events), the path between
   components, storage layers (databases, caches, queues) and external integrations:

   ```
   [Client] → [API Gateway] → [Auth Service]
                            → [User Service]         → [PostgreSQL]
                            → [Notification Service] → [Email Provider]
   ```

3. **Specify each integration point.** Per boundary crossing: protocol (HTTP, gRPC, events,
   direct call), data format, synchronous or asynchronous, and **what happens when it fails**.
   The failure answer is the load-bearing one — an integration with no stated failure mode is an
   assumption that it cannot fail.

4. **Flag scalability concerns** concretely: single points of failure, components that cannot
   scale horizontally, data hotspots, missing caching layers, unbounded growth. Quantify where
   the numbers are knowable; "this is slower" is not a finding, "this adds a round trip per row"
   is.

5. **Propose a design with at least one alternative.** Give the recommendation with its
   rationale, one genuine alternative (not a straw man), the trade-offs between them along
   complexity, cost, performance and maintainability, and the reason the recommendation wins.
   When the trade-off is a business decision rather than a technical one, say so and hand it
   back instead of deciding it.

## Output

Component diagram (ASCII), data flow, integration points with failure behavior, scalability
analysis, and the design alternatives with the recommendation. Durable decisions that come out
of this belong in an ADR — `mk:arch new` records one.
