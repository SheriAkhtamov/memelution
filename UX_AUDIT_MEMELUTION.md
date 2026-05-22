# UX Audit: Memelution Frontend

> **Scope:** `/Users/sheri/Projects Sheri/Our/Memelution/frontend/src`  
> **Date:** 2026-05-23  
> **Auditor:** OpenCode AI Agent  
> **Method:** Static code analysis + heuristic evaluation (Nielsen/10 heuristics + Mobile UX + Conversion UX)

---

## 1. Executive Summary

Memelution — это современный мем-социал с хорошей мобильной адаптацией, Tinder-style onboarding, canvas-based meme-редактором и продвинутой системой взаимодействий с постами. **Общий UX score: 7.2 / 10**.

**Главные сильные стороны:**
- Продуманный onboarding flow со swipe-выбором интересов и fallback-кнопками для desktop
- PostComposer с draft persistence, hashtag autocomplete, media drag&drop, preview и character counter
- Мобильная адаптация: pull-to-refresh, swipe между табами, bottom nav, floating action button
- Обширная система feedback: toast notifications, pulse-анимации, confetti для achievements
- Accessibility в модалках (focus trap, Escape, aria-labels)

**Критические проблемы (блокеры):**
1. **Delete без подтверждения** — комментарии удаляются мгновенно по клику на Trash2
2. **Нет Error Boundary** — runtime ошибки рендера ломают всё приложение
3. **MemeEditor без undo/redo** — пользователь теряет работу при ошибочном действии
4. **Отсутствие optimistic updates** — like/send message/comment требуют серверного round-trip
5. **Нет глобального loading состояния** — при инициализации приложения показывается только текст "Loading..."

---

## 2. Navigation Architecture

### 2.1 Router Analysis (`app/router.tsx`)

```
/                           → HomePage (feed)
/explore                    → ExplorePage
/post/:id                   → PostPage
/user/:username             → ProfilePage
/communities                → CommunitiesPage
/communities/new            → CreateCommunityPage
/communities/:slug          → CommunityPage
/search                     → SearchPage
/hashtag/:name              → HashtagPage
/messages                   → MessagesPage
/notifications              → NotificationsPage
/saved                      → SavedPage
/settings                   → SettingsPage
/login                      → LoginPage (standalone)
/auth/callback              → AuthCallbackPage
/admin/*                    → AdminLayout
```

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Lazy registration** | ✅ Отлично | Можно смотреть feed, explore, search, посты без onboarding |
| **Onboarding gating** | ⚠️ Хорошо | Только для sensitive actions (/messages, /notifications, /saved, /settings, /communities/new) — логично |
| **Deep linking** | ✅ Хорошо | Параметры сохраняются (/?compose=1, /messages?chat=ID) |
| **404 page** | ⚠️ Средне | Просто текст "Page not found", нет ссылки на home или search |
| **Protected routes** | ⚠️ Средне | Нет явного `<RequireAuth>` wrapper — логика внутри компонентов дублируется |
| **Breadcrumbs** | ❌ Нет | Нигде нет хлебных крошек, хотя depth бывает > 2 (communities → slug) |

### 2.2 Layout & Information Architecture (`app/Layout.tsx`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Skip link** | ✅ Отлично | Есть `<a href="#main-content">` для screen readers |
| **Desktop sidebar** | ✅ Отлично | Sticky, 64px (sm) / 256px (xl), clear active states с оранжевым accent |
| **Mobile bottom nav** | ✅ Хорошо | 5-tab layout, floating + button по центру, safe-area-inset-bottom |
| **FAB desktop/tablet** | ✅ Хорошо | Fixed bottom-right для быстрого создания поста |
| **Notification bell** | ✅ Отлично | Dropdown + full-screen mobile sheet, unread badge, auto-mark-read |
| **Trending sidebar** | ✅ Хорошо | Hashtags, rising posts, active communities — хорошая discoverability |
| **Search accessibility** | ⚠️ Средне | Search icon ведёт на /search, но нет inline search в header |

