# Accessibility Audit Report: Memelution Frontend

**Project:** Memelution  
**Scope:** `/Users/sheri/Projects Sheri/Our/Memelution/frontend/src`  
**Standard:** WCAG 2.1 Level AA/AAA  
**Date:** 2026-05-23  
**Files Scanned:** 49 TSX/JSX components  
**Total Issues:** 214 (52 Critical, 112 Serious, 50 Moderate)

---

## Executive Summary

The audit identified **214 accessibility violations** across the Memelution frontend codebase. The most critical issues are concentrated in:

- **Forms (44 issues):** Missing accessible labels on inputs, textareas, and selects
- **Landmarks (141 issues):** Missing `<main>`, `<nav>`, and skip navigation links
- **Images (12 issues):** Informative images with empty `alt` attributes
- **Keyboard (6 issues):** Clickable `<div>` elements without keyboard handlers
- **Media (6 issues):** Videos without caption tracks

### Top Priority Files to Fix
1. `shared/ui/index.tsx` — 10+ violations (forms, images, keyboard)
2. `pages/auth/AuthPages.tsx` — 5 critical form label issues
3. `features/posts/components/PostCard.tsx` — 3 critical + multiple serious
4. `features/posts/components/PostComposer.tsx` — 3 critical media/form issues
5. `features/onboarding/SwipeInterestPicker.tsx` — touch-only interaction, missing ARIA

---

## 1. AuthPages.tsx — Form Accessibility

### 1.1 Missing Accessible Labels on Admin Login Inputs
- **WCAG Criterion:** 1.3.1 Info and Relationships / 4.1.2 Name, Role, Value
- **Severity:** Critical
- **Lines:** 112–113

**Current code:**
```tsx
<Input value={login} onChange={(event) => setLogin(event.target.value)} placeholder={t('app.login')} />
<Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('app.password')} type="password" error={error} />
```

**Problem:** Placeholder text is not a substitute for an accessible label. Screen readers may skip placeholders, and placeholder text disappears when the user types.

**Recommended fix:**
```tsx
<Input
  id="admin-login"
  value={login}
  onChange={(event) => setLogin(event.target.value)}
  placeholder={t('app.login')}
  aria-label={t('app.login')}
/>
<Input
  id="admin-password"
  value={password}
  onChange={(event) => setPassword(event.target.value)}
  placeholder={t('app.password')}
  type="password"
  error={error}
  aria-label={t('app.password')}
/>
```

**Better fix:** Add a visible `<label>` element (AAA recommendation):
```tsx
<label htmlFor="admin-login" className="text-sm font-bold">{t('app.login')}</label>
<Input id="admin-login" ... />
```

---

### 1.2 Missing Labels Onboarding Profile Inputs
- **WCAG Criterion:** 1.3.1 / 4.1.2
- **Severity:** Critical
- **Lines:** 249–251

**Current code:**
```tsx
<Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@nickname" error={error} />
<Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t('app.name')} />
<Input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder={t('app.avatar_url')} className="sm:col-span-2" />
```

**Recommended fix:**
```tsx
<Input id="onboarding-username" aria-label={t('onboarding.username_label')} placeholder="@nickname" ... />
<Input id="onboarding-name" aria-label={t('onboarding.name_label')} placeholder={t('app.name')} ... />
<Input id="onboarding-avatar" aria-label={t('onboarding.avatar_label')} placeholder={t('app.avatar_url')} ... />
```

---

### 1.3 Multiple `<h1>` Elements on Single Page
- **WCAG Criterion:** 1.3.1 Info and Relationships
- **Severity:** Moderate
- **Lines:** 29, 111, 165

**Current code:**
```tsx
<h1 className="text-4xl font-black">{t('common.site_name')}</h1>        {/* LoginPage */}
<h1 className="text-3xl font-black">{t('app.admin_panel')}</h1>       {/* AdminLoginPage */}
<h1 className="text-3xl font-black">{t('onboarding.title')}</h1>       {/* OnboardingPage */}
```

**Problem:** The file exports three separate page components. Each rendered page should have exactly one `<h1>`. Currently the exported `OnboardingPage` has its own `<h1>`, but the step headings below it (lines 168–170) use plain `<div>` elements instead of semantic headings.

**Recommended fix for step indicators:**
```tsx
<div className="mt-4 grid grid-cols-3 gap-2 text-xs font-black">
  {[
    ['interests', 'Интересы'],
    ['communities', 'Сообщества'],
    ['profile', 'Профиль'],
  ].map(([id, label]) => (
    <div
      key={id}
      role="tab"
      aria-selected={step === id}
      aria-label={`Step ${id}: ${label}`}
      className={`rounded-lg px-3 py-2 text-center ${step === id ? 'bg-[#FF6B00] text-white' : 'bg-gray-100 text-gray-500'}`}
    >
      {label}
    </div>
  ))}
</div>
```

---

### 1.4 Community Selection Buttons Missing Selected State Announcement
- **WCAG Criterion:** 4.1.2 Name, Role, Value
- **Severity:** Serious
- **Lines:** 211–230

**Current code:**
```tsx
<button
  key={community.id}
  type="button"
  onClick={() => toggleCommunity(community.slug)}
  className={`flex gap-3 rounded-lg border p-4 text-left transition-all ${selected ? 'border-[#FF6B00] bg-orange-50 ring-2 ring-orange-100' : 'border-gray-200 hover:border-gray-300'}`}
>
```

