# Async Patterns (CRITICAL priority)

Eliminating waterfalls — the highest-impact React/Next.js optimization.

## async-defer-await
**Problem:** Awaiting a promise blocks everything after it, even if subsequent code doesn't need the result.
**Fix:** Move `await` into the branch where the result is actually used.
```tsx
// BAD: blocks all subsequent code
const data = await fetchData()
if (condition) { use(data) }

// GOOD: only await when needed
const dataPromise = fetchData()
if (condition) { use(await dataPromise) }
```

## async-parallel
**Problem:** Sequential awaits create waterfalls when operations are independent.
**Fix:** Use `Promise.all()` for independent operations.
```tsx
// BAD: waterfall — 600ms total
const users = await fetchUsers()    // 200ms
const posts = await fetchPosts()    // 200ms
const comments = await fetchComments() // 200ms

// GOOD: parallel — 200ms total
const [users, posts, comments] = await Promise.all([
  fetchUsers(), fetchPosts(), fetchComments()
])
```

## async-suspense-boundaries
**Problem:** Entire page blocked waiting for slowest data fetch.
**Fix:** Wrap slow sections in `<Suspense>` with fallback to stream content progressively.
```tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent />
</Suspense>
```

## async-api-routes
**Problem:** API route awaits database before starting response.
**Fix:** Start promises early in the handler, await late.

## async-dependencies
**Problem:** `Promise.all` fails entirely if one promise rejects.
**Fix:** Use `Promise.allSettled()` or libraries like `better-all` for partial dependency resolution.
