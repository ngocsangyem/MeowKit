# Naming Conventions

Enforced per platform. Applied during `/mk:review` (maintainability dimension) and during implementation.

## TypeScript

| Element | Convention | Example |
|---------|-----------|---------|
| Variables, functions | camelCase | `getUserById`, `isActive` |
| Classes, interfaces, types | PascalCase | `UserService`, `AuthGuard`, `CreateUserDto` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| File names | kebab-case | `user.service.ts`, `auth.guard.ts` |

## Vue

| Element | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `UserAvatar`, `LoginForm` |
| Composables | camelCase with `use` prefix | `useAuth`, `useUserProfile` |
| File names | kebab-case | `user-avatar.vue`, `use-auth.ts` |

## Swift

| Element | Convention | Example |
|---------|-----------|---------|
| Variables, functions | camelCase | `fetchUser()`, `isLoggedIn` |
| Types, protocols | PascalCase | `UserRepository`, `Authenticatable` |
| Enum cases | lowerCamelCase | `.authenticated`, `.loading` |

## Database

| Element | Convention | Example |
|---------|-----------|---------|
| Table names | snake_case, plural | `users`, `order_items` |
| Column names | snake_case | `created_at`, `user_id` |

## File Naming Patterns

| Platform | Pattern | Example |
|----------|---------|---------|
| NestJS service | `feature-name.service.ts` | `user.service.ts` |
| NestJS controller | `feature-name.controller.ts` | `user.controller.ts` |
| NestJS module | `feature-name.module.ts` | `user.module.ts` |
| NestJS DTO | `action-name.dto.ts` | `create-user.dto.ts` |
| Vue component | `FeatureName.vue` | `UserAvatar.vue` |
| Swift view | `FeatureNameView.swift` | `ProfileView.swift` |
| Swift model | `FeatureName.swift` | `User.swift` |