**Problem:** The button toggles selection but does not programmatically communicate its `aria-pressed` state to assistive technologies.

**Recommended fix:**
```tsx
<button
  key={community.id}
  type="button"
  onClick={() => toggleCommunity(community.slug)}
  aria-pressed={selected}
  aria-label={`${community.name}${selected ? ', selected' : ', not selected'}`}
  className="..."
>
```

---

## 2. dialog.tsx — Modal Accessibility

### 2.1 Close Button Renders Empty Accessible Name
- **WCAG Criterion:** 4.1.2 Name, Role, Value
- **Severity:** Critical
- **Lines:** 61–75

**Current code:**
```tsx
<DialogPrimitive.Close
  data-slot="dialog-close"
  render={
    <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" />
  }
>
  <XIcon />
  <span className="sr-only">Close</span>
</DialogPrimitive.Close>
```

**Problem:** The `render` prop replaces the default trigger with an empty `<Button variant="ghost" size="icon-sm" />`. The `<XIcon>` and `<span className="sr-only">Close</span>` are children of `DialogPrimitive.Close`, but depending on how `@base-ui/react/dialog` clones children, the accessible name may be lost because the `render` prop completely overrides the trigger element.

**Recommended fix:** Move the accessible label into the Button itself:
```tsx
<DialogPrimitive.Close
  data-slot="dialog-close"
  render={
    <Button
      variant="ghost"
      className="absolute top-2 right-2"
      size="icon-sm"
      aria-label="Close dialog"
    />
  }
>
  <XIcon />
</DialogPrimitive.Close>
```

Or better, do not use the `render` prop override:
```tsx
<DialogPrimitive.Close asChild>
  <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm" aria-label="Close dialog">
    <XIcon aria-hidden="true" />
  </Button>
</DialogPrimitive.Close>
```

---

### 2.2 Dialog Focus Trap & Escape Handling
- **WCAG Criterion:** 2.4.3 Focus Order / 2.1.1 Keyboard
- **Severity:** Moderate
- **Lines:** 40–79

**Problem:** The component relies on `@base-ui/react/dialog` for focus management. Ensure that:
1. Focus is trapped within the modal when open
2. Pressing `Escape` closes the modal
3. Focus is returned to the trigger element after closing

**Recommended fix:** Add explicit focus return management if not provided by the library:
```tsx
function DialogContent({ ... }) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Store trigger focus before opening
    triggerRef.current = document.activeElement as HTMLElement;
    return () => {
      triggerRef.current?.focus();
    };
  }, []);
  // ...
}
```

---

## 3. dropdown-menu.tsx — Menu Accessibility

### 3.1 Keyboard Navigation & ARIA Patterns
- **WCAG Criterion:** 2.1.1 Keyboard / 4.1.2 Name, Role, Value
- **Severity:** Moderate
- **Assessment:** Good baseline

**Observations:**
- Uses `@base-ui/react-menu` which provides built-in keyboard navigation (arrow keys, Escape, Enter/Space)
- `MenuPrimitive.Item` handles `role="menuitem"` automatically
- **Missing:** No `aria-expanded` on the trigger in this wrapper. Verify consumers pass it:

**Recommended fix for consumers:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button aria-expanded={open} aria-haspopup="menu">
      Open menu
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {/* items */}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## 4. ReactionPicker.tsx — Emoji Button Accessibility

### 4.1 Picker Popover Buttons Lack Accessible Names
- **WCAG Criterion:** 4.1.2 Name, Role, Value
- **Severity:** Critical
- **Lines:** 89–97

**Current code:**
```tsx
<button
  key={emoji}
  onClick={() => handlePick(emoji)}
  className="rounded-lg p-1.5 text-lg transition-transform hover:scale-125 hover:bg-gray-100 active:scale-95 dark:hover:bg-zinc-800"
>
  {emoji}
</button>
```

**Problem:** Emoji characters are often poorly announced by screen readers (e.g., "face with tears of joy" instead of "laugh"). Users cannot determine what reaction they are selecting.

**Recommended fix:**
```tsx
const REACTION_LABELS: Record<string, string> = {
  '😂': 'Laugh',
  '❤️': 'Love',
  '🔥': 'Fire',
  '😢': 'Sad',
  '😡': 'Angry',
  '👏': 'Clap',
  '💀': 'Skull',
  '🤡': 'Clown',
};

// ...

<button
  key={emoji}
  onClick={() => handlePick(emoji)}
  aria-label={`React with ${REACTION_LABELS[emoji] || emoji}`}
  className="..."
>
  <span aria-hidden="true">{emoji}</span>
</button>
```

---

### 4.2 Existing Reaction Chips Missing `aria-pressed`
- **WCAG Criterion:** 4.1.2 Name, Role, Value
- **Severity:** Moderate
- **Lines:** 57–68

**Current code:**
```tsx
<button
  key={r.emoji}
  onClick={() => handlePick(r.emoji)}
  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-black transition-all ${r.reacted ? 'border-[#FF6B00] bg-orange-50 text-[#FF6B00]' : 'border-gray-200 text-gray-500'}`}
>
  <span>{r.emoji}</span>
  <span className="tabular-nums">{r.count}</span>
</button>
```

**Recommended fix:**
```tsx
<button
  key={r.emoji}
  onClick={() => handlePick(r.emoji)}
  aria-pressed={r.reacted}
  aria-label={`${REACTION_LABELS[r.emoji] || r.emoji}: ${r.count} reactions${r.reacted ? ', you reacted' : ''}`}
  className="..."
