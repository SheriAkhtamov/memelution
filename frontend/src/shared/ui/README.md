# Memelution Frontend UI/UX Design System

Welcome to the Memelution Frontend Design System! This directory contains the unified, typed UI component library, standardized design tokens, and layout guidelines. 

The goal of this design system is to prevent UI regression, establish visual consistency, and support light/dark modes out of the box using Tailwind CSS v4 design tokens.

---

## 🎨 Design Tokens

All colors, radiuses, animations, and typography sizes are driven by CSS custom properties in the main theme configuration (`frontend/src/index.css`).

### Standard Colors
* **Primary (Orange)**: `--color-primary` (mapped via `@theme` to `bg-primary`, `text-primary`, `border-primary`). Use for brand accents, primary buttons, and highlight states.
* **Secondary (Blue)**: `--color-secondary`. Used for community tags and links.
* **Destructive (Red)**: `--color-destructive`. Used for error boundaries, warning states, and critical actions like post/comment deletion.
* **Muted**: `--color-muted-foreground` and `bg-muted`. Used for secondary labels, inactive tabs, and placeholders.

### Radiuses & Shadows
* Use standard Tailwind border-radius classes: `rounded-xl` for cards, modals, and buttons, and `rounded-full` for avatars/pill badges.
* Use shadow tokens (`shadow-sm`, `shadow-md`, `shadow-lg`) instead of raw hex shadow definitions.

---

## 🧱 Key Components

All UI components are fully typed using TypeScript and are built with `class-variance-authority` (CVA) for clean variant-driven styling.

### 1. `Button` & `IconButton`
Specialized variants and sizes to support all interactive trigger layouts.
* **Variants**: `primary`, `secondary`, `outline`, `ghost`, `danger`.
* **Sizes**: `sm`, `md`, `lg`, `icon`, `icon-lg`.
* **Props**: `loading?: boolean` (disables the button and inserts a loading spinner).
* **Usage**:
```tsx
import { Button } from './shared/ui';

<Button variant="primary" size="lg" loading={isSubmitting}>
  Publish Post
</Button>
```

### 2. `Card`
A semantic panel wrapper that unifies shadows, borders, backgrounds, and hover effects.
* **Variants**: `surface`, `outline`, `ghost`, `hoverable`.
* **Paddings**: `none`, `sm`, `md`, `lg`.

### 3. `PageLayout`, `MainContent` & `PageHeader`
Unified structural layouts that handle responsive page rails, sticky headers, and back-to-top buttons.
* **PageLayout Variants**: `compact` (576px), `feed` (672px), `default` (896px), `profile` (896px), `full` (100%), `admin` (1280px). All driven by `--ui-page-max-w-*` tokens — never hardcode widths.
* **MainContent** is the canonical wrapper for the UX Main Content Area. Use it instead of `<div className="max-w-...">` inside the `<main id="main-content">` column.
* **PageHeader Accent Tones**: `orange`, `blue`, `emerald`, `amber`, `red`, `purple`, `cyan`, `violet`.

### App Shell Width Tokens (UX Main Content Area)
The app uses a 3-column shell (sidebar / main / right rail). Widths are typed via CSS custom properties — change them in `index.css` and the whole UI follows:

| Token | Value | Used by |
| --- | --- | --- |
| `--ui-shell-sidebar-w` | 4.5rem (72px) | collapsed left nav (sm / md) |
| `--ui-shell-sidebar-w-lg` | 18rem (288px) | expanded left nav (lg+) |
| `--ui-shell-rail-w` | 20rem (320px) | right trends/people rail (xl+) |
| `--ui-feed-sidebar-w` | 18.75rem (300px) | in-page sidebar inside `FeedLayout` |

### Main Content Max-Width Tokens
| Token | Value | PageLayout variant |
| --- | --- | --- |
| `--ui-page-max-w-compact` | 36rem (576px) | `compact` |
| `--ui-page-max-w-feed` | 42rem (672px) | `feed` |
| `--ui-page-max-w-default` | 56rem (896px) | `default` |
| `--ui-page-max-w-profile` | 56rem (896px) | `profile` |
| `--ui-page-max-w-admin` | 80rem (1280px) | `admin` |
| `--ui-page-max-w-full` | 100% | `full` |

### Responsive Breakpoints (the rules)
* `< 640px` (mobile) — only the bottom nav and the main column are visible. The column is edge-to-edge with 12px padding.
* `640–1023px` (sm / md) — collapsed icon sidebar (72px) + main column.
* `1024–1279px` (lg) — expanded sidebar (288px) + main column. The right rail is **hidden** to keep the main column comfortable.
* `≥ 1280px` (xl) — expanded sidebar (288px) + main column + right rail (320px).

### 4. `Typography`
The `Typography` (or `Text`) component prevents arbitrary font sizing and standardizes reading layouts.
* **Variants**: `h1`, `h2`, `h3`, `title`, `subtitle`, `body`, `muted`, `caption`.

### 5. `EmptyState`, `ErrorState`, & `LoadingState`
Standard placeholders for data loading, network errors, and empty search results.

---

## 🛡️ Protection Against Future UI Chaos (ESLint Rules)

To ensure that the frontend does not degrade back into inconsistent styling, custom ESLint syntax restrictions are configured in `eslint.config.js`.

### 1. No Raw Interactive Elements
Developers are prevented from using raw native `<button>`, `<input>`, and `<textarea>` elements outside of the `shared/ui` library. ESLint flags these as errors:
* 🛑 **Incorrect**: `<button onClick={...}>Click Me</button>`
* ✅ **Correct**: `<Button onClick={...}>Click Me</Button>`

### 2. No Hardcoded Arbitrary Colors or Sizing
Dynamic Tailwind arbitrary properties that use raw colors or sizes (e.g. `bg-[#FF6B00]`, `text-[15px]`) are prohibited outside of the design system components:
* 🛑 **Incorrect**: `<div className="text-[15px] text-[#FF6B00]">`
* ✅ **Correct**: `<Typography variant="body" className="text-primary">`
