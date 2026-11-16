# Component Placement

## Shared (common) component

```
src/components/common/[component-name]/[ComponentName].tsx
```

Use for components reused across multiple pages (e.g., Header, Footer, Button).

## Page-specific component

```
src/components/[page-name]/[PageName].tsx                  # main page component
src/components/[page-name]/components/[component-name]/[ComponentName].tsx
```

## Sub-component

Place inside a `components/` folder within the parent:

```
[parent-component-name]/
├── [ParentComponent].tsx
└── components/
    └── [child-component-name]/
        └── [ChildComponent].tsx
```

Nesting can go 5-6 levels deep following this same pattern at every level.

## Page component

Inspect existing routes to identify the router and avoid duplicates before creating a page. Page components render a main component from `src/components/[page-name]/`.

- **App Router:** `src/app/[route-name]/page.tsx` (or `src/app/[locale]/[route-name]/page.tsx` when appropriate)
- **Pages Router:** `src/pages/[route-name].tsx`

Use the project's existing route directory (`app/`, `pages/`, `src/app/`, or `src/pages/`). Follow the router's filename and export requirements for page files.

The page file default exports `[RouteNamePage]`. When the team prefers arrow functions, define the page component as a local `const` and then `export default [RouteNamePage]`. Keep logic out of page files; delegate rendering to `src/components/[page-name]/[PageName].tsx`.

```
src/app/[locale]/about-us/page.tsx   →  default exports AboutUsPage
src/components/about-us/AboutUs.tsx  →  main page component
```