>
  <span aria-hidden="true">{r.emoji}</span>
  <span className="tabular-nums" aria-hidden="true">{r.count}</span>
</button>
```

---

### 4.3 Popover Overlay Lacks Keyboard Dismissal
- **WCAG Criterion:** 2.1.1 Keyboard
- **Severity:** Critical
- **Lines:** 86–87

**Current code:**
```tsx
<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
```

**Problem:** The overlay is a `<div>` with only a click handler. Keyboard users cannot dismiss the popover with Escape or Tab-out because there is no focus trap or keydown listener.

**Recommended fix:**
```tsx
<div
  className="fixed inset-0 z-40"
  onClick={() => setOpen(false)}
  onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
  role="button"
  tabIndex={-1}
  aria-label="Close reaction picker"
/>
```

**Better fix:** Use a proper focus trap or the `<Popover>` primitive from the UI library with `modal={true}`.

---

## 5. SwipeInterestPicker.tsx — Touch-Only Interaction

### 5.1 Swipe Cards Not Accessible to Keyboard/Screen Reader Users
- **WCAG Criterion:** 2.1.1 Keyboard / 1.3.1 Info and Relationships
- **Severity:** Critical
- **Lines:** 100–166

**Current code:**
```tsx
<div
  className="absolute inset-0 flex cursor-grab flex-col items-center justify-center rounded-2xl border-2 bg-white shadow-lg ..."
  onTouchStart={...}
  onTouchMove={...}
  onTouchEnd={...}
  onMouseDown={...}
  onMouseMove={...}
  onMouseUp={...}
  onMouseLeave={...}
>
```

**Problem:** The card is a `<div>` with only touch/mouse handlers. Keyboard users and screen reader users cannot swipe.

**Recommended fix:** Add keyboard support and ARIA roles:
```tsx
<div
  role="group"
  aria-roledescription="swipeable card"
  aria-label={`Interest: ${current}. Swipe right to select, left to skip.`}
  tabIndex={0}
  onTouchStart={...}
  onTouchMove={...}
  onTouchEnd={...}
  onMouseDown={...}
  onMouseMove={...}
  onMouseUp={...}
  onMouseLeave={...}
  onKeyDown={(e) => {
    if (e.key === 'ArrowRight') handleDecision('right');
    if (e.key === 'ArrowLeft') handleDecision('left');
  }}
  className="..."
>
```

---

### 5.2 No Live Region for Selection Announcements
- **WCAG Criterion:** 4.1.3 Status Messages
- **Severity:** Serious
- **Lines:** 44–57

**Problem:** When a user swipes (or clicks the fallback buttons), there is no programmatic announcement that an interest was selected or skipped.

**Recommended fix:** Add an `aria-live` region:
```tsx
// At the top of the component return:
<div aria-live="polite" className="sr-only">
  {exiting === 'right' ? `${current} selected` : exiting === 'left' ? `${current} skipped` : ''}
</div>
```

---

### 5.3 Fallback Buttons Are Icon-Only Without Descriptive Labels
- **WCAG Criterion:** 2.4.4 Link Purpose (In Context) / 4.1.2
- **Severity:** Moderate
- **Lines:** 171–184

**Current code:**
```tsx
<button aria-label={t('onboarding.skip_aria')}>✕</button>
<button aria-label={t('onboarding.choose_aria')}>♥</button>
```

**Assessment:** The `aria-label` attributes are good. Ensure the translation strings are descriptive (e.g., "Skip interest: [name]", "Select interest: [name]").

---

## 6. PostCard.tsx — Complex Component Issues

### 6.1 Notification Row Uses `<div>` with onClick
- **WCAG Criterion:** 2.1.1 Keyboard / 4.1.2
- **Severity:** Critical
- **Lines:** 340–341 (inferred from scanner output at NotificationsPage.tsx:204)

**Current code pattern:**
```tsx
return <div onClick={handleClick} className="border-b border-gray-50 ...">{content}</div>;
```

**Problem:** The `<div>` is clickable but not keyboard-focusable or actionable.

**Recommended fix:** Use a `<button>` styled as needed, or add `role="button"`, `tabIndex={0}`, and `onKeyDown`:
```tsx
return (
  <div
    role="button"
    tabIndex={0}
    onClick={handleClick}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }}}
    className="..."
  >
    {content}
  </div>
);
```

---

### 6.2 Poll Options Missing `aria-checked` / Fieldset
- **WCAG Criterion:** 4.1.2 Name, Role, Value / 1.3.1
- **Severity:** Moderate
- **Lines:** 395–415

**Current code:**
```tsx
<button
  key={option.id}
  disabled={vote.isPending}
  onClick={() => requireAuth() && vote.mutate(option.id)}
  className={`relative w-full overflow-hidden rounded-lg border p-3 text-left transition-all ${selected ? 'border-[#7C3AED] bg-purple-50/50' : 'border-gray-200/60'}`}
>
```

**Problem:** Poll options act like radio buttons but use `<button>` without `aria-checked`. The entire poll lacks a `<fieldset>` and `<legend>`.

**Recommended fix:**
```tsx
<fieldset>
  <legend className="sr-only">{localPost.poll_question || 'Poll'}</legend>
  {localPost.poll_options.map((option) => {
    const selected = localPost.poll_voted_option_id === option.id;
    return (
      <button
        key={option.id}
        role="radio"
        aria-checked={selected}
        disabled={vote.isPending}
        onClick={() => requireAuth() && vote.mutate(option.id)}
        className="..."
      >
        {/* ... */}
      </button>
    );
  })}
