# Component Conventions Reference

## Naming conventions

| Element          | Convention  | Example                            |
|------------------|-------------|------------------------------------|
| Folder name      | kebab-case  | `card-content`, `button-group`     |
| File name        | PascalCase  | `CardContent.tsx`, `ButtonGroup.tsx`|
| Component export | PascalCase  | `export const CardContent`         |
| Props type       | `type Props`| `type Props = { ... }`             |

The file name and exported component name must always match.

## Export pattern

Always use named exports:

```tsx
export const Button: React.FC<Props> = ({ title, onClick }) => (
  <button onClick={onClick}>{title}</button>
);
```

Never use default exports in components.
For App Router page files, the page component is default-exported. Example:

```tsx
const AboutPage: React.FC<Props> = async ({ params }) => {
  // ...
};

export default AboutPage;
```

Use `React.FC<Props>` when the component accepts props, or `React.FC` when it does not.

## Implicit vs explicit return

Use implicit return (arrow body) when the function body is only JSX:

```tsx
// Implicit — preferred when body is JSX-only
export const Logo: React.FC = () => (
  <div className="logo">
    <img src="/logo.svg" alt="Logo" />
  </div>
);
```

Use explicit return when the component contains logic before the JSX:

```tsx
export const Counter: React.FC<Props> = ({ initial }) => {
  const [count, setCount] = useState(initial);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
};
```

## Conditional rendering

For conditional JSX rendering, always use the explicit ternary pattern:

```tsx
{isActive ? (
  <span aria-hidden="true" className="h-0.5 w-3 shrink-0 bg-current" />
) : null}
```

Do not use logical `&&` for rendering JSX elements:

```tsx
{isActive && (
  <span aria-hidden="true" className="h-0.5 w-3 shrink-0 bg-current" />
)}
```

This rule applies to rendering elements in JSX. It is intended to keep component rendering consistent and avoid edge cases where non-boolean values can render unintentionally.

## Props ordering

Define props in this order inside `type Props`:

1. **Required** props (no `?`)
2. **Optional** props (`?`)
3. **Function** props (callbacks like `onClick`, `onSubmit`)

```tsx
type Props = {
  title: string;          // required
  id: number;             // required
  description?: string;   // optional
  className?: string;     // optional
  onClick: () => void;    // function (required)
  onSubmit?: (data: FormData) => void; // function (optional)
};
```

## Enums for visual options

When a component has discrete visual options — variants, sizes, states — define them as enums in `types.ts`. This keeps the component API explicit and type-safe.

```ts
// types.ts
export enum ButtonVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
}
```

In the component, compare against the enum value to apply conditional classes:

```tsx
// Button.tsx
export const Button: React.FC<Props> = ({
  variant = ButtonVariant.PRIMARY,
  className,
  ...props
}) => (
  <button
    className={classNames(
      'rounded-lg text-base',
      variant === ButtonVariant.PRIMARY && 'bg-blue-500 text-white',
      variant === ButtonVariant.SECONDARY && 'border border-blue-500 text-blue-500',
      className,
    )}
    {...props}
  />
);
```

Export enums from `index.ts` alongside the component so consumers import both from one place:

```ts
// index.ts
export { Button } from './Button';
export { ButtonVariant } from './types';
```

## Optional supporting files

Create these only when needed:

| File           | Purpose                          |
|----------------|----------------------------------|
| `types.ts`     | Shared types for this component  |
| `constants.ts` | Component-specific constants     |
| `helpers.ts`   | Component-specific helpers      |
| `index.ts`     | Re-exports for cleaner imports   |

## Custom hook placement

Choose hook placement based on ownership, not only on whether the hook is technically reusable.

- Use `src/hooks/useClickOutside.ts` for hooks that are shared across multiple components, pages, or domains
- Colocate a hook with its component when it supports only that component's internal behavior
- Avoid moving component-specific state or effects into `src/hooks/` just because they were extracted into a hook

Example:

```tsx
src/hooks/useClickOutside.ts
src/components/common/header/useHeaderMenu.ts
```

`useClickOutside.ts` is a shared hook. `useHeaderMenu.ts` belongs beside `Header.tsx` because it owns header-specific menu behavior, not app-wide reusable logic.
