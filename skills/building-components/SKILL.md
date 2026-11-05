---
name: building-components
description: Builds, restructures, and standardizes React components according to project conventions (placement, folder/file naming, exports, props patterns). Use when adding components or when reorganizing existing components during refactors, migrations, or component moves.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# Creating Components

*Built by the team at [pargoo](https://www.pargoo.com/).*

## Workflow

Copy this checklist and track progress:

```
Component Progress:
- [ ] Step 1: Determine placement
- [ ] Step 2: Create folder structure
- [ ] Step 3: Create component file
- [ ] Step 4: Add sub-components (if needed)
- [ ] Step 5: Validate against checklist
- [ ] Step 6: Run lint fix and re-check
```

**Step 1: Determine placement**

Infer from context if possible, otherwise ask the user. 
See [references/placement.md](references/placement.md) for paths and conventions for each type:

- Shared (common) component
- Page-specific component
- Sub-component of existing component
- Page component

If the task adds or extracts a custom hook, decide its ownership before creating files:

- Use `src/hooks/` only for hooks that are shared, or intentionally designed to be reused across multiple components, pages, or domains
- Colocate the hook with the owning component when the hook exists only for that component's internal behavior
- Do not place one-off component internals in `src/hooks/`

**Step 2: Create folder structure**

Create a kebab-case folder in the appropriate location. 
See [references/folder-structures.md](references/folder-structures.md) for diagrams of each scenario.

**Step 3: Create component file**

Create a PascalCase `.tsx` file inside the folder.
Follow the conventions in [references/REFERENCE.md](references/REFERENCE.md).

**Step 4: Add sub-components (if needed)**

If the component needs sub-components, create a `components/` folder inside it.
Each sub-component follows the same rules. See [references/placement.md](references/placement.md) for the sub-component pattern.

**Step 5: Validate against checklist**

Run through the validation checklist below before considering the component complete.

**Step 6: Run lint fix and re-check**

Run linter with auto-fix scoped only to the created or modified files. If errors remain after auto-fix, notify the user that manual fixes are required and stop — do NOT suppress errors with `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or any other suppression directives.

---

## Validation checklist

After creating a component, verify every item:

### Naming
- [ ] Folder name is kebab-case (e.g., `card-content`)
- [ ] File name is PascalCase and matches the exported component (e.g., `CardContent.tsx` exports `CardContent`)
- [ ] File is inside its own folder (not loose in a parent directory)

### Exports
- [ ] Uses named export: `export const ComponentName: React.FC<Props>`
- [ ] No default exports
- [ ] One component per file

### Props
- [ ] Props defined as `type Props` (not `interface`)
- [ ] Props ordered: required → optional → function callbacks
- [ ] `React.FC<Props>` used (or `React.FC` if no props)

### Structure
- [ ] Component placed in the correct directory (common vs page-specific)
- [ ] Sub-components live in a `components/` subfolder, not alongside the parent
- [ ] If a custom hook was added, its placement matches its scope: shared hooks in `src/hooks/`, component-specific hooks beside the owning component
- [ ] Implicit return used when the body is JSX-only
- [ ] Conditional JSX rendering uses `{condition ? <Element /> : null}`, never `condition && <Element />`

### Files
- [ ] Optional helper files (`types.ts`, `constants.ts`, `helpers.ts`, `index.ts`) created only if needed
- [ ] New custom hooks are not added to `src/hooks/` unless they are genuinely shared

### Linting
- [ ] Lint was run for changed component files
- [ ] Lint auto-fix was run
- [ ] No new lint errors remain in touched files
