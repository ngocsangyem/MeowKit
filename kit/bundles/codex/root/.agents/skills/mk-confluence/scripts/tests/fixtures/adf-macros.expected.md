# Sample Spec Page

Authors: @Alice Example and @Bob Example.

> [INFO]
> Heads up: this spec is in review.

> [WARN]
> Performance budget is tight.

> [DECISION]
> Use OAuth 2.0 with PKCE for the new auth flow.

> [DECISION]
> Store refresh tokens in an httpOnly cookie.

- [x] Draft RFC and circulate.
- [ ] Implement token refresh handler.
- [ ] Add e2e test for the login redirect path.

<details>
<summary>Implementation notes</summary>

Inline `code` stays unchanged.

```typescript
const token = await refresh(session);
```

</details>

See the design link: [Login Flow Mocks](https://www.figma.com/file/xyz/Login-Flow) [smart-card]

![auth sequence diagram](attachment:att-9001)

| Field | Type |
| --- | --- |
| userId | uuid |


[UNHANDLED_NODE: exotic]
```json
{
  "attr_keys": [
    "text"
  ],
  "keys": [
    "attrs",
    "type"
  ],
  "type": "exotic"
}
```

---

## User References

- @Alice Example -> user-id: `557058:abc-123`
- @Bob Example -> user-id: `557058:def-456`
