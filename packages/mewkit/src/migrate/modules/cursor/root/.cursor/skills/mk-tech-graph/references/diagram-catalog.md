# Diagram Catalog

## Contents

- [Architecture and data flow](#architecture-and-data-flow)
- [Process and agent diagrams](#process-and-agent-diagrams)
- [Time, comparison, and concept diagrams](#time-comparison-and-concept-diagrams)
- [UML and data-model diagrams](#uml-and-data-model-diagrams)
- [Network topology](#network-topology)
- [UML coverage map](#uml-coverage-map)

## Architecture and data flow

### Architecture Diagram

Use for services and components. Group horizontal layers top-to-bottom or left-to-right: Client → Gateway/LB → Services → Data/Storage. Use dashed `<rect>` containers for related services, point arrows in the data/request direction, and start with viewBox `0 0 960 600` (`960 800` for tall stacks).

### Data Flow Diagram

Use when the emphasis is what data moves where and how it changes. Label every arrow with its data type, make primary data paths `stroke-width: 2.5`, use dashed arrows for control/trigger flows, and colour arrows by data semantics.

## Process and agent diagrams

### Flowchart / Process Flow

Use top-to-bottom unless a wide flow needs left-to-right. Use diamonds for decisions, rounded rectangles for processes, parallelograms for I/O, labels of three words or fewer with sub-labels for detail, and an x/y grid of 120px/80px.

### Agent Architecture Diagram

Consider input (user/query/trigger), agent core (LLM/reasoning/planner), memory (context window/vector or graph DB/episodic), tools (APIs/search/code execution), and outputs (response/action/side-effect). Draw cyclic arrows for iterative reasoning and distinguish memory types visually.

### Memory Architecture Diagram

Use separate read and write paths with different arrow colours. Show Working Memory → Short-term → Long-term → External Store and label `store()`, `retrieve()`, `forget()`, and `consolidate()`. Use stacked rectangles or layered cylinders for storage tiers.

### Sequence Diagram

Use labelled participant lifelines, horizontal messages ordered top-to-bottom, thin activation boxes, and loop/alt frames labelled at their top-left. Set height to `80 + (message count × 50)`.

## Time, comparison, and concept diagrams

### Comparison / Feature Matrix

Use systems as columns and attributes as rows. Use 40px rows, 120px minimum columns, a 50px header, tinted checked cells with `✓`, neutral unsupported cells, and alternating row fills. Split beyond five readable columns.

### Timeline / Gantt

Use a horizontal time axis and item rows. Draw rounded, category-coloured bars with labels and diamond or circle milestones. Start with `0 0 960 400`; use `1200` width when periods are numerous.

### Mind Map / Concept Map

Put the central concept at `480,280`. Spread first-level branches by `360/N` degrees; branch second-level concepts 30–45 degrees from their parent. Use cubic Bézier paths rather than straight lines.

## UML and data-model diagrams

### Class Diagram (UML)

Use three-compartment class boxes (name, attributes, methods), at least 160px wide. Mark visibility with `+`, `-`, and `#`; italicise abstract names. Draw inheritance with a solid hollow triangle, implementation with a dashed hollow triangle, association with multiplicities, aggregation with a hollow diamond, composition with a filled diamond, and dependency as dashed/open. Place parents above children and interfaces beside implementors.

### Use Case Diagram (UML)

Place stick-figure actors outside a dashed system boundary; place 140×60px minimum, verb-named ellipses inside. Draw `<<include>>` and `<<extend>>` as dashed arrows and generalization with a hollow triangle. Use `0 0 960 600` initially.

### State Machine Diagram (UML)

Use 120×50px rounded state boxes, a filled initial circle, nested final circle, choice diamonds with `[guard]`, labelled transitions (`event [guard] / action`), composite state containers, and thick fork/join bars. Place initial top-left and final bottom-right in a top-to-bottom flow.

### ER Diagram

Use entity boxes with bold headers and attributes; underline primary keys and distinguish foreign keys. Use relationship diamonds and cardinality labels (`1`, `N`, `0..1`, `0..*`, `1..*`), double borders for weak entities, and solid/dashed lines for identifying/non-identifying relations. Use 2–3 entity rows, `960×600` by default, or `1200×600` for broad schemas.

## Network topology

Use icon-like devices: router circles, switch rectangles, stacked server racks, firewall shields/bricks, split load balancers, and cloud paths. Use solid wired lines (with bandwidth), dashed wireless lines, dashed VPN lines with locks, and dashed zone containers. Label hostname/IP at 12–13px and arrange Internet → Edge → Core → Access → Endpoints.

## UML coverage map

| UML Diagram | Supported As | Notes |
| --- | --- | --- |
| Class | Class Diagram | Full UML notation |
| Component | Architecture Diagram | Use fills by component type |
| Deployment | Architecture Diagram | Add node/instance labels |
| Package | Architecture Diagram | Use dashed grouping containers |
| Composite Structure | Architecture Diagram | Nest rectangles |
| Object | Class Diagram | Underline instance name |
| Use Case | Use Case Diagram | Full actor/ellipse relationships |
| Activity | Flowchart / Process Flow | Add fork/join bars |
| State Machine | State Machine Diagram | Full UML notation |
| Sequence | Sequence Diagram | Add alt/opt/loop frames |
| Communication | Sequence Diagram | Approximate by swapping axes |
| Timing | Timeline | Adapt the time axis |
| Interaction Overview | Flowchart | Combine activity and sequence fragments |
| ER Diagram | ER Diagram | Chen or Crow's foot notation |