</fieldset>
```

---

### 6.3 Media Alt Text Missing in Composer Previews
- **WCAG Criterion:** 1.1.1 Non-text Content
- **Severity:** Serious
- **Lines:** 356, 660 (PostComposer.tsx)

**Current code:**
```tsx
<img src={item.url} alt="" className="max-h-72 w-full object-cover" />
```

**Problem:** Preview images in the composer are decorative only (user-uploaded previews), but **in the PostCard itself** the media can be informative. The scanner flagged `PostComposer.tsx` specifically.

**Recommended fix:** Allow users to add alt text during upload, or generate a default:
```tsx
<img
  src={item.url}
  alt={item.alt || `Uploaded ${item.file.type.startsWith('video/') ? 'video' : 'image'} preview`}
  className="max-h-72 w-full object-cover"
/>
```

---

### 6.4 Repost & Edit Textareas Missing Labels
- **WCAG Criterion:** 1.3.1 / 4.1.2
- **Severity:** Critical
- **Lines:** 498, 507

**Current code:**
```tsx
<Textarea value={repostText} onChange={(event) => setRepostText(event.target.value)} placeholder={t('post.repost_comment')} />
<Textarea value={editText} onChange={(event) => setEditText(event.target.value)} />
```

**Recommended fix:**
```tsx
<Textarea
  id="repost-comment"
  aria-label={t('post.repost_comment')}
  value={repostText}
  onChange={(event) => setRepostText(event.target.value)}
  placeholder={t('post.repost_comment')}
/>
<Textarea
  id="edit-text"
  aria-label={t('post.edit_label')}
  value={editText}
  onChange={(event) => setEditText(event.target.value)}
/>
```

---

## 7. PostComposer.tsx — Form & Media Issues

### 7.1 Poll Result Select Missing Label
- **WCAG Criterion:** 4.1.2
- **Severity:** Critical
- **Lines:** 428

**Current code:**
```tsx
<Select value={pollResults} onChange={(event) => setPollResults(event.target.value as 'always' | 'after_vote')}>
  <option value="after_vote">{t('post_composer.poll_results_after')}</option>
  <option value="always">{t('post_composer.poll_results_now')}</option>
</Select>
```

**Recommended fix:**
```tsx
<label htmlFor="poll-results">{t('post_composer.poll_results_label')}</label>
<Select id="poll-results" value={pollResults} onChange={...}>
  {/* ... */}
</Select>
```

---

### 7.2 Community Select Missing Label
- **WCAG Criterion:** 4.1.2
- **Severity:** Critical
- **Lines:** 439

**Current code:**
```tsx
<Select value={selectedCommunity} onChange={(event) => setSelectedCommunity(event.target.value)} className="w-auto min-w-40 !h-9 !text-xs">
  <option value="">{t('post_composer.no_community')}</option>
  {/* ... */}
</Select>
```

**Recommended fix:**
```tsx
<label htmlFor="composer-community" className="sr-only">{t('post_composer.community_label')}</label>
<Select id="composer-community" value={selectedCommunity} onChange={...}>
  {/* ... */}
</Select>
```

---

### 7.3 Preview Videos Missing Captions
- **WCAG Criterion:** 1.2.2 Captions (Prerecorded)
- **Severity:** Critical
- **Lines:** 354, 658

**Current code:**
```tsx
<video src={item.url} controls className="max-h-72 w-full bg-black" />
<video src={item.url} className="h-28 w-full object-cover" muted />
```

**Problem:** No `<track kind="captions">` provided. For user-generated content this is hard, but the UI should at least prompt users or mark videos as lacking captions.

**Recommended fix:** Display a warning badge and allow caption upload:
```tsx
<video src={item.url} controls className="max-h-72 w-full bg-black">
  {item.captionSrc && <track kind="captions" src={item.captionSrc} srclang="ru" label="Russian" />}
</video>
{!item.captionSrc && <span className="text-xs text-amber-600" role="note">No captions</span>}
```

---

## 8. shared/ui/index.tsx — Core UI Kit Issues

### 8.1 Dropdown Trigger `<div>` with onClick
- **WCAG Criterion:** 2.1.1 Keyboard
- **Severity:** Critical
- **Lines:** 167

**Current code:**
```tsx
<div onClick={() => setOpen((value) => !value)}>{trigger}</div>
```

**Problem:** The wrapper `<div>` intercepts clicks but is not focusable. If `trigger` is not a native interactive element, the entire dropdown becomes inaccessible.

**Recommended fix:** Ensure the trigger is cloned with interactive props, or wrap in a button:
```tsx
<button
  type="button"
  onClick={() => setOpen((value) => !value)}
  aria-haspopup="menu"
  aria-expanded={open}
  className="contents"
>
  {trigger}
</button>
```

---

### 8.2 Checkbox Component Missing Fieldset
- **WCAG Criterion:** 1.3.1 Info and Relationships
- **Severity:** Serious
- **Lines:** 107–114

**Current code:**
```tsx
export function Checkbox({ label, className, ...props }: ...) {
  return (
    <label className={cn('inline-flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-zinc-300', className)}>
      <input type="checkbox" {...props} className="h-4 w-4 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00]" />
      {label ? <span>{label}</span> : null}
    </label>
  );
}
```

**Problem:** Individual checkboxes are correctly labeled, but when multiple checkboxes form a group, they must be wrapped in `<fieldset>` with `<legend>`.

**Recommended fix (consumer-side):**
```tsx
<fieldset>
  <legend className="sr-only">Notification preferences</legend>
  <Checkbox label="Email" ... />
  <Checkbox label="Push" ... />