**Проблемы навигации:**
- **P0** Нет Error Boundary — runtime error в любом компоненте сломает всё приложение (white screen)
- **P2** На mobile нет "back button" в посте — только системный back
- **P2** При прямом переходе на /messages?chat=ID sidebar не показывает active state для Messages

---

## 3. Onboarding Flow Analysis

### 3.1 SwipeInterestPicker (`features/onboarding/SwipeInterestPicker.tsx`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Tinder-style swipe** | ✅ Отлично | Touch + mouse drag, визуальная обратная связь (border color, rotate, opacity) |
| **Like/Dislike labels** | ✅ Отлично | "LIKE"/"PASS" overlay при drag > 30px с opacity fade |
| **Desktop fallback** | ✅ Отлично | Кнопки ✕ / ♥ для desktop users без touch |
| **Progress indicator** | ✅ Хорошо | `currentIndex + 1 / options.length` |
| **Completion state** | ✅ Хорошо | Показывает summary выбранных интересов с emoji |
| **Haptic feedback** | ❌ Нет | Нет `hapticTap()` при swipe в отличие от PostCard like |
| **Undo** | ❌ Нет | Нельзя отменить skip — если промахнулись, придётся перезагрузить |
| **Keyboard navigation** | ❌ Нет | Нет стрелок Left/Right для accessibility |

### 3.2 OnboardingPage (`pages/auth/AuthPages.tsx`)

**3-шаговый wizard:** Interests → Communities → Profile

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Step indicator** | ✅ Хорошо | 3 tabs с clear active state (оранжевый) |
| **Step validation** | ⚠️ Средне | Interests required (disabled Next при 0), но Communities можно skip |
| **Communities loading** | ⚠️ Средне | `animate-pulse` плейсхолдеры вместо skeleton cards |
| **Profile fields** | ⚠️ Средне | Username + Display Name + Avatar URL — avatar URL это просто текстовый input, нет upload |
| **Finish CTA** | ✅ Отлично | После onboarding редирект на `/?compose=1&onboarded=1` — сразу предлагает создать первый пост |
| **Error handling** | ⚠️ Средне | Ошибка показывается под кнопкой, но нет retry logic для submit |
| **Gamification hint** | ✅ Хорошо | Есть блок "Первый мем" с описанием что будет дальше |

**Критические проблемы onboarding:**
- **P1** Нельзя вернуться к пропущенному интересу — undo отсутствует
- **P1** Avatar URL требует manual paste — для нового пользователя это friction, нужен upload/file picker
- **P2** Нет tooltip/helper при первом входе в SwipeInterestPicker — не все поймут что нужно свайпать

---

## 4. Auth Flow Analysis

