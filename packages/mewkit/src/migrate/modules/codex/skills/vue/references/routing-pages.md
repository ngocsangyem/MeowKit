# File-Based Routing

> Applies to projects using Vue Router file-based routing (`unplugin-vue-router`) or Nuxt (which
> uses Vue Router under the hood). For plain manually-defined Vue Router routes, only the naming and
> typed-route guidance carries over.

`app/pages` (Nuxt) or `src/pages` contains the routes. The file/folder structure maps directly to
the URL structure.

## Contents

- [Rules](#rules)
- [Basic File Structure](#basic-file-structure)
- [Route Groups](#route-groups)
- [Resulting URLs](#resulting-urls)

## Rules

- Fetch <https://router.vuejs.org/llms.txt> and follow its links ONLY for topics not covered here.
- AVOID files named `index.vue`; use a group with a meaningful name instead: `pages/(home).vue`.
- Use explicit route param names: `userId` over `id`, `postSlug` over `slug`.
- Optional param: double brackets `[[paramName]]`.
- Repeatable param: `+` after the closing bracket — `/posts.[[slug]]+.vue` matches `/posts/some` and
  `/posts/some/post`.
- Catch-all (matches slashes too): `[...path]`.
- Multiple sub-segments in one filename: `@[username]` → `/@posva`,
  `with-[name]-[lastName]` → `/with-eduardo-san_martin_morote`.
- Customize a route from inside its component with `definePage()` (`meta`, `name`, `path`, `alias`).
- Refer to `typed-router.d.ts` for generated route names and params.
- Prefer named route locations for type safety:
  `router.push({ name: '/users/[userId]', params: { userId } })` over string concatenation.
- Pass the route name to `useRoute('/users/[userId]')` for stricter types.
- Nest folders by the URL slashes: `projects/[user]/[name].vue`.
- Use `.` in filenames to create `/` without route nesting: `users.edit.vue` → `/users/edit`.
- Create a nested layout with a component named after the folder (`users.vue` for `users/`); the
  parent must render a `<RouterView />` / `<NuxtPage />`.

## Basic File Structure

```
src/pages/
├── (home).vue # groups give more descriptive names to routes
├── about.vue
├── [...path].vue # Catch-all route for not-found pages
├── users.edit.vue # use `.` to break out of layouts
├── users.vue # Layout for all routes in users/ (nested routes of users.vue)
└── users/
    ├── (user-list).vue
    └── [userId].vue
```

## Route Groups

Route groups create shared layouts without affecting the generated URL:

```
src/pages/
├── (admin).vue # layout for all admin routes, does not affect other pages
├── (admin)/
│   ├── dashboard.vue
│   └── settings.vue
└── (user)/
    ├── profile.vue
    └── order.vue
```

## Resulting URLs

- `/dashboard` → `src/pages/(admin)/dashboard.vue`
- `/settings` → `src/pages/(admin)/settings.vue`
- `/profile` → `src/pages/(user)/profile.vue`
- `/order` → `src/pages/(user)/order.vue`
