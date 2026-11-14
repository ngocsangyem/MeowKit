# Server-Side Patterns (HIGH priority)

Server Components and caching — maximize what runs on the server.

## server-cache-react
**Problem:** Same data fetched multiple times within one request (different components calling same API).
**Fix:** Use `React.cache()` for per-request deduplication.
```tsx
const getUser = React.cache(async (id: string) => {
  return db.user.findUnique({ where: { id } })
})
// Called 3 times in different components → only 1 DB query
```

## server-cache-lru
**Problem:** Expensive computation repeated across requests.
**Fix:** Use LRU cache for cross-request caching (survives between requests, bounded memory).
```tsx
import { LRUCache } from 'lru-cache'
const cache = new LRUCache<string, Data>({ max: 500, ttl: 1000 * 60 * 5 })
```

## server-parallel-fetching
**Problem:** Parent component fetches, then children fetch — sequential waterfall.
**Fix:** Restructure to start all fetches at the same level.
```tsx
// BAD: Layout fetches user → Page fetches posts (waterfall)
// GOOD: Both fetch at page level, pass data down
const [user, posts] = await Promise.all([getUser(), getPosts()])
```

## server-serialization
**Problem:** Server Component passes large objects to Client Components, bloating the RSC payload.
**Fix:** Select only needed fields before passing to client.
```tsx
// BAD: passes entire user object (50 fields)
<ClientProfile user={user} />

// GOOD: passes only what's rendered
<ClientProfile name={user.name} avatar={user.avatar} />
```

## server-after-nonblocking
**Problem:** Analytics/logging blocks response.
**Fix:** Use Next.js `after()` for non-blocking post-response work.
```tsx
import { after } from 'next/server'
after(() => { logAnalytics(event) }) // runs after response sent
```
