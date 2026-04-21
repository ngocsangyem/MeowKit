# Skill: Stack-Specific Code Patterns

**Purpose:** Define and enforce coding conventions for each stack. Use these patterns as the reference for code generation and code review.

## Contents

- [When to Use](#when-to-use)
- [NestJS Patterns](#nestjs-patterns)
  - [Pattern: Module/Controller/Service/DTO](#pattern-modulecontrollerservicedto)
  - [Pattern: Guard Usage](#pattern-guard-usage)
  - [Pattern: Pipe Validation](#pattern-pipe-validation)
  - [Pattern: DTO with Validation](#pattern-dto-with-validation)
- [Vue 3 Patterns](#vue-3-patterns)
  - [Pattern: Composition API with Script Setup](#pattern-composition-api-with-script-setup)
  - [Pattern: Pinia Store](#pattern-pinia-store)
  - [Pattern: Composables](#pattern-composables)
- [Swift Patterns](#swift-patterns)
  - [Pattern: MVVM Architecture](#pattern-mvvm-architecture)
  - [Pattern: Combine / Async-Await](#pattern-combine-async-await)
  - [Pattern: Protocol-Oriented Design](#pattern-protocol-oriented-design)
- [General Rules (All Stacks)](#general-rules-all-stacks)


## When to Use

Reference this skill when writing new code or reviewing existing code in any of the supported stacks.

---

## NestJS Patterns

### Pattern: Module/Controller/Service/DTO

**When to use:** Every new feature or domain entity.

```typescript
// module registers controller, service, and imports
@Module({
  imports: [TypeOrmModule.forFeature([Entity])],
  controllers: [FeatureController],
  providers: [FeatureService],
})
export class FeatureModule {}
```

**Anti-pattern:** Putting business logic in controllers. Controllers handle HTTP concerns only; services handle logic.

### Pattern: Guard Usage

**When to use:** Every controller that requires authentication or authorization.

```typescript
@Controller('features')
@UseGuards(AuthGuard, RolesGuard)
export class FeatureController {
  // all routes are protected
}
```

**Anti-pattern:** Relying on middleware alone for auth. Guards are explicit and testable.

### Pattern: Pipe Validation

**When to use:** Every endpoint that accepts user input.

```typescript
@Post()
async create(@Body(ValidationPipe) dto: CreateFeatureDto): Promise<Feature> {
  return this.featureService.create(dto);
}
```

**Anti-pattern:** Manual validation in service methods. Let class-validator handle it via DTOs.

### Pattern: DTO with Validation

**When to use:** Every request/response shape.

```typescript
export class CreateFeatureDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsInt() @Min(0) priority?: number;
}
```

**Anti-pattern:** Using raw `any` types or unvalidated objects as input.

---

## Vue 3 Patterns

### Pattern: Composition API with Script Setup

**When to use:** Every Vue component.

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
const count = ref(0)
const doubled = computed(() => count.value * 2)
</script>
```

**Anti-pattern:** Using Options API in new code. Mixing Options API and Composition API in the same component.

### Pattern: Pinia Store

**When to use:** Shared state that multiple components need access to.

```typescript
export const useFeatureStore = defineStore('feature', () => {
  const items = ref<Feature[]>([])
  const activeItem = computed(() => items.value.find(i => i.active))
  async function fetchItems() { /* ... */ }
  return { items, activeItem, fetchItems }
})
```

**Anti-pattern:** Using Vuex in new code. Storing local-only state in Pinia (use component `ref` instead).

### Pattern: Composables

**When to use:** Reusable stateful logic shared across components.

```typescript
export function useDebounce<T>(value: Ref<T>, delay: number): Ref<T> {
  const debounced = ref(value.value) as Ref<T>
  // debounce logic
  return debounced
}
```

**Anti-pattern:** Duplicating reactive logic across components. Creating composables for non-reusable logic.

---

## Swift Patterns

### Pattern: MVVM Architecture

**When to use:** Every screen/view in the app.

```swift
class FeatureViewModel: ObservableObject {
    @Published var items: [Feature] = []
    private let service: FeatureServiceProtocol
    func loadItems() async { items = await service.fetchAll() }
}
```

**Anti-pattern:** Putting networking or business logic in Views. Fat view controllers.

### Pattern: Combine / Async-Await

**When to use:** Asynchronous operations (network, database, file I/O).

```swift
func fetchFeature(id: String) async throws -> Feature {
    let (data, _) = try await URLSession.shared.data(from: url)
    return try JSONDecoder().decode(Feature.self, from: data)
}
```

**Anti-pattern:** Nested completion handlers (callback hell). Blocking the main thread with synchronous calls.

### Pattern: Protocol-Oriented Design

**When to use:** Any service, repository, or dependency that should be mockable/testable.

```swift
protocol FeatureServiceProtocol {
    func fetchAll() async throws -> [Feature]
    func save(_ feature: Feature) async throws
}
```

**Anti-pattern:** Concrete class dependencies that prevent testing. God objects that implement too many concerns.

---

## General Rules (All Stacks)

- No `any` types. Ever. Use `unknown` if the type is truly unknown, then narrow.
- Public API functions must have explicit return types.
- No magic strings — use enums or constants.
- Prefer immutability — use `const`, `let`, `readonly` where possible.
- One concern per file. If a file does two unrelated things, split it.