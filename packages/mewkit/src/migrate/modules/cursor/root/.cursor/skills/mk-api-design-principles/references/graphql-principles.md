# GraphQL Contract Principles

Schema-language detail for a GraphQL contract. Compatibility, deprecation, and the
consumer-proof rule live in `SKILL.md` and apply to every style.

## Contents

- [Types are product shapes, not tables](#types-are-product-shapes-not-tables)
- [Naming and nullability](#naming-and-nullability)
- [Queries](#queries)
- [Mutations](#mutations)
- [Error semantics](#error-semantics)
- [Pagination](#pagination)
- [Relationship fetch cost](#relationship-fetch-cost)
- [Authorization in the contract](#authorization-in-the-contract)
- [What not to prescribe](#what-not-to-prescribe)

## Types are product shapes, not tables

A GraphQL type describes what a consumer sees. It may span several tables, or expose a
fraction of one. Mirroring the storage layout into the schema couples every future data
change to a contract change — and hands `mk:database` a shape it did not choose.

Whenever a field's cost depends on the underlying store, name the field and hand the cost
question to `mk:database`. Do not encode a storage decision in the schema.

## Naming and nullability

- Types in PascalCase, fields in camelCase, enum members in a single consistent convention.
  Match the schema that already exists.
- Non-null is the better default for a field that is always present; nullable should mean
  something ("absent" is part of the domain), not "we were unsure".
- Widening non-null to nullable breaks existing consumers. Narrowing nullable to non-null
  breaks producers. Both are contract changes.

```graphql
type User {
  id: ID!
  email: String!
  deletedAt: DateTime      # null carries meaning: not deleted
  orders(first: Int, after: String): OrderConnection!
}
```

## Queries

Expose entry points the consumer actually needs. A single-entity lookup returning null for
"not found" is a contract decision — say which one the schema uses and keep it uniform.

Collections take pagination arguments; see below.

## Mutations

- One input type per mutation rather than a list of loose scalars — it evolves additively.
- Return the affected entity or a result type, not a bare boolean; the consumer needs the
  new state.
- Name by the operation performed.

```graphql
type Mutation {
  createUser(input: CreateUserInput!): CreateUserResult!
}
```

## Error semantics

Two viable models; pick one for the whole schema:

- **Errors as schema types** (a result union per mutation). Expected business outcomes —
  validation failure, conflict, forbidden — are part of the data, and clients handle them
  exhaustively. Costs more schema surface.
- **Errors as protocol errors.** Simpler schema; clients must inspect the error channel and
  the mapping to business meaning is weaker.

Whichever the schema already uses is the answer for a change to that schema. Mixing the two
for equivalent cases is the defect.

Unexpected failures always travel as protocol errors, and never carry internal detail.

## Pagination

A connection-style shape (edges/nodes plus page metadata and an opaque cursor) is the
common default for a large ordered collection and is what most GraphQL clients expect.

A simple list is acceptable for a bounded collection that cannot grow — say so explicitly,
because converting a list field to a connection later is breaking.

A total count is a query cost. Confirm it with `mk:database` before putting it in the schema.

## Relationship fetch cost

A field that resolves per parent row multiplies work by the size of the parent list. Decide
before the schema ships whether the field is exposed at all, and how it is fetched.

Batching per request is the usual mechanism, but it is a mechanism, not a contract rule.
State the access pattern in the contract, hand measurement and the fetch strategy to
`mk:database`, and do not mandate a specific library.

## Authorization in the contract

State the authorization *requirement* per field or operation: who may read it, who may
write it, and what the consumer observes when they may not. Whether that is enforced by
schema directives or in resolvers is an implementation choice owned by
`mk:backend-development`; the verdict on whether it is correct belongs to the security
workflow.

## What not to prescribe

- A specific batching, caching, or client library.
- A query-complexity limit, depth limit, or cost value.
- Whether introspection is enabled — that is a deployment posture question, not a contract
  rule, and belongs to `mk:devops` and the security workflow.
- A file-upload transport.
- A schema-registry or federation topology the repository does not already use.
