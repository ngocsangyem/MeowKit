# Re-render Optimization (MEDIUM priority)

Reduce unnecessary re-renders. Measure first with React DevTools Profiler.

## rerender-derived-state
**Problem:** Component subscribes to raw state object, re-renders on any field change.
**Fix:** Subscribe to derived boolean/value that changes less often.
```tsx
// BAD: re-renders on every cart change
const cart = useStore(state => state.cart)
const isEmpty = cart.items.length === 0

// GOOD: re-renders only when empty↔non-empty changes
const isEmpty = useStore(state => state.cart.items.length === 0)
```

## rerender-functional-setstate
**Problem:** setState with new object recreates callbacks on every render.
**Fix:** Use functional setState for stable callback references.
```tsx
// BAD: new function every render
const increment = () => setCount(count + 1)

// GOOD: stable function, no dependency on count
const increment = () => setCount(prev => prev + 1)
```

## rerender-memo
**Problem:** Expensive child re-renders when parent state changes, even if its props didn't change.
**Fix:** Wrap with `React.memo()` — but ONLY when profiler confirms expensive re-renders.
```tsx
const ExpensiveList = React.memo(({ items }: Props) => {
  return items.map(item => <ExpensiveItem key={item.id} {...item} />)
})
```

## rerender-transitions
**Problem:** Non-urgent update (filtering, sorting) blocks urgent update (typing).
**Fix:** Wrap non-urgent updates in `startTransition`.
```tsx
const [query, setQuery] = useState('')
const [results, setResults] = useState([])

const handleSearch = (value: string) => {
  setQuery(value) // urgent: update input immediately
  startTransition(() => {
    setResults(filterResults(value)) // non-urgent: can be interrupted
  })
}
```

## rerender-lazy-state-init
**Problem:** Expensive initial value computed on every render.
**Fix:** Pass function to useState (only called once).
```tsx
// BAD: parseJSON runs every render
const [data] = useState(parseJSON(largeString))

// GOOD: parseJSON runs only on mount
const [data] = useState(() => parseJSON(largeString))
```
