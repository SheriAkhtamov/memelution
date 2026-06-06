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

### 3. `PageLayout` & `PageHeader`
Unified structural layouts that handle responsive page rails, sticky headers, and back-to-top buttons.
* **PageLayout Variants**: `default`, `feed`, `profile`, `full`, `admin`.
* **PageHeader Accent Tones**: `orange`, `blue`, `emerald`, `amber`, `red`, `purple`, `cyan`, `violet`.

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