</fieldset>
```

---

### 8.3 Avatar `<img>` with Empty Alt for Informative Images
- **WCAG Criterion:** 1.1.1 Non-text Content
- **Severity:** Serious
- **Lines:** 131–137

**Current code:**
```tsx
<div className={cn('flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-orange-100 font-black text-[#FF6B00]', className)}>
  {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name || '?').charAt(0)}
</div>
```

**Problem:** The `alt=""` marks the image as decorative. However, in contexts like user profiles, notification lists, and community cards, avatars are often the only visual identifier. Screen reader users get no information about the user.

**Recommended fix:**
```tsx
<div className="..." role="img" aria-label={name ? `${name}'s avatar` : 'Default avatar'}>
  {src ? (
    <img src={src} alt="" className="..." />
  ) : (
    <span aria-hidden="true">{(name || '?').charAt(0)}</span>
  )}
</div>
```

**Even better:** Make the parent `<Link>` or `<button>` carry the user name so the avatar can remain decorative.

---

### 8.4 Modal `<h2>` Without Page-Level `<h1>`
- **WCAG Criterion:** 1.3.1
- **Severity:** Serious
- **Lines:** 234

**Current code:**
```tsx
<h2 className="text-lg font-black">{title}</h2>
```

**Problem:** Inside a modal dialog, the title should be the first heading. Since this is a modal (not the full page), an `<h2>` is acceptable **if** the page behind it has an `<h1>`. However, many pages lack `<h1>` entirely (see Landmark issues).

**Recommended fix:** If the calling page lacks an `<h1>`, the modal should use `aria-labelledby` pointing to its title:
```tsx
<section ref={modalRef} className="..." aria-labelledby="modal-title">
  <header className="...">
    <h2 id="modal-title" className="text-lg font-black">{title}</h2>
    {/* ... */}
  </header>
</section>
```

---

### 8.5 Switch Component Is a `<button>` Without `role="switch"`
- **WCAG Criterion:** 4.1.2 Name, Role, Value
- **Severity:** Moderate
- **Lines:** 116–125

**Current code:**
```tsx
export function Switch({ checked, onChange, label }: ...) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="...">
      <span className={cn('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-[#FF6B00]' : 'bg-gray-300')}>
        <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  );
}
```

**Problem:** The component visually looks like a toggle switch but uses `<button>` without `role="switch"` and without `aria-checked`. Screen readers announce it as a generic button.

**Recommended fix:**
```tsx
<button
  type="button"
  role="switch"
  aria-checked={checked}
  onClick={() => onChange(!checked)}
  className="..."
>
  <span className="sr-only">{label}</span>
  <span aria-hidden="true" className={cn('...', checked ? 'bg-[#FF6B00]' : 'bg-gray-300')}>
    <span className={cn('...', checked ? 'translate-x-6' : 'translate-x-1')} />
  </span>
</button>
```

---

### 8.6 Toast Notifications Missing `role` and `aria-live`
- **WCAG Criterion:** 4.1.3 Status Messages
- **Severity:** Moderate
- **Lines:** 304–317

**Current code:**
```tsx
<button
  key={item.id}
  onClick={() => dismiss(item.id)}
  className={cn(...)}
>
  {item.tone === 'success' ? <Check size={16} className="text-green-600" /> : null}
  {item.title}
</button>
```

**Problem:** Toasts are status messages. They should use `role="status"` (or `role="alert"` for errors) and be wrapped in an `aria-live` region.

**Recommended fix:**
```tsx
<div className="fixed right-4 top-4 z-[120] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" role="region" aria-label="Notifications">
  {items.map((item) => (
    <div
      key={item.id}
      role={item.tone === 'error' ? 'alert' : 'status'}
      aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
      className="..."
    >
      <button onClick={() => dismiss(item.id)} aria-label={`Dismiss ${item.title}`}>
        {/* content */}
      </button>
    </div>
  ))}
</div>
```

---

## 9. MemeEditor.tsx — Canvas Accessibility

### 9.1 Canvas Is Completely Inaccessible to Screen Readers
- **WCAG Criterion:** 1.1.1 Non-text Content / 2.1.1 Keyboard
- **Severity:** Critical
- **Lines:** 252–266

**Current code:**
```tsx
<canvas
  ref={canvasRef}
  width={canvasSize.w}
  height={canvasSize.h}
  className="w-full cursor-crosshair"
  style={{ touchAction: 'none' }}
  onMouseDown={handleDown}
  onMouseMove={handleMove}
  onMouseUp={handleUp}
  onTouchStart={handleDown}
  onTouchMove={handleMove}
  onTouchEnd={handleUp}
