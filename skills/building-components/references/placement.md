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

Page components live in `src/app/` and render a main component from `src/components/[page-name]/`.

**With i18n:** `src/app/[locale]/[route-name]/page.tsx`
**Without i18n:** `src/app/[route-name]/page.tsx`

The page file default exports `[RouteNamePage]`. When the team prefers arrow functions, define the page component as a local `const` and then `export default [RouteNamePage]`. Keep logic out of page files; delegate rendering to `src/components/[page-name]/[PageName].tsx`.

```
src/app/[locale]/about-us/page.tsx   →  default exports AboutUsPage
src/components/about-us/AboutUs.tsx  →  main page component
```
