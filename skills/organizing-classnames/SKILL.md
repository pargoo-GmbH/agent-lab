---
name: organizing-classnames
description: Organizes classNames usage and class ordering using project conventions in React components. Use this skill whenever writing or reviewing component className props with the classnames package, applying utility classes or locally scoped styles, organizing responsive styles, or writing conditional class expressions.
metadata:
  author: "pargoo GmbH"
  website: "https://www.pargoo.com/"
---

# ClassNames Usage and Conventions

*Built by the team at [pargoo](https://www.pargoo.com/).*

Inspect the project's styling setup, documentation, and instructions first. Apply these classNames patterns with its existing classes. Tailwind syntax in the examples is illustrative; use the project's actual styling and responsive conventions with any approach, including combinations of utility classes and locally scoped styles.

## 1. Import and Component Props Pattern

- Import `classNames` from `'classnames'` alongside other third-party imports
- The `className` prop must be optional: `className?: string`
- Merge the consumer's `className` **last** (CSS precedence still determines which styles win):

```tsx
className={classNames('default-classes', className)}
```

## 2. Breakpoint Order (Mobile-First)

For mobile-first responsive utilities, order the project's breakpoints from smallest to largest. Tailwind-style example:

```
base (no prefix) → xs: → s: → sm: → md: → m: → lg: → xl: → 2xl:
```

> Use the project's actual responsive configuration. Inspect Tailwind configuration only in Tailwind projects.

## 3. Class Organization Rules

- **Group responsive utilities by breakpoint** — each breakpoint gets its own string argument when applicable
- **Order utilities logically** within each group: layout → spacing → typography → colors → effects
- **No trailing comma** after the last `classNames` argument
- Breakpoint grouping controls the arguments inside `classNames`; it does not by itself justify extracting the result into a variable

## 4. Patterns

### Basic Breakpoint Ordering

```tsx
className={classNames(
  'base-style-1 base-style-2',
  'xs:xs-style-1 xs:xs-style-2',
  'sm:sm-style-1 sm:sm-style-2',
  'md:md-style-1 md:md-style-2',
  'lg:lg-style-1 lg:lg-style-2',
  'xl:xl-style-1 xl:xl-style-2',
  '2xl:2xl-style-1 2xl:2xl-style-2'
)}
```

### Conditional Classes + Passed `className` Prop

```tsx
type Props = {
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
};

export const Button: React.FC<Props> = ({
  children,
  size = ButtonSize.MEDIUM,
  variant = ButtonVariant.PRIMARY,
  className,
  ...props
}) => (
  <button
    className={classNames(
      "block rounded-lg text-center transition",
      "disabled:opacity-50",
      { "px-3 py-2 text-sm-medium": size === ButtonSize.SMALL },
      { "px-4 py-3 text-md-medium": size === ButtonSize.MEDIUM },
      {
        "bg-orange-500 text-white hover:bg-orange-700":
          variant === ButtonVariant.PRIMARY,
      },
      {
        "outline outline-gray-500 hover:text-orange-500":
          variant === ButtonVariant.SECONDARY,
      },
      { "pointer-events-none": Boolean(props?.disabled) },
      className,
    )}
    type="button"
    {...props}
  >
    {children}
  </button>
);
```

### Multiple `className` Props for Sub-elements

Expose separate className props for each styleable sub-element:

```tsx
type Props = {
  title: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export const Card: React.FC<Props> = ({
  title,
  children,
  className,
  headerClassName,
  contentClassName,
}) => (
  <div className={classNames("rounded-lg border", className)}>
    <div className={classNames("border-b p-4", headerClassName)}>{title}</div>
    <div className={classNames("p-4", contentClassName)}>{children}</div>
  </div>
);
```

### One-Use Responsive Styles Stay Inline

Keep a class set next to the element when it is used only once. Use an inline `classNames(...)` call to group breakpoint-specific strings without creating a one-use variable. This preserves locality: a reader can understand the element without jumping to another declaration.

```tsx
<Button
  className={classNames(
    'max-lg:hidden',
    'lg:ml-auto lg:inline-flex'
  )}
>
  Action
</Button>
```

Do not extract `desktopActionClassName` from this example merely because the classes are responsive, the call spans several lines, or a variable would shorten the JSX.

### Shared Styles (Extract Reused Class Sets)

Extract a class set only when the resulting variable is referenced more than once. Reuse is the reason for the abstraction; length or breakpoint grouping alone is not. Keep one-use class sets inline even when their `classNames(...)` call spans several lines.

When multiple elements share the same base classes, extract to a variable:

```tsx
const Buttons = () => {
  const buttonClassName = classNames(
    'flex w-full shrink-0 items-center justify-center transition-colors',
    'lg:cursor-pointer'
  );

  return (
    <div className="flex flex-col gap-3">
      <button className={classNames(buttonClassName, 'button-primary')}>
        {/* Content */}
      </button>
      <button className={classNames(buttonClassName, 'button-secondary')}>
        {/* Content */}
      </button>
    </div>
  );
};
```

### Placement of Extracted Class Sets

Define a class variable inside the component, near its usages, when it is shared only by elements in that component. Keeping the declaration local makes ownership and relevance clear; moving trivial `classNames` work outside the render has no meaningful performance benefit.

Move a class set to module scope only when it is intentionally shared by multiple components or functions in the file, or when it represents a genuine file-level constant. Use constant naming such as `MOBILE_ACTION_CLASS_NAME` so the broader scope is explicit.

```tsx
export const Actions: React.FC = () => {
  const mobileActionClassName = classNames('w-full', 'lg:hidden');

  return (
    <div>
      <Button className={mobileActionClassName}>Save</Button>
      <Button className={mobileActionClassName}>Cancel</Button>
    </div>
  );
};
```

## 5. Quick Checklist

- [ ] `classNames` imported from `'classnames'` and project styling conventions followed
- [ ] `className?: string` prop is optional
- [ ] Consumer `className` merged at the **end**
- [ ] Responsive styles follow the project's conventions and configured breakpoints
- [ ] Responsive utilities grouped by breakpoint when applicable
- [ ] Utilities ordered: layout → spacing → typography → colors → effects
- [ ] No trailing comma after last argument
- [ ] One-use class sets kept inline with their element
- [ ] Extracted class sets referenced more than once
- [ ] Component-specific class variables defined inside the component near their usages
- [ ] Module-level class constants used only for genuine file-level sharing and named as constants