/>
```

**Problem:** The canvas has no accessible fallback. Screen reader users cannot perceive the image, the text overlays, or their positions.

**Recommended fix:** Provide a text alternative and keyboard controls:
```tsx
<div>
  <canvas
    ref={canvasRef}
    width={canvasSize.w}
    height={canvasSize.h}
    className="w-full cursor-crosshair"
    style={{ touchAction: 'none' }}
    onMouseDown={handleDown}
    onMouseMove={handleMove}
    onMouseUp={handleUp}
    onTouchStart={handleDown}
    onTouchMove={handleMove}
    onTouchEnd={handleUp}
    aria-label="Meme editor canvas. Use the controls below to add and position text."
    role="img"
  />
  {/* Hidden text description for screen readers */}
  <div className="sr-only">
    <p>Base image: {image ? 'Loaded' : 'Not loaded'}</p>
    <ul>
      {overlays.map((o) => (
        <li key={o.id}>Text: "{o.text}" at position {Math.round(o.x)}, {Math.round(o.y)}</li>
      ))}
    </ul>
  </div>
</div>
```

---

### 9.2 Text Overlay Controls Lack Keyboard Navigation
- **WCAG Criterion:** 2.1.1 Keyboard
- **Severity:** Serious
- **Lines:** 293–392

**Problem:** All controls for moving text (mouse/touch drag) have no keyboard equivalent.

**Recommended fix:** Add arrow-key nudge buttons:
```tsx
<div className="flex gap-1">
  <button aria-label="Move text left" onClick={() => updateOverlay(selected.id, { x: selected.x - 5 })}>←</button>
  <button aria-label="Move text right" onClick={() => updateOverlay(selected.id, { x: selected.x + 5 })}>→</button>
  <button aria-label="Move text up" onClick={() => updateOverlay(selected.id, { y: selected.y - 5 })}>↑</button>
  <button aria-label="Move text down" onClick={() => updateOverlay(selected.id, { y: selected.y + 5 })}>↓</button>
</div>
```

---

### 9.3 Checkbox Group Missing `<fieldset>`
- **WCAG Criterion:** 1.3.1
- **Severity:** Serious
- **Lines:** 360–378

**Current code:**
```tsx
<label className="flex items-center gap-1.5 text-xs">
  <input type="checkbox" checked={selected.bold} onChange={...} className="accent-[#FF6B00]" />
  <span className="font-black">{t('meme_editor.bold')}</span>
</label>
<label className="flex items-center gap-1.5 text-xs">
  <input type="checkbox" checked={selected.outline} onChange={...} className="accent-[#FF6B00]" />
  <span className="font-black">{t('meme_editor.outline')}</span>
</label>
```

**Recommended fix:**
```tsx
<fieldset>
  <legend className="sr-only">Text style options</legend>
  <label className="...">{/* Bold */}</label>
  <label className="...">{/* Outline */}</label>
</fieldset>
```

---

## 10. ConfettiCelebration.tsx — Motion & Status

### 10.1 Confetti Animation Missing `prefers-reduced-motion` Handling
- **WCAG Criterion:** 2.2.2 Pause, Stop, Hide / 2.3.3 Animation from Interactions
- **Severity:** Moderate
- **Lines:** 15–28, 87–104

**Current code:**
```tsx
function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * 100,
    // ... constant motion
  }));
}
```

**Problem:** Users with vestibular disorders may be triggered by falling particle animations. There is no `@media (prefers-reduced-motion: reduce)` fallback.

**Recommended fix:**
```tsx
useEffect(() => {
  if (!active) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    setShowBanner(true);
    const timer = setTimeout(() => setShowBanner(false), 3500);
    return () => clearTimeout(timer);
  }

  // ... existing animation code
}, [active, animate]);
```

---

### 10.2 Achievement Banner Missing `role="status"`
- **WCAG Criterion:** 4.1.3 Status Messages
- **Severity:** Moderate
- **Lines:** 112–118

**Current code:**
```tsx
<div className="absolute inset-x-0 top-20 flex justify-center animate-in slide-in-from-top-8 fade-in duration-500">
  <div className="pointer-events-auto rounded-2xl border border-orange-200 bg-white/95 px-8 py-5 text-center shadow-2xl backdrop-blur dark:border-orange-900 dark:bg-zinc-950/95">
    <span className="mb-2 block text-3xl">🏆</span>
    <p className="text-lg font-black text-[#FF6B00]">{title}</p>
    {description && <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{description}</p>}
  </div>
</div>
```

**Recommended fix:**
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="absolute inset-x-0 top-20 flex justify-center ..."
>
  <div className="...">
    <span className="mb-2 block text-3xl" aria-hidden="true">🏆</span>
    <p className="text-lg font-black text-[#FF6B00]">{title}</p>
    {description && <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{description}</p>}
  </div>
</div>
```

---

## 11. Color Contrast Analysis

### 11.1 `text-gray-400` on White Background
- **WCAG Criterion:** 1.4.3 Contrast (Minimum)
- **Severity:** Serious
- **Occurrences:** 50+ across codebase

**Tailwind value:** `text-gray-400` ≈ `#9CA3AF` on `#FFFFFF`  
**Contrast ratio:** 2.72:1  
**Required (AA):** 4.5:1 for normal text, 3:1 for large/bold  
**Result:** Fails WCAG AA for normal text sizes

**Affected files/locations:**
- `AuthPages.tsx:30` — `<p className="mt-2 text-gray-500">` (3.54:1, passes for large text, borderline)
- `AuthPages.tsx:43` — `<p className="text-xs text-gray-500">` (3.54:1 — fails for small text)
- `SwipeInterestPicker.tsx:85` — `text-gray-400` instruction text (2.72:1 — fails)
- `PostCard.tsx:290` — username/timestamp `text-gray-400` (2.72:1 — fails)
- `Layout.tsx:182` — trend stats `text-gray-400` (2.72:1 — fails)
- `MemeEditor.tsx:303` — `text-gray-400` labels (2.72:1 — fails)