### 4.1 LoginPage

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Social login** | ✅ Отлично | Telegram OAuth с clear branding (#2AABEE) |
| **Redirect after login** | ✅ Отлично | `redirect_to` query param сохраняется и работает через `safeRedirectTo` |
| **Error display** | ✅ Хорошо | Login error banner в верхней части формы |
| **Loading state** | ⚠️ Средне | Нет loading state на кнопке "Continue with Telegram" (хотя это external link) |
| **Trust signals** | ⚠️ Средне | Нет privacy policy / terms ссылок |

### 4.2 AuthCallbackPage

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Token extraction** | ✅ Хорошо | Поддержка hash и query params |
| **Error handling** | ✅ Хорошо | "No token" и "Session failed" сообщения |
| **Loading UI** | ❌ Плохо | Только текстовое сообщение, нет spinner или progress |
| **Auto-navigate** | ✅ Хорошо | После checkAuth автоматический redirect |

### 4.3 AdminLoginPage

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Form validation** | ✅ Хорошо | Client-side required check |
| **Password field** | ✅ Хорошо | Type="password" |
| **Error display** | ✅ Хорошо | Inline error под input |
| **SEO** | ✅ Отлично | Noindex meta tag динамически добавляется |
| **Loading** | ✅ Хорошо | Кнопка в loading state при submit |

---

## 5. Content Creation Flow

### 5.1 PostComposer (`features/posts/components/PostComposer.tsx`)

**Score: 8.5 / 10 — одна из сильнейших частей продукта**

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Draft persistence** | ✅ Отлично | `localStorage` с debounce 500ms, восстанавливает text/tags/poll/community |
| **Character counter** | ✅ Отлично | Круговой SVG progress с color coding (orange → amber → red) |
| **Hashtag autocomplete** | ✅ Отлично | Trending hashtags suggestion при наборе |
| **Media handling** | ✅ Отлично | Drag&drop, paste from clipboard, replace file, 6 files max, 50MB limit |
| **File validation** | ✅ Хорошо | Type check (image/video mp4), size check, inline error |
| **Poll builder** | ✅ Отлично | 2-6 options, min validation, results visibility toggle |
| **Preview** | ✅ Отлично | Live preview поста перед публикацией |
| **Visibility toggle** | ✅ Хорошо | Public / Followers / Private с иконками |
| **Meme editor** | ✅ Отлично | Интеграция с MemeEditor через modal |
| **Success state** | ✅ Отлично | "Пост опубликован" с кнопками "Открыть пост", "Создать ещё" |
| **Close confirm** | ✅ Отлично | Если есть draft, показывается ConfirmDialog |
| **Publishing progress** | ✅ Хорошо | Animated gradient progress bar + "Публикуем..." text |
| **Keyboard shortcuts** | ❌ Нет | Нет Ctrl+Enter для публикации |
| **Undo** | ❌ Нет | Нет undo после удаления media файла |
| **Accessibility** | ⚠️ Средне | Нет aria-live для error сообщений |

### 5.2 MemeEditor (`features/meme-editor/MemeEditor.tsx`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Canvas rendering** | ✅ Отлично | Checkerboard background, selection indicator (dashed blue) |
| **Text overlays** | ✅ Хорошо | Drag & drop (mouse + touch), font/size/color/rotation/bold/outline |
| **Export** | ✅ Хорошо | Full resolution PNG export |
| **Font preview** | ✅ Хорошо | Кнопки шрифтов отображаются своим шрифтом |
| **Undo/Redo** | ❌ Критично | **Отсутствует** — пользователь теряет всю работу при случайном сбросе |
| **Keyboard shortcuts** | ❌ Нет | Delete для удаления выделенного текста, Ctrl+Z |
| **Image zoom/pan** | ❌ Нет | Нельзя zoom/pan изображение — проблема для large images |
| **Multi-select** | ❌ Нет | Нельзя выделить несколько текстовых блоков |
| **Layer management** | ❌ Нет | Нет z-index / bring to front / send to back |
| **Templates** | ❌ Нет | Нет готовых meme templates |

**P0 Recommendation:** Добавить `Ctrl+Z / Ctrl+Shift+Z` undo/redo stack для MemeEditor. Это критично для creative tool.

---

## 6. Social Interactions

### 6.1 PostCard (`features/posts/components/PostCard.tsx`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Double-tap like** | ✅ Отлично | Heart animation с позиционированием по координатам tap |
| **Haptic feedback** | ✅ Отлично | `hapticTap()` на like |
| **Pulse animations** | ✅ Хорошо | Like, save, repost buttons имеют scale pulse feedback |
| **Dropdown actions** | ✅ Отлично | 10+ actions: edit, pin, stats, save, copy, send, not interested, hide, open author, report |
| **Share** | ✅ Отлично | Native Web Share API → fallback Telegram share |
| **Poll voting** | ✅ Отлично | Optimistic update с percentage bars |
| **Analytics** | ✅ Отлично | `trackEvent` на like, save, share, view |
| **Edit post** | ✅ Хорошо | Modal с textarea + comments on/off toggle |
| **Report** | ✅ Хорошо | Modal с reason + description |
| **Stats** | ✅ Хорошо | Grid с likes, comments, reposts, saves |
| **Save to collection** | ✅ Хорошо | Создание новой коллекции inline |
| **Loading states** | ❌ Нет | Action buttons не показывают loading state (только mutation pending внутри) |
| **Undo** | ❌ Нет | Нет undo для hide/delete/unrepost |
| **Keyboard nav** | ❌ Нет | Нет Enter для like, R для repost и т.д. |

### 6.2 CommentItem (`features/comments/CommentItem.tsx`)

**Критичные проблемы:**

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Threading** | ✅ Отлично | Recursive replies, collapse/expand, click-to-hide thread line |
| **Edit inline** | ✅ Хорошо | Textarea с Save/Cancel buttons |
| **Quick reactions** | ✅ Хорошо | Ха/Огонь/+1 buttons (но они только local state, не отправляются на сервер!) |
| **Like** | ✅ Хорошо | Heart button с pulse animation |
| **Reply** | ✅ Хорошо | onReply callback для parent component |
| **Delete** | ❌ **Критично** | **Нет ConfirmDialog!** Прямой вызов `remove.mutate()` по клику — мгновенное удаление |
| **Loading** | ❌ Плохо | Нет loading state для edit/delete/like кнопок |
| **Optimistic updates** | ❌ Плохо | Like требует round-trip |
| **Undo** | ❌ Нет | Нет undo для delete/edit |

**P0 Fix:** Обернуть `remove.mutate()` в `ConfirmDialog`.

---

## 7. Messaging Flow (`pages/messages/MessagesPage.tsx` + `useMessages.ts`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Layout** | ✅ Отлично | Desktop: sidebar + chat. Mobile: fullscreen transition |
| **Draft persistence** | ✅ Отлично | Per-chat drafts в localStorage |
| **Typing indicators** | ✅ Отлично | WebSocket-based, timeout 2200ms |
| **Unread divider** | ✅ Отлично | Blue line с "X unread" между прочитанными и новыми |
| **Reply to message** | ✅ Отлично | Reply preview над input |
| **Edit message** | ✅ Хорошо | Inline editing (но нет history/edited indicator в UI) |
| **Forward message** | ✅ Хорошо | Modal с поиском чатов |
| **Media upload** | ✅ Хорошо | File picker в input area |
| **Chat info modal** | ✅ Хорошо | Members list + shared media grid + leave button |
| **Search chats** | ✅ Хорошо | Filter по name/username/latest message |
| **Tabs** | ✅ Хорошо | All / Unread / Groups |
| **Real-time** | ✅ Отлично | WebSocket с auto-reconnect на уровне hook |
| **Scroll to bottom** | ✅ Хорошо | Auto-scroll на новые сообщения |
| **Create chat** | ⚠️ Средне | Только по @username — нет поиска по существующим users |
| **Emoji picker** | ❌ Нет | Нет emoji picker в message input |
| **Voice messages** | ❌ Нет | Нет voice recording |
| **Message reactions** | ❌ Нет | Нет emoji reactions на сообщения |
| **Optimistic send** | ❌ Нет | Сообщение появляется только после ответа сервера |
| **Send failure** | ❌ Плохо | Нет "failed to send" indicator или retry для конкретного сообщения |
| **Read receipts** | ❌ Нет | Нет галочек "прочитано" |

---

## 8. Search & Discovery (`pages/search/SearchPage.tsx`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Debounced search** | ✅ Отлично | 400ms delay, staleTime 30s |
| **Search history** | ✅ Отлично | LocalStorage, 8 items, clear all button |
| **Autocomplete** | ✅ Хорошо | API autocomplete + local history merge |
| **Tabs** | ✅ Отлично | 7 tabs: all/posts/people/communities/hashtags/media/video |
| **Empty state** | ✅ Отлично | Trending queries + recent searches |
| **Highlight** | ✅ Хорошо | Matching text highlighted with orange `<mark>` |
| **Error state** | ✅ Хорошо | ErrorState с retry button |
| **Skeleton** | ✅ Хорошо | Single skeleton block во время загрузки |
| **Filter persistence** | ✅ Хорошо | URL query params для type и q |
| **Keyboard** | ⚠️ Средне | Escape очищает поиск — хорошо, но нет Enter для submit (debounce only) |
| **No results help** | ⚠️ Средне | Только "Not found" empty state — нет "Did you mean?" или related queries |

---

## 9. Feed & Home (`pages/home/HomePage.tsx` + `useFeed.ts`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Feed tabs** | ✅ Отлично | 9 tabs с persistence в localStorage и URL |
| **Swipe tabs** | ✅ Отлично | SwipeContainer для mobile swipe left/right |
| **Infinite scroll** | ✅ Отлично | IntersectionObserver sentinel |
| **Pull-to-refresh** | ✅ Отлично | Mobile touch gesture с arrow rotation |
| **New posts indicator** | ✅ Отлично | Sticky button "Load X new posts" — не ломает scroll position |
| **Scroll position** | ✅ Отлично | Zustand store сохраняет позицию per tab |
| **Feed skeleton** | ✅ Отлично | 3 skeleton cards с aria-label |
| **Back to top** | ✅ Хорошо | Floating button после 600px scroll |
| **Empty state** | ✅ Хорошо | CTA "Опубликовать мем" + "Обновить" |
| **Error state** | ✅ Хорошо | ErrorState с retry |
| **Post creation** | ✅ Отлично | Inline composer + FAB + ?compose=1 trigger |
| **Feed update** | ✅ Отлично | Background polling каждые 45s для new posts detection |
| **Sticky header** | ✅ Хорошо | Tabs и title sticky с backdrop-blur |

---

## 10. Notifications (`pages/notifications/NotificationsPage.tsx`)

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Type filters** | ✅ Отлично | 7 фильтров с URL persistence |
| **Grouping** | ✅ Отлично | Новые + группировка по датам (Today/Yesterday/Week/Month/Earlier) |
| **Read/unread** | ✅ Отлично | Визуальная разница (border + bg color + opacity) |
| **Mark read** | ✅ Отлично | Per-item и Mark All Read |
| **Gamification** | ✅ Отлично | XP progress bar с level indicator |
| **Empty state** | ✅ Хорошо | BellOff icon + description |
| **Real-time** | ✅ Отлично | WebSocket + refetch every 30s |
| **Mobile sheet** | ✅ Отлично | Full-screen overlay для mobile notifications |
| **Delete/archive** | ❌ Нет | Нельзя удалить или заархивировать уведомление |
| **Bulk select** | ❌ Нет | Нельзя выбрать несколько и mark read/delete |
| **Notification settings** | ❌ Нет | Нет mute/pause управления |

---

## 11. Loading, Error & Empty States Inventory

### 11.1 Skeleton Loaders ✅

| Компонент | Тип | Оценка |
|-----------|-----|--------|
| HomePage feed | 3 skeleton cards (avatar + text + image) | ✅ Отлично |
| SearchPage | Single block skeleton | ✅ Хорошо |
| MessagesPage (chats list) | Single skeleton block | ⚠️ Средне |
| MessagesPage (messages) | Single skeleton block | ⚠️ Средне |
| NotificationsPage | Single skeleton block | ⚠️ Средне |
| CommunitiesPage (onboarding) | 4 pulse blocks | ⚠️ Средне |
| Chat info modal | Single skeleton block | ⚠️ Средне |
| Right sidebar trends | 3 skeleton blocks | ✅ Хорошо |

### 11.2 Error States ✅

| Компонент | Обработка | Оценка |
|-----------|-----------|--------|
| HomePage | ErrorState с retry | ✅ |
| SearchPage | ErrorState с retry | ✅ |
| MessagesPage | ErrorState с retry | ✅ |
| NotificationsPage | ErrorState с retry | ✅ |
| SavedPage | ErrorState с retry | ✅ |
| HashtagPage | ErrorState с retry | ✅ |
| CommunitiesPage | ErrorState с retry | ✅ |
| PostComposer | Inline text error + toast | ✅ |
| AuthCallback | Текстовое сообщение | ⚠️ |

### 11.3 Empty States ✅

| Компонент | Empty State | Оценка |
|-----------|-------------|--------|
| HomePage | Flame icon + CTA buttons | ✅ |
| SearchPage | SearchX icon + trending | ✅ |
| MessagesPage | Chat bubble emoji + description | ✅ |
| NotificationsPage | BellOff icon | ✅ |
| SavedPage | Bookmark icon | ✅ |
| PostComposer (no media) | — | N/A |

### 11.4 Toast Notifications ✅ (`shared/ui/index.tsx`)

- **Duration:** 4.2s с fade-out animation
- **Types:** success (green check), error (red border), info (default)
- **Position:** Top-right fixed
- **Dismissible:** Click to dismiss
- **Max:** Нет лимита, может переполниться при batch actions

### 11.5 Error Boundaries ❌

**Проблема:** В проекте **нет React Error Boundaries**. Runtime ошибки в любом компоненте приведут к white screen of death.

```
App.tsx → Providers → BrowserRouter → AppRouter → Layout → children
```

Нигде нет `<ErrorBoundary>` wrapper.

**P0 Fix:** Добавить `ErrorBoundary` на уровне:
1. Глобального (App.tsx) — fallback UI с "Something went wrong" + reload
2. Router level — per-route error boundaries
3. Feed level — чтобы ошибка в одном PostCard не ломала весь feed

---

## 12. Form Validation Analysis

| Форма | Client Validation | Server Error | UX |
|-------|-------------------|--------------|-----|
| Admin Login | Required fields | Inline error | ✅ Хорошо |
| Post Composer | Max text (500), max files (6/50MB), min poll options (2) | Inline + toast | ✅ Отлично |
| Onboarding (profile) | Required username/display_name | Inline error | ⚠️ Средне |
| Comment Edit | — | — | ⚠️ Нет validation (пустой комментарий?) |
| Message Send | Empty check | — | ✅ Хорошо |
| Search | — | — | N/A |
| Report | Required reason | — | ⚠️ Средне (description optional) |

---

## 13. Undo/Redo & Recovery Analysis

| Фича | Undo доступен? | Комментарий |
|------|----------------|-------------|
| Post delete | ❌ Нет | ConfirmDialog есть, но после confirm — безвозвратно |
| Comment delete | ❌ **Нет** | **P0: Нет даже ConfirmDialog** |
| Comment edit | ❌ Нет | Cancel button есть, но после Save — нет undo |
| Post edit | ❌ Нет | Cancel есть, после Save — история не хранится |
| Like | ✅ Косвенно | Можно unlike, но это не undo а toggle |
| Repost | ✅ Косвенно | Можно unrepost |
| Save | ✅ Косвенно | Можно unsave |
| Hide post | ❌ Нет | ConfirmDialog нет для hide |
| MemeEditor actions | ❌ **Нет** | **P0: Нет undo/redo stack** |
| Draft discard | ✅ Частично | Composer спрашивает при закрытии с draft |

---

## 14. User Journey Maps

### 14.1 New User Journey: First Visit → First Post

```
[Заходит на /]
    ↓
[Видит feed без логина] ← Lazy registration ✅
    ↓
[Кликает "Опубликовать" или FAB]
    ↓
[Редирект на /login]
    ↓
[Telegram OAuth] ← Простой 1-click auth ✅
    ↓
[AuthCallback — "Completing login..."] ← Бедный loading UI ⚠️
    ↓
[Onboarding: Swipe Interests] ← Tinder-style, engaging ✅
    ↓
[Onboarding: Communities] ← Можно skip ✅
    ↓
[Onboarding: Profile] ← Avatar URL = friction ⚠️
    ↓
[/?compose=1&onboarded=1] ← Сразу composer открыт ✅
    ↓
[Создаёт пост / meme]
    ↓
[Публикация → Success state → "Открыть пост"]
```

**Friction points:**
1. AuthCallback loading слишком plain (текст вместо branded spinner)
2. Avatar URL input требует manual paste — лучше file upload
3. Нет "why am I doing this" explanation для onboarding steps
4. Нет tooltip "Swipe right to like, left to skip" при первом визите

### 14.2 Power User Journey: Scroll Feed → Like → Comment → Share

```
[Scroll feed]
    ↓
[Double tap / click heart] ← Haptic + pulse + heart animation ✅
    ↓
[Click comment] ← Переход на PostPage
    ↓
[Type comment → Enter] ← Нет Enter-to-submit ⚠️
    ↓
[Click share → Copy link / Telegram / Native share] ✅
    ↓
[Click bookmark → Save to collection / New collection] ✅
    ↓
[Click repost → Add comment → Publish] ✅
```

**Friction points:**
1. Comment input — нет Enter для submit (только кнопка)
2. Нет optimistic like — при медленном интернете кажется что ничего не произошло
3. Нет keyboard shortcuts для power users

### 14.3 Messaging Journey

```
[Click Messages в sidebar]
    ↓
[Видит список чатов, typing indicators, unread badges] ✅
    ↓
[Click chat или create new by username]
    ↓
[Type message → Enter to send] ✅ (Enter работает!)
    ↓
[Reply to specific message] ✅
    ↓
[Forward to another chat] ✅
    ↓
[Edit message inline] ✅
    ↓
[Leave chat] ← ConfirmDialog ✅
```

**Friction points:**
1. Нет optimistic send — сообщение "зависает" перед появлением
2. Нет read receipts — непонятно, прочитано ли
3. Нет emoji picker — приходится использовать системный
4. Create chat only by username — нет user search/suggestions

---

## 15. Issues Summary (Prioritized)

### 🔴 P0 — Critical (Fix Immediately)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 1 | **Comment delete без подтверждения** | `CommentItem.tsx:97` | Accidental data loss | Добавить `ConfirmDialog` перед `remove.mutate()` |
| 2 | **Нет Error Boundaries** | `App.tsx`, `router.tsx` | App crash → white screen | Добавить `<ErrorBoundary>` на App и route уровнях |
| 3 | **MemeEditor без undo/redo** | `MemeEditor.tsx` | Creative work loss | Добавить action history stack + `Ctrl+Z` |
| 4 | **AuthCallback loading UI** | `AuthPages.tsx:73` | Первое впечатление — plain text | Branded spinner с прогрессом шагов |
| 5 | **Comment quick reactions не отправляются** | `CommentItem.tsx:69-84` | UI обманывает пользователя | Либо убрать, либо подключить API |

### 🟡 P1 — High (Fix This Sprint)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 6 | **No optimistic updates** | `PostCard.tsx`, `CommentItem.tsx` | Sluggish perceived performance | Optimistic UI для like/comment/send |
| 7 | **No undo for swipe in onboarding** | `SwipeInterestPicker.tsx` | Can't recover from misswipe | Добавить "Undo last" button или back button |
| 8 | **Avatar URL input instead of upload** | `AuthPages.tsx:249` | Friction для новых users | File upload с preview |
| 9 | **No keyboard shortcut for publish** | `PostComposer.tsx` | Power user friction | `Ctrl+Enter` для submit |
| 10 | **No loading on action buttons** | `CommentItem.tsx`, `PostCard.tsx` | Double-click errors | `loading` prop на кнопках во время mutation |
| 11 | **No Enter to submit comment** | `PostPage.tsx` (inferred) | Comment UX friction | Enter to submit, Shift+Enter для новой строки |
| 12 | **Hide post без confirm** | `PostCard.tsx:335` | Accidental hide | Добавить `ConfirmDialog` |

### 🟢 P2 — Medium (Backlog)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 13 | **No emoji picker** | `MessagesPage.tsx`, `PostComposer.tsx` | Messaging UX | Add emoji picker component |
| 14 | **No read receipts in messages** | `MessagesPage.tsx` | Uncertainty | Add ✓✓ indicators |
| 15 | **No message reactions** | `MessagesPage.tsx` | Engagement | Add emoji reactions à la Telegram |
| 16 | **No voice messages** | `MessagesPage.tsx` | Communication friction | Add voice recording |
| 17 | **No "Did you mean?" in search** | `SearchPage.tsx` | Search UX | Add fuzzy suggestions |
| 18 | **No bulk actions in notifications** | `NotificationsPage.tsx` | Management friction | Bulk select + mark read/delete |
| 19 | **No notification settings** | `SettingsPage.tsx` | User control | Mute/pause per type |
| 20 | **No meme templates** | `MemeEditor.tsx` | Content creation friction | Popular templates gallery |
| 21 | **404 page too minimal** | `router.tsx:87-90` | UX dead end | Add home/search links |
| 22 | **No breadcrumb navigation** | `router.tsx` | Orientation loss | Breadcrumbs для communities/profile |

### 🔵 P3 — Low (Nice to Have)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| 23 | **MemeEditor: no zoom/pan** | `MemeEditor.tsx` | Large image editing | Add zoom slider / pan mode |
| 24 | **MemeEditor: no layer management** | `MemeEditor.tsx` | Complex memes | z-index controls |
| 25 | **No toast queue limit** | `shared/ui/index.tsx` | Toast spam | Max 3-5 visible toasts |
| 26 | **Pull-to-refresh only on Home** | `HomePage.tsx` | Inconsistent pattern | Add to Search/Notifications/Profile |
| 27 | **No offline actions queue** | `OfflineIndicator.tsx` | Offline UX | Queue actions для sync при reconnect |

---

## 16. Accessibility (a11y) Notes

| Критерий | Статус | Комментарий |
|----------|--------|-------------|
| Skip link | ✅ | Есть в Layout.tsx |
| Modal focus trap | ✅ | Реализован в Modal component |
| Modal Escape | ✅ | Закрытие по Escape |
| aria-labels на иконках | ✅ | IconButton, NavItem имеют aria-label |
| aria-current | ✅ | MobileLink имеет aria-current="page" |
| aria-expanded | ✅ | NotificationBell, MobileNotificationBell |
| aria-haspopup | ✅ | NotificationBell |
| aria-live для errors | ❌ | Нет live regions для toast/error |
| Focus visible | ✅ | Все кнопки имеют `focus-visible:ring` |
| Color contrast | ⚠️ | Gray-400 text на gray-100 bg может быть 3:1, нужна проверка |
| Screen reader (onboarding swipe) | ❌ | SwipeInterestPicker не доступен с клавиатуры |
| Reduced motion | ❌ | Нет `prefers-reduced-motion` обработки для pulse/confetti |

---

## 17. Recommendations Roadmap

### Week 1 (Critical Fixes)
1. Add `ConfirmDialog` to CommentItem delete
2. Add ErrorBoundary to App.tsx + route level
3. Add undo/redo to MemeEditor
4. Improve AuthCallback loading UI (spinner + steps)

### Week 2-3 (High Impact)
5. Implement optimistic updates for like/comment/message send
6. Add file upload for avatar in onboarding
7. Add `Ctrl+Enter` shortcut to PostComposer
8. Add loading states to all mutation buttons

### Month 2 (Polish)
9. Emoji picker для messages и composer
10. Read receipts в messages
11. Message reactions
12. Meme templates gallery
13. Bulk notification actions
14. Breadcrumbs для deep pages

---

## Appendix A: Component Checklist Matrix

| Feature | Skeleton | Empty State | Error State | Loading State | Toast | Confirm Dialog | Optimistic UI |
|---------|----------|-------------|-------------|---------------|-------|----------------|---------------|
| Feed | ✅ | ✅ | ✅ | ✅ (skeleton) | ❌ | N/A | ❌ |
| PostCard | N/A | N/A | N/A | ⚠️ (no button loading) | ✅ | ✅ (delete, hide) | ⚠️ (only poll) |
| PostComposer | N/A | N/A | ✅ | ✅ (progress bar) | ✅ | ✅ (close w/ draft) | ❌ |
| MemeEditor | N/A | N/A | N/A | ✅ (rendering) | ❌ | ❌ | N/A |
| CommentItem | N/A | N/A | N/A | ❌ | ❌ | ❌ | ❌ |
| Messages | ✅ | ✅ | ✅ | ❌ (send) | ✅ | ✅ (leave chat) | ❌ |
| Search | ✅ | ✅ | ✅ | ✅ (skeleton) | ❌ | N/A | N/A |
| Notifications | ✅ | ✅ | ✅ | ❌ | ❌ | N/A | N/A |
| Onboarding | ⚠️ (pulse) | ✅ | ✅ | ❌ | ❌ | N/A | N/A |
| Auth | ❌ | N/A | ✅ | ⚠️ (text only) | ❌ | N/A | N/A |

---

*End of report.*
