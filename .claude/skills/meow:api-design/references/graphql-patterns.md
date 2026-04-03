# GraphQL API Patterns

Conventions for building consistent, performant GraphQL APIs.

---

## Schema Design

- **Types mirror domain objects, not database tables.** A `User` type represents a user in the
  product sense — it may join multiple tables internally. Don't expose DB schema shape.
- Use **PascalCase** for types: `User`, `Order`, `PaymentMethod`
- Use **camelCase** for fields: `createdAt`, `firstName`, `orderId`
- Use **SCREAMING_SNAKE_CASE** for enum values: `ORDER_STATUS_PENDING`, `ROLE_ADMIN`
- Prefer **non-null by default** — use nullable only when absence is semantically meaningful:
  - `name: String!` — always present
  - `deletedAt: DateTime` — null means not deleted (meaningful absence)

```graphql
type User {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  createdAt: DateTime!
  deletedAt: DateTime       # null = active, value = soft-deleted
  orders(first: Int, after: String): OrderConnection!
}

enum UserRole {
  ROLE_ADMIN
  ROLE_MEMBER
  ROLE_VIEWER
}
```

---

## Queries

### Single Entity
```graphql
type Query {
  user(id: ID!): User          # returns null if not found (not an error)
  order(id: ID!): Order
}
```

### Collections with Pagination
```graphql
type Query {
  users(first: Int, after: String, filter: UserFilter): UserConnection!
  orders(first: Int, after: String, status: OrderStatus): OrderConnection!
}
```

Use the **Relay connection spec** for all paginated collections (see Pagination section below).

---

## Mutations

- Use **input types** for all mutation arguments — never inline multiple scalar args
- Return the **affected entity** (or a result union) — never return just a boolean
- Use **verb + noun** naming: `createUser`, `updateOrder`, `cancelSubscription`

```graphql
type Mutation {
  createUser(input: CreateUserInput!): CreateUserResult!
  updateOrder(id: ID!, input: UpdateOrderInput!): UpdateOrderResult!
  cancelSubscription(id: ID!): CancelSubscriptionResult!
}

input CreateUserInput {
  email: String!
  name: String!
  role: UserRole = ROLE_MEMBER
}

union CreateUserResult = User | ValidationError | DuplicateEmailError
```

---

## Error Handling

**Prefer union return types over throwing errors.** GraphQL errors (thrown exceptions) are
for unexpected failures. Business errors (validation, not found, permission) should be
modeled as types in the schema.

```graphql
# Good — business errors as types
union CreateUserResult = User | ValidationError | NotFoundError | UnauthorizedError

type ValidationError {
  message: String!
  fields: [FieldError!]!
}

type FieldError {
  field: String!
  message: String!
}

# Avoid — throwing GraphQL errors for expected business cases
# These show up in the `errors` array, not `data`, making client handling harder
```

Client query pattern with union results:
```graphql
mutation {
  createUser(input: { email: "test@example.com", name: "Test" }) {
    ... on User { id email }
    ... on ValidationError { message fields { field message } }
    ... on DuplicateEmailError { message }
  }
}
```

---

## Pagination — Relay Connection Spec

Use the Relay connection pattern for all paginated collections:

```graphql
type UserConnection {
  edges: [UserEdge!]!
  nodes: [User!]!       # shortcut when edge metadata not needed
  pageInfo: PageInfo!
  totalCount: Int!
}

type UserEdge {
  node: User!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

Query example:
```graphql
query {
  users(first: 20, after: "cursor_abc") {
    nodes { id email }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

---

## N+1 Prevention — DataLoader (Mandatory)

Every resolver that fetches a related entity MUST use DataLoader. Without it, fetching
100 users with their orders fires 101 queries (1 for users + 1 per user for orders).

```typescript
// BAD — fires N queries for N users
const resolver = {
  User: {
    orders: (user) => db.orders.findAll({ where: { userId: user.id } })
  }
}

// GOOD — DataLoader batches into 1 query
const orderLoader = new DataLoader(async (userIds) => {
  const orders = await db.orders.findAll({ where: { userId: userIds } });
  return userIds.map(id => orders.filter(o => o.userId === id));
});

const resolver = {
  User: {
    orders: (user) => orderLoader.load(user.id)
  }
}
```

**Rule:** If a resolver calls the database, it MUST go through a DataLoader. No exceptions.
DataLoaders are scoped per request — create them in context, not globally.

---

## Auth — Directive-Based

Use schema directives for authorization rather than per-resolver checks:

```graphql
directive @auth on FIELD_DEFINITION | OBJECT
directive @hasRole(role: UserRole!) on FIELD_DEFINITION

type Query {
  me: User @auth
  adminStats: AdminStats @auth @hasRole(role: ROLE_ADMIN)
}

type User {
  email: String! @auth
  internalNotes: String @auth @hasRole(role: ROLE_ADMIN)
}
```

Benefits: authorization is visible in the schema, not buried in resolver logic.
Implement directives in the schema builder — not inline in each resolver.

---

## Gotchas

- **Over-fetching prevention:** Encourage clients to request only needed fields; don't add
  query complexity limits so low that legitimate queries fail
- **Introspection in production:** Disable `__schema` introspection in production to avoid
  leaking schema to attackers — expose only via authenticated developer portal
- **Subscription authorization:** WebSocket connections bypass standard HTTP auth middleware;
  implement auth in `onConnect` handler, not in subscription resolvers
- **File uploads:** Use multipart form (graphql-upload) or pre-signed URLs; never base64-encode
  files in mutation arguments