**Recommended fix:** Use `text-gray-600` (`#4B5563`, 6.61:1) for small/normal secondary text, or `text-gray-500` (`#6B7280`, 4.68:1) for bold/large text.

---

### 11.2 Orange Primary `#FF6B00` on White
- **WCAG Criterion:** 1.4.3
- **Severity:** Moderate

**Contrast ratio:** 3.24:1  
**Required:** 4.5:1 for normal text  
**Result:** Fails AA for normal text, passes for large/bold (18px+)

**Affected:**
- `AuthPages.tsx:27` — Logo background (white text on orange passes: 3.24:1 is sufficient for large bold)
- `AuthPages.tsx:172` — Step indicator `bg-[#FF6B00] text-white` (passes for large/bold)
- `PostCard.tsx:265` — Hashtags `text-[#FF6B00]` (3.24:1 — **fails for normal text**)

**Recommended fix for hashtags:**
```tsx
<Link className="font-black text-[#E55A00] hover:underline">  {/* Darker orange, 4.8:1 */}
  {part}
</Link>
```

---

### 11.3 Red/Green Color-Only Indicators in Onboarding
- **WCAG Criterion:** 1.4.1 Use of Color
- **Severity:** Serious
- **Lines:** `SwipeInterestPicker.tsx:106`

**Current code:**
```tsx
borderColor: dragX > 30 ? '#22c55e' : dragX < -30 ? '#ef4444' : '#e5e7eb',
```

**Problem:** The border color alone indicates like (green) vs skip (red). Colorblind users cannot distinguish this.

**Recommended fix:** Add text labels or icons that change:
```tsx
<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
  {dragX > 30 && <span className="text-green-600 font-black text-xl">LIKE</span>}
  {dragX < -30 && <span className="text-red-500 font-black text-xl">SKIP</span>}
</div>
```

---

## 12. Landmark & Page Structure Issues

### 12.1 Missing `<main>` Landmark
- **WCAG Criterion:** 1.3.1 Info and Relationships / 2.4.1 Bypass Blocks
- **Severity:** Serious
- **Affected:** Nearly all page components (49 files)

**Problem:** Many page components render directly into `<div>` without a `<main>` landmark. Screen reader users cannot jump to primary content.

**Current state in App.tsx:**
```tsx
return (
  <Providers>
    <BrowserRouter>
      <AppRouter theme={theme} setTheme={setThemeState} />
    </BrowserRouter>
  </Providers>
);
```

**Recommended fix for page wrappers:**

In `App.tsx` or `router.tsx`, wrap routed content in `<main>`:
```tsx
<main id="main-content" tabIndex={-1}>
  <AppRouter ... />
</main>
```

For individual page components that are NOT inside Layout:
```tsx
// ExplorePage.tsx, HashtagPage.tsx, etc.
<main id="main-content">
  {/* page content */}
</main>
```

---

### 12.2 Missing `<nav>` Landmark in AdminLayout
- **WCAG Criterion:** 1.3.1
- **Severity:** Moderate
- **Lines:** 82–109

**Current code:**
```tsx
<nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
```

**Assessment:** This is actually correct! The scanner incorrectly flagged this because it checks at file-level. `<nav>` is present on line 82. However, ensure `aria-label` distinguishes multiple navs:

**Recommended fix:**
```tsx
<nav aria-label="Admin navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
```

And in `Layout.tsx`:
```tsx
<nav aria-label="Main navigation" className="flex-1 space-y-1 px-3" ...>
```

---

### 12.3 Skip Navigation Link Present but Not First Focusable
- **WCAG Criterion:** 2.4.1 Bypass Blocks
- **Severity:** Serious
- **Lines:** `index.css:147–164` defines `.skip-link`, `Layout.tsx:90` uses it

**Current code in Layout.tsx:**
```tsx
<a href="#main-content" className="skip-link">{t('layout.skip_to_content')}</a>
```

**Assessment:** Good implementation with CSS `translateY(-150%)` and `focus-visible`. Ensure it is the **first** focusable element in the DOM order. In `Layout.tsx` it appears after the `<div>` wrapper but before `<aside>`, which is correct. Verify `AdminLayout.tsx` also has one:

**Recommended fix for AdminLayout.tsx:**
```tsx
<div className="min-h-screen bg-gradient-to-br ...">
  <a href="#main-content" className="skip-link">{t('layout.skip_to_content')}</a>
  <div className="flex">
    {/* ... */}
    <main id="main-content" className="min-h-screen min-w-0 flex-1 pt-14 sm:pt-0">{children}</main>
  </div>
</div>
```

---

## 13. Keyboard Navigation Issues

### 13.1 Clickable Overlays Without Keyboard Escape
- **WCAG Criterion:** 2.1.1 Keyboard / 2.4.3 Focus Order
- **Severity:** Critical
- **Files:** `AdminLayout.tsx:36`, `Layout.tsx:341`, `ReactionPicker.tsx:87`

**Pattern:**
```tsx
<div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
```

**Recommended fix (apply to all three):**
```tsx
<button
  className="fixed inset-0 z-40 cursor-default bg-black/20"
  onClick={() => setOpen(false)}
  aria-label="Close overlay"
  tabIndex={-1}
/>
```

