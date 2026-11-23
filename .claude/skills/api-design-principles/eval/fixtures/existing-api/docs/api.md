# API

All errors use the envelope `{ "error": { "code": "string", "message": "string" } }`.
List endpoints use cursor pagination: `?cursor=<opaque>&limit=<n>`; the default `limit` is 25 and the maximum is 100.
The API is versioned in the path: `/v1/...`. Consumers: the web app and the mobile app.
