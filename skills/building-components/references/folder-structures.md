# Folder Structures

## Shared component (no sub-components)

```
src/components/common/
└── button/
    └── Button.tsx
```

## Shared component (with sub-components)

```
src/components/common/
└── header/
    ├── Header.tsx
    └── components/
        ├── nav-menu/
        │   └── NavMenu.tsx
        └── logo/
            └── Logo.tsx
```

## Page-specific component

```
src/components/home/
├── Home.tsx
└── components/
    ├── hero-section/
    │   └── HeroSection.tsx
    └── features-grid/
        ├── FeaturesGrid.tsx
        └── components/
            └── feature-card/
                └── FeatureCard.tsx
```

## Page component

```
src/
├── app/
│   └── about-us/
│       └── page.tsx                  ← exports AboutUsPage
└── components/
    └── about-us/
        └── AboutUs.tsx               ← main page component
```