Or add `Escape` key listener to the component:
```tsx
useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };
  if (open) window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, [open]);
```

---

### 13.2 Autofocus on PostComposer Disorients Screen Readers
- **WCAG Criterion:** 3.2.1 On Focus
- **Severity:** Moderate
- **Lines:** `HomePage.tsx:159`

**Current code:**
```tsx
<PostComposer defaultExpanded={shouldOpenComposer} autoFocus={shouldOpenComposer} />
```

**Problem:** Programmatic focus shifts without user initiation can confuse screen reader users. The `autoFocus` prop triggers `textareaRef.current?.focus()` inside PostComposer.

**Recommended fix:** Only autofocus when triggered by a user action (e.g., clicking "New Post"), not on page load:
```tsx
// In PostComposer.tsx
useEffect(() => {
  if (autoFocus && open && textareaRef.current) {
    textareaRef.current.focus();
  }
}, [autoFocus, open]); // Only when explicitly opened by user action
```

---

## 14. Media Issues

### 14.1 Video Elements Without Captions
- **WCAG Criterion:** 1.2.2 Captions (Prerecorded) / 1.2.3 Audio Description or Media Alternative
- **Severity:** Critical
- **Lines:** `MessagesPage.tsx:354`, `PostComposer.tsx:354,658`, `shared/ui/index.tsx:482,499`

**Current code:**
```tsx
<video src={item.url} className="h-full w-full object-cover" muted />
<video src={url} className="max-h-[520px] w-full bg-black" controls muted playsInline preload="metadata" />
```

**Problem:** No `<track kind="captions">` elements. For a social media platform, this is a significant barrier for Deaf/hard-of-hearing users.

**Recommended fix (immediate):** Add UI prompting for captions and a "CC missing" indicator:
```tsx
<figure>
  <video controls>
    <source src={url} />
    {/* Future: <track kind="captions" src={captionUrl} srclang="ru" label="Russian" /> */}
  </video>
  <figcaption className="text-xs text-gray-500">
    <span aria-label="No captions available">🚫 CC</span>
  </figcaption>
</figure>
```

**Long-term:** Implement caption upload in the composer.

---

## 15. Recommended Fix Priority Matrix

| Priority | Issue | Files | Effort | Impact |
|----------|-------|-------|--------|--------|
| **P0** | Add `aria-label` to all unlabeled inputs/textareas/selects | AuthPages, PostCard, PostComposer, CommunitiesPage, MessagesPage, SavedPage, AdminPage | Low | Critical — blocks form completion for screen reader users |
| **P0** | Fix keyboard-dismissible overlays | AdminLayout, Layout, ReactionPicker | Low | Critical — keyboard traps |
| **P0** | Add accessible names to ReactionPicker emoji buttons | ReactionPicker.tsx | Low | Critical — core interaction |
| **P1** | Add `<main>` and `<nav>` landmarks to all pages | All page components | Medium | Serious — navigation for screen reader users |
| **P1** | Fix empty `alt` on informative images | Avatar, PostCard, CommunitiesPage, ProfilePage | Medium | Serious — missing image context |
| **P1** | Add `aria-pressed` to toggle buttons | PostCard likes/saves, AuthPages community select, ReactionPicker chips | Low | Moderate — state communication |
| **P2** | Improve color contrast (`text-gray-400` → `text-gray-600`) | Global | Medium | Serious — readability |
| **P2** | Add `role="switch"` and `aria-checked` to Switch | shared/ui/index.tsx | Low | Moderate — correct semantics |
| **P2** | Add reduced-motion support | ConfettiCelebration, SwipeInterestPicker | Low | Moderate — vestibular safety |
| **P3** | Add caption upload/track support | PostComposer, MediaViewer | High | Critical — but high effort |
| **P3** | Add keyboard controls to MemeEditor canvas | MemeEditor.tsx | Medium | Serious — makes feature usable |
| **P3** | Wrap checkbox groups in `<fieldset>` | MemeEditor, SettingsPage, shared/ui | Low | Moderate — group semantics |

---

## Appendix A: Quick Reference — Form Label Fixes

For every unlabeled input found by the scanner, apply this pattern:

**Before:**
```tsx
<Input placeholder="Search" value={q} onChange={...} />
```

**After (minimum — AA):**
```tsx
<Input aria-label="Search communities" placeholder="Search" value={q} onChange={...} />
```

**After (best — AAA):**
```tsx
<label htmlFor="search-communities" className="text-sm font-bold">Search</label>
<Input id="search-communities" placeholder="Search" value={q} onChange={...} />
```

---

## Appendix B: WCAG 2.1 Mapping

| WCAG Criterion | Count | Severity |
|----------------|-------|----------|
| 1.1.1 Non-text Content | 12 | Serious |
| 1.2.2 Captions (Prerecorded) | 6 | Critical |
| 1.3.1 Info and Relationships | 141 | Serious/Moderate |
| 1.4.1 Use of Color | 3 | Serious |
| 1.4.3 Contrast (Minimum) | 50+ | Serious |
| 2.1.1 Keyboard | 6 | Critical |
| 2.4.1 Bypass Blocks | 49 | Serious |
| 2.4.3 Focus Order | 3 | Critical |
| 3.2.1 On Focus | 1 | Moderate |
| 4.1.2 Name, Role, Value | 44 | Critical |
| 4.1.3 Status Messages | 4 | Moderate |

---

*Report generated by automated scan (a11y_scanner.py) + manual code review.*
