# FLOWSY — COMPLETE MOBILE FRONTEND REBUILD & EXPERIENCE IMPLEMENTATION MASTER PROMPT

> Paste this document into the coding-agent conversation together with `backend-frontend-integration-report.md` (the "Report"). Suggested repo location: `docs/flowsy-complete-frontend-rebuild-master-prompt.md`.
> Evidence labels used throughout: **[V]** = verified in the Report; **[H]** = design hypothesis (a decision, not a fact); **[U]** = unverified — check the repository/backend code before relying on it.

---

## 0. Operating Instructions for the Implementing Agent

You are a senior React Native / Expo engineer with strong product-design judgment. You will **replace the entire mobile frontend** of Flowsy with a new product experience specified below, and keep the NestJS backend and all financial behavior intact.

1. **Do not stop at a plan.** Work through all seven phases in §19 and finish with verified, running software. A design-system setup alone is not a deliverable.
2. **Inspect before you act.** Phase 1 (repository + contract audit) is mandatory. Where this document and the real code disagree about API behavior, the backend code wins and you report the discrepancy; where they disagree about UX, this document wins unless it is technically impossible.
3. **No invention.** Do not invent endpoints, fields, or backend behavior. Do not ship fake data, placeholder buttons, or mock responses in production flows. If something cannot be done with the existing backend, document the gap (§2.5) and use the safe fallback stated here.
4. **Every instruction here is testable.** If you cannot satisfy a requirement, say which one and why in your final report. Do not claim completion of anything you did not run and observe.
5. **Dependencies:** use what the repository already has. Add a dependency only with a written reason, after verifying compatibility with the installed Expo SDK and React Native version. Never prescribe a library from this document without first checking the repo.
6. **Language of the product:** the UI is **Arabic (Egyptian-friendly), RTL, Arabic-only in v1**. This document is in English; every user-facing string is Arabic (examples given in Arabic are the intended wording — you may polish phrasing, not meaning).

---

## 1. Product Purpose & Verified Capabilities

### 1.1 What Flowsy is
Flowsy is a personal-finance app for people who hold money in several places (cash, bank, mobile wallet, savings) and have recurring obligations (rent, internet, electricity). Its signature feature is **Safe-to-Spend — "تقدر تصرف كام؟"**: the amount a user can actually spend after their liquid funds are reduced by commitments due by month-end **[V]** (Report §7.4).

**Central promise [H]:** *"Know what you can really spend — and why."* Total balance is the wrong number to look at; Flowsy shows the number that already accounts for what you owe, and can explain it.

### 1.2 Verified capabilities (all **[V]**, Report §3–§4)

| Domain | Capability | Endpoint(s) |
|---|---|---|
| Auth | Register (auto-creates a "كاش / Cash" account), login, refresh-token rotation, logout (one session or all), me | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Profile | Read; update `displayName`, `currency`, `timezone` | `GET/PATCH /users/profile` |
| Accounts | List (optionally incl. archived), get, create (CASH/BANK/SAVINGS/MOBILE_WALLET, opening balance, `excludeFromSafeToSpend`), update (name, type, exclude flag, archive), delete only if unused | `/accounts`, `/accounts/:id` |
| Categories | List (system + custom, filter by INCOME/EXPENSE), get, create/update(name, icon, archive)/delete custom only | `/categories`, `/categories/:id` |
| Transactions | Create (INCOME/EXPENSE/TRANSFER), batch create (1–20, atomic), paginated list with filters (type, accountId, categoryId, startDate, endDate; page, limit ≤ 100), get, update (amount, categoryId, transactionDate, note only), delete (reverses balances) | `/transactions`, `/transactions/batch`, `/transactions/:id` |
| Commitments | List (filter by status), get, create, update, delete, **pay** (atomic; creates EXPENSE; schedules next occurrence if recurring) | `/commitments`, `/commitments/:id`, `/commitments/:id/pay` |
| Budgets | List with live `spent`/`remaining`/`percentage`, get, create, update, delete | `/budgets`, `/budgets/:id` |
| Dashboard | Safe-to-Spend breakdown, monthly income/expenses/net, protected savings, other-currency summaries, account list | `GET /dashboard/summary` |
| Health | Connectivity check (unauthenticated) | `GET /health` |

### 1.3 Hard limits of the real backend — design around these
- **No** push notifications, SMS, WebSockets/SSE, receipt/file upload, OAuth/social login, FX conversion, offline sync **[V]** (§11, §14, §18). All freshness is pull-based.
- **No** forgot-password, change-password, delete-user, or email-verification endpoints appear in the Report. Do **not** show UI for them.
- **No** transaction text-search parameter and **no** category/trend analytics endpoint. Do **not** build search or spending-by-category charts from partial client data.
- Cross-currency transfers and cross-currency commitment payments are rejected **[V]**. Accounts of other currencies are excluded from Safe-to-Spend **[V]**.
- `initialBalance` cannot be edited after account creation **[V]**.
- A transaction's `accountId` and `type` cannot be changed by `PATCH` **[V]**.
- Amounts arrive as **strings** with 2 decimals; requests send amounts as JSON numbers with ≤ 2 decimals; unknown request properties are rejected with 400 (`forbidNonWhitelisted`) **[V]**.
- Auth routes are throttled to 10 requests/minute; other routes 100/minute **[V]**.
- Refresh tokens rotate, and **reuse of a revoked refresh token revokes every session of the user** **[V]**. Therefore concurrent refresh calls are a data-loss-grade bug (see §10.2).

### 1.4 Ambiguities to resolve in Phase 1 (**[U]**)
1. `GET /commitments?status=PENDING` returns only PENDING; past-due items are OVERDUE and **excluded**, yet OVERDUE commitments are counted in Safe-to-Spend. The Report's screen map uses `?status=PENDING` for Home. → This spec fetches PENDING and OVERDUE (§10.1).
2. Whether TRANSFERs are excluded from `monthlySummary.income/expenses` (assumed but not stated). Never claim it in UI copy.
3. How an overall budget (`categoryId: null`) aggregates `spent` (which types/currencies). Display server values; never recompute.
4. Whether `PATCH /transactions/:id` on a commitment-paying transaction affects the commitment. Whether `PATCH /commitments/:id` with `status: "PAID"` creates a payment (assumed **no**). Whether setting status back from CANCELLED is supported.
5. Whether `endDate` filters on transactions are inclusive of the whole day; whether negative balances are allowed (no overdraft rule is documented); whether `remaining` can be negative and `percentage` > 100.
6. Which accounts `dashboard.accounts` includes (archived?). Use `GET /accounts` for account management; use the dashboard only for its summary figures.
7. Initial balance of the auto-created Cash account (assumed 0.00 — read it from the API; never assume).
8. Whether the repository already contains voice capture/parsing (the Report recommends client-side parsing then batch save). Preserve it if it exists (§7, S12).
9. Currency/timezone string validation on register/profile update.
10. Name format: seeded names are bilingual in one string (`"كاش / Cash"`, `"Groceries / بقالة ومستلزمات"`). See §13.4.

---

## 2. Scope & Rebuild Boundary

### 2.1 Authorization (granted by the product owner)
You have **full permission to delete and rebuild the existing frontend from the ground up**. Do not preserve existing components, screens, layouts, navigation, styling, tokens, animations, UI state, or frontend abstractions merely because they exist. Reuse something only when there is a clear technical reason. Do not force the new design into the old component architecture, and do not retain an inferior implementation because it already works visually.

### 2.2 Replace (default: delete if superseded)
Screens and their composition; component hierarchy; navigation/routing structure; layout and styling conventions; design tokens, colors, typography, themes; UI-only state management and interaction patterns; frontend-only abstractions that constrain the new direction; animations and transitions; obsolete components, dead styles, unused assets (remove when safe).

### 2.3 Protect (do not delete, weaken, or silently change)
- The backend and its business logic; API contracts and integration requirements.
- Authentication/authorization behavior (token lifecycle, secure token storage).
- Database schemas, migrations, persisted data. **Never run destructive database operations, never wipe or reseed a database with real data, never expose secrets or commit `.env` contents.**
- Financial calculations, validation, and transaction integrity.
- Environment configuration and **native app configuration** (`app.json`/`app.config.*`, bundle identifiers, permissions, EAS config, store assets). **The existing brand assets — the green "Flowsy" wordmark and the leaf-shaped "F" app icon on a rounded square — are brand identity and must be preserved as-is.** (You may change a splash background color only to match the new tokens, and report it.)
- Essential build configuration, dependencies, and project infrastructure unless a specific change is justified in writing.
- Every existing capability the backend supports that the old frontend exposed — **no supported functionality may be silently dropped.**
- Do not delete backend files, DB assets, env files, native config, or shared infrastructure just because they sit near frontend code.

### 2.4 Method
1. Audit the repository; map the exact boundary between frontend, backend, shared contracts, and infrastructure.
2. Establish product experience, IA, visual identity, screen specs, and interaction system (this document) before coding.
3. Classify every existing frontend file: **remove / replace / retain / migrate**, with a one-line reason each (store as `docs/rebuild-audit.md`).
4. Rebuild around this direction rather than modifying the old interface incrementally.
5. Preserve every backend integration and verified capability.
6. Remove obsolete frontend code when safe.
7. Keep no compatibility with discarded UI patterns unless a real technical dependency requires it.
8. Verify: builds, navigates, talks to the real backend, preserves financial behavior.
9. Report anything that cannot be preserved because the backend doesn't support it.

### 2.5 Backend gaps policy
Do **not** modify the backend. If an experience needs a missing capability, document it (what, why, minimal API needed) in `docs/backend-gaps.md`, and use the safe frontend fallback specified here. Known gaps: password reset/change, transaction search, category analytics, push reminders, receipt upload, FX, atomic account "opening-balance correction", per-index batch error mapping, idempotency keys for creates.

---

## 3. Product Strategy

### 3.1 Positioning **[H]** (evidence: seeded data, EGP/Africa-Cairo defaults, Arabic names, Vodafone Cash/NBE accounts, rent/internet commitments, the Arabic label "تقدر تصرف كام؟")
Primary user: an Egyptian adult juggling cash, a bank account, and a mobile wallet, with monthly bills, who wants a calm answer to "can I spend this?" more than a ledger. Treat this as a hypothesis; do not hard-code assumptions beyond defaults the backend already uses.

**Most frequent journeys:** (1) glance at Safe-to-Spend, (2) record an expense in seconds, (3) pay a bill, (4) check a budget, (5) review/correct a transaction.
**Needs immediate visibility:** the Safe-to-Spend figure, what is subtracting from it, anything overdue. **Secondary/hidden until needed:** protected savings, other currencies, archived items, formulas, correlation IDs.
**Financially sensitive actions needing confirmation:** delete transaction, delete/archive account, delete/cancel commitment, delete budget, delete category, change base currency, sign out of all devices. **Not** confirmed (reversible or low-risk): creating entries, editing notes/categories, toggling filters.
**Trust comes from:** exact figures (no rounding), figures that never change before the server confirms, a number that can explain itself, honest error copy, no fake success.
**Effortless comes from:** amount-first entry with smart defaults (last-used account, recent categories), a single capture entry point, no repeated data entry.
**Difference from a generic expense tracker:** it leads with one explainable decision number, treats commitments as first-class (they shape the headline figure), uses red sparingly, and avoids dashboards of cards.

### 3.2 Design principles
1. **One question per screen.** Each screen answers one thing; Home answers "تقدر تصرف كام؟".
2. **Figures are sacred.** Server strings are displayed exactly; derived values are labeled as derived.
3. **Nothing is true until the server says so.** No optimistic financial success.
4. **Quiet by default.** Red and gold are rare; if everything is highlighted nothing is.
5. **Explain, don't decorate.** Every visual encodes data or structure.
6. **Arabic is the design, not a translation.**
7. **Reversible actions are cheap, irreversible actions are slow.**

---

## 4. Art Direction

### 4.1 Personality — "Quiet Finance, Reimagined"
Calm, precise, warm, grown-up. Tone words: *steady, clear, unhurried, honest*. The palette is the existing Flowsy brand (forest green on warm ivory), which carries over because it is the company's identity (not an existing UI decision). Everything else about the interface is new.

**Design signature — "The Split Line":** a single thin horizontal bar that shows how money is divided: *available* vs *already spoken for*. It is the Safe-to-Spend visual on Home, and the **same** visual language (progress along one line, inline-start → inline-end) is reused for budgets. No donut charts, no sparklines, no stacked-card dashboards.

**Differs from generic finance UIs by:** no card stacks; hairlines + whitespace + typography for structure; red expenses are *not* used (expenses are ordinary, shown in primary text); one headline number; a docked capture bar instead of a FAB.

### 4.2 Surface rules (strict)
Allowed surfaces: **(1)** page background, **(2)** bottom sheets and dialogs (white / dark surface), **(3)** input fields (sunken tone), **(4)** the Home capture bar, **(5)** toasts, **(6)** the Split Line track and skeleton blocks. Everything else is direct composition: text, spacing, hairlines (`StyleSheet.hairlineWidth`), icons. No nested surfaces. No shadows anywhere (flat UI); sheets are separated from content by the scrim only.

### 4.3 Color tokens (semantic)
Define in one `theme/tokens.ts`; components consume semantic names only, never hex.

**Light**
| Token | Hex | Use |
|---|---|---|
| `bg` | `#F5F3EB` | page background (brand ivory) |
| `surface` | `#FFFFFF` | sheets, dialogs, toasts |
| `sunken` | `#ECEDE5` | input fill, tracks, skeletons, pressed rows |
| `border` | `#E0E3DA` | hairlines, input outlines |
| `textPrimary` | `#202923` | main text |
| `textSecondary` | `#5E695F` | secondary text on `bg` (≈5.2:1, my calculation). Brand `#68736B` (≈4.45:1 on ivory) is allowed **only on white** |
| `textDisabled` | `#8C968E` | disabled only; never essential text |
| `action` / `onAction` | `#173F35` / `#F5F3EB` | primary buttons (brand forest) |
| `actionPressed` | `#0F2B24` | pressed primary |
| `actionDisabled` / `onActionDisabled` | `#D5DAD2` / `#7F8A82` | disabled primary |
| `positive` / `positiveSubtle` | `#267653` / `#E3EFE7` | income, success |
| `negative` / `negativeSubtle` | `#B84C45` / `#F6E4E2` | deficit, overdue, errors, destructive |
| `warning` (fill) / `warningText` / `warningSubtle` | `#D9B879` / `#7A5A1E` / `#F4EBD6` | commitments segment, near-limit. **Gold is a fill only; gold text uses `warningText`** |
| `info` / `infoSubtle` | `#173F35` / `#E4EBE6` | neutral notices |
| `selection` | `#E4EBE6` | selected chip/row |
| `focus` | `#173F35` 2px ring, 2px offset | focus/keyboard |
| `scrim` | `rgba(32,41,35,0.45)` | behind sheets |
| `splitAvailable` / `splitCommitted` / `splitOverflow` / `splitTrack` | `#173F35` / `#D9B879` / `#B84C45` / `#ECEDE5` | Split Line |

**Dark** (derived from the brand; verify all pairs)
`bg #0E1613` · `surface #151F1B` · `sunken #1C2924` · `border #2A3831` · `textPrimary #ECEFE8` · `textSecondary #A3AFA6` · `action #F5F3EB` / `onAction #173F35` · `positive #5FBF8A` (`subtle #16281F`) · `negative #E58A82` (`subtle #2E1B19`) · `warning #D9B879`, `warningText #E3C98F` (`subtle #2A2415`) · `info #8FC2AE` (`subtle #17261F`) · `selection #1F3029` · `scrim rgba(0,0,0,0.6)` · `splitAvailable #7FB89F` · `splitCommitted #D9B879` · `splitOverflow #E58A82` · `splitTrack #1C2924`.

**Meaning rules.** Income: `positive`, always with `+`. Expense: `textPrimary`, always with `−` (U+2212). Transfer: `textSecondary` with a transfer icon and no sign. Deficit/overdue/over-budget/destructive/error: `negative` **plus an icon and a word** — color is never the only signal. Success is also conveyed by words/icons.

**Contrast gate:** write a script that checks every text/background token pair used by components: ≥ 4.5:1 for text < 18sp (< 14sp bold), ≥ 3:1 for large text and non-text UI (icons, input borders, Split Line segment edges). Fix tokens that fail and report the final values.

**Theme behavior:** light is the design baseline; dark is fully supported; default = follow system; user override in Settings (فاتح/داكن/تلقائي), persisted locally.

### 4.4 Typography
**Arabic family:** IBM Plex Sans Arabic (or the closest high-quality Arabic sans that the repo can load via `expo-font`/the existing font setup). Phase 1: check what font setup exists and whether the chosen family contains Arabic + Latin digits and supports tabular figures. **Numerals:** all financial figures and dates use **Western digits (0–9)** [H — Egyptian banking apps overwhelmingly do; centralize in `format.ts` so switching to Arabic-Indic is a one-line change]. If the Arabic family lacks tabular digits, render numerals with a Latin companion (e.g., IBM Plex Sans / Inter) inside `Money`/`Numeric` components only. Always apply `fontVariant: ['tabular-nums']` where the font supports it.

| Role | Size/line (sp) | Weight | Use |
|---|---|---|---|
| `display` | 48/56 | SemiBold | Safe-to-Spend figure (decimals at 60% size, `textSecondary`) |
| `title1` | 28/38 | SemiBold | screen titles |
| `title2` | 22/32 | SemiBold | sheet titles, detail headers |
| `amountLg` | 32/40 | SemiBold | detail-screen amounts |
| `heading` | 17/26 | SemiBold | section headers |
| `body` | 16/26 | Regular | content |
| `bodyStrong` | 16/26 | Medium | row titles |
| `amountMd` | 17/24 | Medium | row amounts |
| `label` | 14/22 | Medium | field labels, chips, buttons (small) |
| `caption` | 13/20 | Regular | metadata, helper, error text |
| `nav` | 12/16 | Medium | tab labels |

Arabic needs generous line height (≈ 1.5×); never clip ascenders/diacritics: do not set `lineHeight` below the values above. Minimum text size 12sp (tab labels only), otherwise ≥ 13sp. Support OS font scaling up to at least 1.5× (layouts reflow; hero uses `numberOfLines={1}` with `adjustsFontSizeToFit` and a floor).

### 4.5 Layout, spacing, shape
- Spacing scale (4-pt grid): `4, 8, 12, 16, 20, 24, 32, 40, 56`. Screen horizontal margin **20** (16 below 360dp width). Section gap 32. Row min-height 60. Touch targets ≥ 48dp (≥ 44pt iOS).
- Radii: `4` (bars/tracks), `8` (inputs, buttons, chips), `12` (capture bar, toasts), `20` top corners (sheets). No fully rounded pills except the segmented control thumb.
- Hairline separators are inset to the content margin (not full-bleed) and only between rows, never around groups.
- Tablet/large widths: content max-width 560, centered; phones are the design target (portrait). Landscape not required; must not break.
- Safe areas: all screens respect top/bottom insets; the tab bar and capture bar include the bottom inset; sheets extend under the home indicator with inset padding.
- Keyboard: sheets and forms use keyboard avoidance; the primary button stays visible above the keyboard; the focused field scrolls into view.
- Use logical `start/end` style props (`marginStart`, `paddingEnd`, `start`, `end`); avoid `left/right` except for physical things (numeric keypad, chart axes).

### 4.6 Icons
Ionicons outline set via `@expo/vector-icons` **if present [U]** (the backend's category `icon` values — `cart-outline`, `tv-outline`, `restaurant-outline`, `code-slash-outline` — are Ionicons names **[V]**). Size 20 inline / 24 standalone, stroke weight as shipped, color = text token. Unknown or null icon → `pricetag-outline`. Directional icons (back chevrons, forward chevrons, transfer arrows) must be mirrored in RTL (§13.3). Suggested glyphs — verify they exist: tabs `home-outline`, `swap-vertical-outline`, `calendar-outline`, `wallet-outline`; account types `cash-outline` (CASH), `business-outline` (BANK), `shield-checkmark-outline` (SAVINGS), `phone-portrait-outline` (MOBILE_WALLET); utilities `lock-closed-outline`, `swap-horizontal-outline`, `warning-outline`, `filter-outline`, `settings-outline`, `mic-outline`, `trash-outline`, `create-outline`, `repeat-outline`, `calendar-outline`.

### 4.7 Data-visualization language
- **Only** linear, single-axis encodings: the Split Line (Home explainer, budgets). Segments are labeled with text; values appear as text beside the bar. No pies/donuts, no gradients, no gridlines, no animated count-ups.
- **Split Line geometry (money → ratios with exact math, then to pixels):** with `L` = `totalLiquidFunds`, `C` = `totalPendingCommitments`: if `L > 0`: `committed = min(C, L)/L`, `available = 1 − committed`; render from the **inline-start** edge: *available* (forest) first, then *committed* (gold). If `C > L` (deficit): entire track in committed tone with a 4dp `splitOverflow` end-cap and the text "ناقص {deficitAmount}". If `L ≤ 0`: track in `splitOverflow` tone with warning icon and text. Height 8, radius 4, 2dp gap between segments. Segments below 3dp width are drawn at 3dp (but never misreport text).
- **Budget bar:** same component; `percentage` clamps to 0–100 for width only; text shows the true value (e.g., "عديت الميزانية بـ 320.00 ج.م"). Tone: < 75% `splitAvailable`; 75–99.99% `warning` + `warningText` label "قربت توصل"; ≥ 100% `splitOverflow` + icon + word.

---

## 5. Navigation Architecture

**Primary destinations (4 tabs, labels always visible, RTL order starts at the right):**

| Tab | Arabic | Why it exists |
|---|---|---|
| Home | الرئيسية | The Safe-to-Spend answer, what's coming, quick capture. Highest-frequency destination. |
| Transactions | المعاملات | Review, filter, correct. Second most frequent. |
| Plan | الخطة | Everything *forward-looking*: Commitments (feed Safe-to-Spend) and Budgets. One tab, two segments, because both answer "what's ahead / what's limited". |
| Accounts | الحسابات | Where the money lives; protection (exclude from Safe-to-Spend); balance correction. |

Settings is **not** a tab: reached from the avatar button on Home (and a "الإعدادات" row is not duplicated elsewhere). Categories management lives inside Settings (low frequency).

**Add actions are contextual, not a FAB:** Home → docked capture bar; Transactions → header "+" (opens S11); Plan → header "+" (opens S32 or S34 depending on segment); Accounts → header "+" (opens S42). Rationale: the highest-frequency task (recording) is one tap on Home; other tabs offer the add that fits their context, so no floating control covers content.

**Stack & sheets:** tabs are roots. Pushed screens: S41 Account detail, S51 Categories, S50 Settings. Everything else is a **sheet** (bottom sheet with detents) or a **dialog** (confirmation). Rule: *forms and details that return to their parent are sheets; places you can wander are stack screens.*

**Back/dismiss behavior:** Android back closes the topmost sheet/dialog first, then pops, then (at a tab root) goes to Home, then exits. iOS edge-swipe back works in RTL (swipe from the right edge) — verify. Sheets dismiss by drag-down, scrim tap, close button. If a sheet form is **dirty** (amount entered or any text typed), dismissal asks "تتخلى عن اللي كتبته؟" (متابعة | تخلّى). Sheets never stack more than two deep (e.g., S11 → account picker is *inline*, not another sheet).

**Keyboard/modals:** only one keyboard context at a time; opening a sheet dismisses the keyboard of the previous screen. Auth screens use scrollable forms with `KeyboardAvoidingView` behavior verified on both platforms.

**Small screens (≤ 360×640dp):** margins 16; tab labels remain; hero font scales via fit-to-width; sheets use full-height detent; no horizontally scrolling content except chip rows.

**RTL:** the whole app is forced RTL (§13.1). Navigator transitions run in RTL direction; tab order mirrored.

**Session gate:** app start → S00 (restore tokens from secure storage) → authenticated stack (tabs) or auth stack (S01–S03). Token loss at any time → S03 with message.

---

## 6. Screen Inventory

| ID | Name | Type | Entry points | Exit | Backend |
|---|---|---|---|---|---|
| S00 | Session gate / splash | root | cold start | S01 / S10 / S04 | `/auth/refresh` (if needed), `/auth/me` |
| S01 | Welcome | stack | S00 (signed out) | S02, S03 | — |
| S02 | Create account | stack | S01 | S04 | `POST /auth/register`, `GET /accounts` |
| S03 | Sign in | stack | S01, session expiry | S10 (or S04 if no active accounts) | `POST /auth/login`, `GET /accounts` |
| S04 | First-run: starting balances | stack | S02, S03 (no active accounts or Cash untouched) | S10 | `GET/POST/DELETE /accounts` |
| S10 | Home | tab | tab | S10a, S11, S33, S30, S40, S50 | `GET /dashboard/summary`, `GET /commitments` (×2) |
| S10a | Safe-to-Spend explainer | sheet | S10 | S10 | same data as S10 + `GET /accounts` |
| S11 | Add / edit transaction | sheet | S10 bar, S20 "+", S21, S41 | previous | `POST/PATCH /transactions`, `GET /accounts`, `GET /categories` |
| S12 | Quick-entry review (batch) | sheet, **conditional** | S10 mic / S11 | S20 | `POST /transactions/batch` |
| S20 | Transactions | tab | tab, S35, S41 | S21, S22, S11 | `GET /transactions` |
| S21 | Transaction detail | sheet | S20, S31(paid) | S11 (edit), S11 (copy), delete | `GET /transactions/:id`, `DELETE` |
| S22 | Filters | sheet | S20 | S20 | `GET /accounts`, `GET /categories` |
| S30 | Plan (Commitments ∣ Budgets) | tab | tab, S10 link | S31, S32, S33, S34, S35 | `GET /commitments`, `GET /budgets` |
| S31 | Commitment detail / edit | sheet | S30, S10 | S33 | `GET/PATCH/DELETE /commitments/:id` |
| S32 | Add commitment | sheet | S30 "+", S10 empty | S30 | `POST /commitments` |
| S33 | Pay commitment | sheet | S10, S30, S31 | — | `POST /commitments/:id/pay` |
| S34 | Add / edit budget | sheet | S30 "+", S35 | S30 | `POST/PATCH /budgets` |
| S35 | Budget detail | sheet | S30 | S20 (filtered), S34 | `GET /budgets/:id`, `DELETE` |
| S40 | Accounts | tab | tab, S10 footers | S41, S42 | `GET /accounts`, dashboard summary |
| S41 | Account detail | stack | S40 | S20 (filtered), S41a | `GET/PATCH/DELETE /accounts/:id`, `GET /transactions?accountId&limit=5` |
| S41a | Correct balance | sheet | S41 | S41 | `POST /transactions` |
| S42 | Add / edit account | sheet | S40 "+", S04 | S40 | `POST/PATCH /accounts` |
| S50 | Settings | stack | S10 avatar | S51, S53 | `GET /users/profile`, `POST /auth/logout`, `GET /health` |
| S51 | Categories | stack | S50 | S52 | `GET /categories` |
| S52 | Category editor | sheet | S51 | S51 | `POST/PATCH/DELETE /categories` |
| S53 | Edit profile | sheet | S50 | S50 | `PATCH /users/profile` |
| S90 | Offline / server unreachable | full-screen state | any failed first load | retry | `GET /health` |

---

## 7. Screen Specifications

**Conventions for every screen:** (a) first paint uses cached data when present (stale-while-revalidate), else skeletons that match the final layout; (b) all lists use stable `id` keys; (c) all user-visible strings come from `strings.ar.ts`; (d) every error shows a retry; (e) forms preserve input on failure; (f) every money value renders through `Money`.

### S00 — Session gate
- **Purpose:** decide signed-in vs. signed-out without flicker. **Layout:** ivory background, centered Flowsy wordmark asset (existing). **Logic:** read refresh/access token from secure storage; if none → S01. If access token exists → `GET /auth/me`; on 401 run the single-flight refresh (§10.2); success → tabs; failure → S01 with no scary message (silent) unless the failure was a revoked token → S03 with "سجّل دخولك تاني". If network error: if a cached profile exists, enter the app with offline banner state; else S90.
- **Done when:** killing and relaunching the app within 7 days of activity lands on Home with no login screen; with an invalid token lands on S03; offline launch with cache shows Home with cached data and an offline notice.

### S01 — Welcome
- **Purpose:** one-screen promise, two paths. **Layout (top→bottom):** wordmark (brand asset); headline `title1` "تقدر تصرف كام؟"; one `body` line "اعرف المتاح فعلاً بعد التزاماتك"; flexible space; primary button "ابدأ"; text button "عندي حساب". No carousel, no illustrations.
- **Done when:** both buttons navigate; renders correctly at 360×640 with 1.5× font.

### S02 — Create account
- **Fields (labels above fields, always visible):** الاسم (displayName, 2–50), الإيميل (trim, lowercase for submission), كلمة السر (≥ 8, show/hide toggle). Currency and timezone are **not asked** (backend defaults EGP / Africa/Cairo **[V]**).
- **Validation:** inline on blur and on submit; helper under password "٨ حروف على الأقل" rendered with Western digits per §13.2 ("8 حروف على الأقل").
- **Submit:** button loading + disabled; on 201 store tokens securely, seed cache with `user`, then `GET /accounts` → S04. **Errors:** 409 → email field error "الإيميل ده مسجّل قبل كده" with "سجّل دخول" link; 400 → map to fields; 429 → disable submit for 60s with countdown text; network → inline banner, keep inputs.
- **Edge:** password manager autofill (set `textContentType`/`autoComplete`); LTR input direction for email/password; double-tap guard.
- **Done when:** a new user can register against the real backend and land on S04 with their provisioned Cash account loaded.

### S03 — Sign in
- Fields: الإيميل, كلمة السر. Button "دخول". **401** → single message "الإيميل أو كلمة السر غلط" (no field-specific hint); **429** → cooldown 60s countdown; no "forgot password" (no endpoint). After success: `GET /accounts`; if zero active accounts → S04; else S10.
- **Done when:** demo user (`demo@flowsy.app`) logs in in dev; error states reproduce on bad credentials; 10 rapid attempts show the cooldown rather than a raw 429.

### S04 — First-run: starting balances
- **Purpose:** get the user's real money into Flowsy correctly the first time, because **opening balances cannot be edited later [V]**.
- **Layout:** title "رصيدك دلوقتي كام؟"; helper "ده بيبقى رصيد البداية. مش هتقدر تعدله بعدين، لكن تقدر تصحّح الرصيد في أي وقت."; list of accounts (provisioned Cash first) each with an amount field; "＋ ضيف حساب" (opens S42 with `initialBalance` emphasis); primary button "كمّل"; text button "بعدين" (skip, keeps all balances as-is).
- **Mechanics [H, owner decision #1 in Appendix A]:** for the auto-provisioned empty Cash account, if the user enters a non-zero amount: (1) re-read the account; confirm it is the untouched provisioned account (its `currentBalance` equals `initialBalance`, and it was created within this session); (2) `DELETE` it (the backend itself refuses if it has transactions/commitments); (3) immediately `POST` an account with the **same name/type/currency** and the entered `initialBalance`. If step 3 fails: retry once automatically; on a 409 treat as success after re-fetching; otherwise show a persistent recovery state ("لسه محتاجين نضيف حساب الكاش — حاول تاني") and **Home/Accounts must handle "no active accounts" gracefully** (see S10 empty). New accounts created here use `POST /accounts` directly.
- **Done when:** after S04 the Accounts tab shows the entered balances exactly; the dashboard liquid funds equals their sum (for spendable base-currency accounts); skipping leaves a working app.

### S10 — Home
- **Purpose:** answer "تقدر تصرف كام؟" instantly and offer the next action. **Primary action:** record a transaction. **Secondary:** pay an upcoming commitment; open the explainer.
- **Layout (top→bottom, no cards):**
  1. *Header row:* greeting "أهلاً يا {firstName}" (`label`, secondary) at inline-start; avatar button (first letter) at inline-end → S50.
  2. *Question + answer:* `caption`-sized question "تقدر تصرف كام؟" then the hero `Money` (`display`) of `safeToSpend.safeToSpend`.
  3. *Split Line* (§4.7) with a two-item legend under it: "متاح {safeToSpend}" · "التزامات الشهر {totalPendingCommitments}".
  4. *One explanatory sentence* (`body`, secondary, tappable with chevron → S10a): "من {totalLiquidFunds} ناقص {n} التزامات لحد آخر الشهر" (use plural rules, §13.5).
  5. *Two supporting figures*, side by side, separated by a vertical hairline: "دخل الشهر" {income} (positive) · "مصروف الشهر" {expenses} (primary). **netSavings is not shown.**
  6. *"الجاي" section* (`heading`) with up to 3 rows: **OVERDUE first (most overdue first), then PENDING by due date**. Row: name · due label ("النهارده" / "بكرة" / "بعد 3 أيام" / "متأخر يومين") · amount · trailing text button "سدّد". Items due **after month-end** show a caption "بعد آخر الشهر — مش داخل في الحساب". If > 3: link "كل الالتزامات (+N)" → S30. Empty: "مفيش التزامات جاية" + text button "ضيف التزام" → S32.
  7. *Quiet footnotes* (only when non-zero): "وفوق ده {totalProtectedSavings} في حسابات محمية" → S40; "وعندك أرصدة بعملات تانية" → S40.
  8. *Capture bar* docked above the tab bar (full width minus margins, radius 12, `surface`, hairline border): leading plus icon, text "سجّل مصروف أو دخل", (trailing mic icon **only if voice is available, S12**). Tap → S11.
- **Deficit state (`isDeficit: true`):** hero label changes to "ناقصك"; the hero shows `deficitAmount` with `−` in `negative` plus a `warning-outline` icon; sentence: "التزامات الشهر أكتر من رصيدك المتاح"; Split Line in overflow mode; a text button "راجع الالتزامات" → S30. Never use celebratory or alarmist copy.
- **Zero state (`safeToSpend` = "0.00", not deficit):** show the figure normally with neutral copy.
- **No-accounts state:** replace items 2–6 with title "ضيف أول حساب عشان نحسبلك" + primary button → S42. Capture bar hidden.
- **Data:** `GET /dashboard/summary` (all figures are server strings), `GET /commitments?status=OVERDUE` and `?status=PENDING` merged (§10.1). Derived: due labels, plurals.
- **Interactions:** pull-to-refresh refetches summary + commitments; refetch on focus if data older than 60s; "سدّد" opens S33 (does not pay directly). Avatar → S50. Haptics per §12.
- **Edge cases:** long Arabic commitment names truncate to 1 line with ellipsis (full name in S31); very large numbers (up to 12 integer digits) must not clip (fit-to-width down to 60% then wrap decimals); stale data (> 5 min or offline) shows caption "آخر تحديث {time}" under the hero; error with no cache → inline `ErrorState` with retry; expired token handled by the interceptor transparently.
- **Done when:** every figure on screen equals the API string; deficit and zero states reproduced against seeded/test data; pay flow from Home completes and Home updates only after server success; screenshot-verified at 360×640, 393×852, 430×932, light/dark, 1.5× font.

### S10a — Safe-to-Spend explainer (sheet)
- **Purpose:** make the number trustworthy. **Layout:** title "إزاي اتحسبت؟"; equation in plain Arabic with the server figures: "رصيدك المتاح {totalLiquidFunds} − التزامات لحد آخر الشهر {totalPendingCommitments} = {safeToSpend}"; two grouped lists: **"الحسابات الداخلة في الحساب"** (from `GET /accounts`: active, base currency, `excludeFromSafeToSpend=false`) and **"الالتزامات الداخلة"** (OVERDUE/PENDING, base currency, due ≤ month-end, from the merged commitments cache); footer caption "اتحسبت {calculatedAt relative}" and a note "الحسابات المحمية والعملات التانية مش داخلة".
- **Integrity rule:** compute the sums of the two lists with exact decimal math; **if they do not equal the server's totals, hide the lists and show only the server equation** (never display a breakdown that disagrees with the headline number). Month-end is computed in the **user's timezone**.
- **Done when:** with test data the lists sum to the server totals; with a mismatch fixture the lists are hidden.

### S11 — Add / edit transaction (sheet, ~92% height)
- **Purpose:** record in ≤ 3 actions for the common case (tap bar → type amount → "سجّل"). **Defaults:** type EXPENSE; account = last-used spendable account (local), else first active account in base currency; date = today; category empty.
- **Layout (top→bottom):** sheet title (`title2`: "مصروف جديد" / "دخل جديد" / "تحويل جديد") + close; **segmented control** مصروف | دخل | تحويل; **amount display** (`amountLg`, currency symbol of the selected account, large caret); **account row** "من حساب" showing name + balance → expands inline to a list (archived hidden; for TRANSFER destination row "إلى حساب" lists only same-currency, different accounts); **category row** (not for TRANSFER): a horizontal strip of the 6 most recent/frequent categories of the relevant type (local usage counts) + "الكل" which expands an inline grid list of all non-archived categories of that type; **note** (single field, up to 3 lines, max 200 chars, counter appears at ≥ 160); **date row** chips "النهارده" · "امبارح" · "تاريخ تاني…" (native date picker; **max = today** — UI guard, [H]); **in-sheet numeric keypad** (LTR layout 1-2-3 / 4-5-6 / 7-8-9 / . 0 ⌫) docked at the bottom; **primary button** above the keypad: "سجّل {amount} ج.م" (disabled until amount > 0, and account/destination chosen).
- **Keypad rules:** only digits and one decimal point; max 2 decimals; max 12 integer digits (backend `Decimal(14,2)`); leading zero collapse; ⌫ long-press clears. Accept pasted/typed Arabic-Indic digits and "٫" in any text input that parses amounts (normalize). When the note field is focused the keypad collapses and the system keyboard shows.
- **Submit:** one request; button shows spinner, form locked (no duplicate submission); **no success is shown until 201**. On 201: close sheet, toast "اتسجّل" with **Undo (6s)** that calls `DELETE /transactions/:id` (safe: atomic reversal **[V]**); invalidate per §10.3. TRANSFER sends `destinationAccountId` and **omits `categoryId`**.
- **Edit mode (from S21):** account and type shown read-only with a caption "عشان تغيّر الحساب أو النوع، سجّل حركة جديدة واحذف القديمة"; editable: amount, category, date, note; sends only changed fields; **never** sends `type`/`accountId`/`destinationAccountId` on PATCH. Footer secondary action "نسخة كحركة جديدة" (opens a fresh S11 prefilled; the user deletes the old one themselves — no automatic compound mutation).
- **Errors:** 400 messages mapped (§10.5) to fields; cross-currency transfer message shown on the destination row; 404 (stale account/category) → refetch lists, keep the form, message "الحساب أو التصنيف ده مبقاش متاح — اختار تاني"; network/timeout/5xx → **ambiguous-outcome protocol** (§10.4) — keep the form, never auto-retry, on user retry first check whether it was created.
- **Edge cases:** only one active account → no account picker affordance, just a label; zero active accounts → sheet replaced with S42 prompt; foreign-currency account → amount symbol follows account currency; backgrounding keeps the in-memory draft; kill discards it; Arabic text in note is RTL-aligned, mixed digits stay LTR.
- **Done when:** an expense, an income, and a same-currency transfer can be created against the real backend and appear in S20, S40 balances, and S10 figures after refetch; a cross-currency transfer cannot be submitted (destination list excludes mismatches) and the server's rejection, if forced, is shown in Arabic; undo restores balances; editing amount applies the server's delta (verify account balance change = new − old).

### S12 — Quick-entry review (batch) — **conditional**
- **Build rule:** inspect the repo for existing voice/NL parsing. If it exists, **preserve the capability** and re-skin it to this spec. If it doesn't, implement only the **review surface** (below) fed by whatever draft source exists, and implement voice capture only if a speech-recognition solution compatible with the installed Expo SDK is already installed or can be justified (dev-build requirement, permissions, Arabic dialect support, privacy). Document the decision in `docs/voice-decision.md`. Never fake parsing.
- **Layout:** title "راجع قبل التسجيل"; list of draft rows — each: amount, category, account, note, remove button; rows with missing amount show "حدد المبلغ" and block saving; footer line "{n} معاملات — الإجمالي {sum}" (exact decimal sum, per currency if mixed); primary "سجّل الكل"; caption "هتتسجّل كلها مع بعض أو مفيش حاجة هتتسجّل".
- **Rules:** 1–20 items (block with message beyond 20); all EXPENSE unless the user changes type; account defaults as S11; a failed batch changes nothing server-side **[V]** — keep all drafts, show the server message in Arabic, and do not guess which row failed (no per-index mapping exists); success → single toast "اتسجّل {n} معاملات" and haptic success.
- **Voice states (if built):** idle · permission request · listening (visible label, level indicator) · processing · review; denial → settings deep link; interruption (call/background) cancels cleanly with no partial save.
- **Done when:** a 3-item batch saves atomically; a batch containing an invalid account fails entirely with all drafts retained.

### S20 — Transactions
- **Layout:** header title "المعاملات" + filter icon (badge with active-filter count) + "+" ; **filter summary line** under the header only when filters are active (e.g., "مصروفات · الأهلي · أكتوبر" with a clear "مسح"); grouped list with **day headers** ("النهارده · الأحد 18 أكتوبر", "امبارح", then dates) computed in the user's timezone.
- **Row:** leading icon (category icon, or `swap-horizontal-outline` for transfers) in a 36dp sunken tile; title = note, else category name, else type label; subtitle = account (· time); trailing `Money` with sign/tone per §4.3. Transfer title: "{from} ← {to}" (arrow mirrored). No per-day totals (pages split days). Row height ≥ 60.
- **Data:** `GET /transactions` (limit 30; sorted desc by date) with filters; infinite scroll via `page`; **de-duplicate by id when merging pages**; any mutation resets to page 1; header caption shows `total` when filtered ("{n} معاملة").
- **Interactions:** tap row → S21; pull-to-refresh; scroll end fetches next page (footer spinner; on page error show a footer retry row without losing loaded items); filter icon → S22; "+" → S11. **No swipe actions** (financially sensitive; deletion lives in S21). No long-press.
- **States:** loading skeleton rows (6); empty "لسه مفيش معاملات" + button "سجّل أول معاملة"; filtered-empty "مفيش معاملات بالفلاتر دي" + "مسح الفلاتر"; offline with cache → cached list + notice; end-of-list quiet caption.
- **Edge:** thousands of rows (list virtualization; memoized rows); out-of-order page responses ignored (§10.4); a transaction whose category was archived still renders its category name; null category → "بدون تصنيف".
- **Done when:** filtering by type/account/category/date returns exactly what the API returns; scrolling 3+ pages produces no duplicates or gaps; creating a transaction elsewhere shows it at the top after returning.

### S21 — Transaction detail (sheet)
- **Layout:** `amountLg` with sign/tone; type + date/time subtitle; grouped fields separated by hairlines: الحساب (tappable → S41), التصنيف, ملاحظة, "اتسجّلت في" (createdAt); for TRANSFER: من/إلى. Actions: primary "تعديل" (→ S11 edit), secondary "نسخة كحركة جديدة", destructive text button "احذف المعاملة" at the bottom, visually separated.
- **Delete confirmation (dialog):** copy states the exact balance effect — EXPENSE: "هيرجّع {amount} لحساب {account}"; INCOME: "هيخصم {amount} من حساب {account}"; TRANSFER: "هيرجّع {amount} لـ {from} ويخصمها من {to}". If the transaction id equals a cached commitment's `paidTransactionId`, add "والتزام «{name}» هيرجع غير مسدّد." Buttons: "احذف" (destructive) / "إلغاء". Success → close, toast "اتحذفت", haptic medium impact, invalidate (§10.3). **No Undo for delete** (re-creation would not be equivalent).
- **Done when:** deleting reverses the balance exactly; deleting a commitment-paying transaction makes the commitment appear as unpaid after refetch.

### S22 — Filters (sheet)
- Sections: النوع (الكل/مصروف/دخل/تحويل), الحساب (single select; includes archived accounts so history is filterable), التصنيف (single select, grouped by type, includes archived), الفترة (presets: الشهر ده · الشهر اللي فات · آخر 30 يوم · مخصص with from/to pickers). Footer: "عرض النتايج" and text "مسح الكل". **Debounce is not needed** (explicit apply). Date bounds sent as ISO UTC converted from the user's timezone start-of-day / end-of-day (verify end-of-day inclusivity **[U]**). Filter state is kept while the app is open; reset on sign-out.

### S30 — Plan
- **Layout:** title "الخطة"; segmented control "الالتزامات | الميزانيات" (remember last segment per session); header "+" depends on segment.
- **Commitments segment.** Top line (not a card): "لحد آخر الشهر: {dashboard.totalPendingCommitments}" (server figure, same as Home). Sections: **"متأخرة"** (OVERDUE; `negative` label + icon), **"جاية"** (PENDING by due date), **"اتسددت"** and **"ملغية"** (collapsed; fetched lazily with `status=PAID` / `status=CANCELLED` when expanded, showing the latest 10 with "عرض المزيد" paging client-side). Row: name; due date (+ relative); recurrence ("كل شهر"…); linked account name if any; amount; trailing "سدّد" button for OVERDUE/PENDING. Tap row → S31.
- **Budgets segment.** Sections: "شغّالة دلوقتي" (period contains now), "جاية", "خلصت" (collapsed), archived behind a text toggle "المؤرشفة". Row: name (categoryName or "كل المصروفات"), period "1 – 31 أكتوبر", `Split Line` bar, "{spent} من {amount}" and "فاضل {remaining}" (or the over-budget wording, §4.7). Tap row → S35.
- **States:** skeletons; empty commitments "مفيش التزامات — ضيف الإيجار أو فاتورة" + button; empty budgets "حدد حد للصرف على تصنيف" + button; error with retry.
- **Done when:** overdue items appear exactly when the API marks them OVERDUE; budgets show server `spent/remaining/percentage` and over-100% renders without overflowing the layout.

### S31 — Commitment detail / edit (sheet)
- **Layout:** name (`title2`), amount (`amountLg`), due date, recurrence, linked account, category, status label (متأخر / جاي / اتسدد / ملغي). **Editable fields (PENDING/OVERDUE):** name (1–100), amount, due date, recurrence, account (optional), category (optional; expense categories). **PAID:** read-only, with a "شوف المعاملة" action (opens S21 via `GET /transactions/:id`); no delete/edit. **Actions:** primary "سدّد" (→ S33); "إلغاء الالتزام" (confirm → `PATCH {status:"CANCELLED"}`); "احذف" (confirm; for PENDING/OVERDUE/CANCELLED only). **Never expose a manual "mark as paid"** — payment only through S33 **[U-4]**.
- **Done when:** edits persist and Home/Plan update; cancel removes it from Safe-to-Spend after refetch.

### S32 — Add commitment (sheet)
- Fields: الاسم, المبلغ (keypad rules as S11), تاريخ الاستحقاق (default: today + 7 days; date picker), التكرار (مرة واحدة · يومي · أسبوعي · شهري · سنوي), الحساب (optional, default account), التصنيف (optional). If the chosen date is in the past, caption "هتتسجّل كمتأخرة". Primary "حفظ". Foreign-currency account → amount currency follows it. Errors per §10.5.

### S33 — Pay commitment (sheet)
- **Layout:** commitment name + amount (read-only — payment amount cannot differ **[V]**); account list (default: the commitment's account if active and same currency; else last-used account of the same currency); accounts in other currencies are shown disabled with the reason "العملة مختلفة"; for the selected account show "الرصيد دلوقتي {balance}" and "بعد السداد {balance − amount}" (exact decimal math, labeled derived); if the result is negative, show a warning caption (server decides whether it is allowed **[U-5]**); optional date chip ("النهارده" default) and note (max 200). Primary: "سدّد {amount} ج.م".
- **Submit:** single request, button locked, no success UI before 200. After success: close, toast "اتسدّد" — and for recurring commitments, once the commitments refetch returns, append the next due date: "الموعد الجاي {date}" (the response doesn't include it). Invalidate §10.3. Haptic success.
- **Errors:** 400 "already marked as paid" → "الالتزام ده اتسدّد قبل كده" and refetch (also the expected result of double taps); cross-currency → "اختار حساب بنفس عملة الالتزام"; ambiguous outcome → §10.4 (refetch the commitment before allowing retry).
- **Done when:** paying twice rapidly produces exactly one transaction; account balance drops by exactly the amount; next occurrence appears for a MONTHLY commitment.

### S34 — Add / edit budget (sheet)
- Fields: الاسم (1–100), الحد (amount), التصنيف (optional; "كل المصروفات" = none), الفترة: presets "الشهر ده" / "الشهر الجاي" / "مخصص" (start/end pickers); `startDate < endDate` enforced inline; end date sent as end-of-day 23:59:59.999 in the user's timezone converted to ISO. Edit: all fields incl. archive toggle. Primary "حفظ". Delete lives in S35.

### S35 — Budget detail (sheet)
- Name, period, large Split Line bar, "{spent} من {amount}", "فاضل / عديت", percentage as text. Actions: "شوف المعاملات" (opens S20 pre-filtered by the budget's `categoryId`, if any, and its date range; the S20 filter summary line makes the active filter explicit, and the screen never claims the list total equals the budget's `spent` **[U-3]**), "تعديل", "أرشفة/استرجاع", destructive "احذف الميزانية" (confirm).
- **Done when:** progress equals the server values after creating an expense in that category.

### S40 — Accounts
- **Layout:** title "الحسابات" + "+"; top line "المتاح للصرف {totalLiquidBalance}" (dashboard); groups separated by `heading` + hairline (no cards): **"متاحة للصرف"** (base currency, not excluded) · **"محمية"** (`excludeFromSafeToSpend`, lock icon, caption "مش داخلة في تقدر تصرف كام") · **"بعملات تانية"** (one sub-header per currency with its server subtotal from `excludedCurrenciesSummary`). Row: type icon, name (§13.4), type label, balance (`Money`, `amountMd`). Footer text button "المؤرشفة ({n})" toggles an extra muted group (fetch `includeArchived=true`).
- **Data:** `GET /accounts` + dashboard summary. **Empty (no active accounts):** "ضيف أول حساب" + button.
- **Interactions:** row → S41. **Done when:** group membership matches `excludeFromSafeToSpend` and currency; subtotals equal server values.

### S41 — Account detail (stack)
- **Layout:** name (editable via "تعديل"), `amountLg` current balance, caption "رصيد البداية {initialBalance}"; a labeled switch "داخل في تقدر تصرف كام" (ON = `excludeFromSafeToSpend:false`) — **not optimistic**: shows an inline spinner, applies on 200, then invalidates the dashboard; type (editable); "آخر 5 معاملات" (`GET /transactions?accountId=…&limit=5`) + "كل المعاملات" → S20 filtered; row "صحّح الرصيد" → S41a; section "متقدم": "أرشفة الحساب" (confirm: "هيختفي من الاختيارات ومن حساب تقدر تصرف كام، والمعاملات القديمة هتفضل محفوظة"), "حذف الحساب" (confirm; allowed only if unused — on the backend's 400 show the friendly message with an inline "أرشفه بدل الحذف" action). Archived: muted header with "استرجاع".
- **Done when:** toggling protection changes Home's figure after refetch; deleting a used account shows the guidance, not a raw error.

### S41a — Correct balance (sheet)
- **Purpose:** fix a wrong starting balance without editing history (Report §18). **Layout:** explanation "الرصيد الافتتاحي مش بيتعدل، فهنسجّل تعديل بالفرق."; field "الرصيد الفعلي دلوقتي"; computed line "الفرق: +{diff}" or "−{diff}" (exact decimal); **mandatory notice** "التعديل هيتحسب ضمن دخل/مصروف الشهر ده" (the dashboard cannot exclude adjustments). Submit → `POST /transactions` INCOME (diff > 0) or EXPENSE (diff < 0) on that account, `note: "تعديل رصيد"`, no category; diff = 0 disables the button. Success toast + invalidations.

### S42 — Add / edit account (sheet)
- Fields: الاسم (1–50), النوع (4 options with icons), العملة (default base; curated list EGP, USD, EUR, SAR, AED, KWD, GBP; if the repo/backend supports others keep them), رصيد البداية (create only; helper "مش هتقدر تعدله بعدين"), switch "حساب محمي (مش داخل في تقدر تصرف كام)" (default off; when type = SAVINGS show a gentle suggestion line, never auto-toggle). Edit mode shows name/type/protected only. **409** → field error "الاسم ده مستخدم". Caption when currency ≠ base: "حسابات بعملة تانية مش بتدخل في تقدر تصرف كام".

### S50 — Settings (stack)
- Rows grouped with headings (no cards): **الحساب** — الاسم والإيميل (→ S53; email read-only); **التفضيلات** — المظهر (فاتح/داكن/تلقائي, local), الاهتزاز (on/off, local), التصنيفات (→ S51); **متقدم** — العملة الأساسية (picker; confirm: "هتتغير العملة اللي بنحسب بيها تقدر تصرف كام. الحسابات والمعاملات القديمة مش هتتحول." → `PATCH currency`; invalidate everything), المنطقة الزمنية (picker; `PATCH timezone`); **الأمان** — "تسجيل الخروج" (this device: `logout` with this refresh token) and "تسجيل الخروج من كل الأجهزة" (confirm; logout with empty body); **عن التطبيق** — version, "حالة الخادم" (`GET /health`, shown as متصل/مش متاح).
- Sign-out always clears secure storage, query cache, filters, and local drafts **even if the network call fails**, then shows S01.
- **Not present (no backend):** change password, delete account, language switch.

### S51/S52 — Categories & editor
- **S51:** segmented "مصروفات | دخل"; section "تصنيفاتي" (custom: tap → S52) and "التصنيفات الأساسية" (system: lock icon, not editable, `isSystem`), "المؤرشفة" collapsed. Row: icon, display name (§13.4). Header "+".
- **S52:** name (1–50), icon picker (grid of ~24 curated Ionicons names, plus "بدون"), type fixed by the segment on create (not editable on update). Actions on existing: "أرشفة/استرجاع" (`isArchived`), destructive "حذف" (confirm). **400 "linked records"** → "التصنيف ده مستخدم — أرشفه بدل الحذف" with an inline archive action; **403 system** can't occur from UI but is mapped.
- **Done when:** created custom category appears in S11 pickers; archived categories disappear from pickers but remain in S22 filters and in history rows.

### S53 — Edit profile (sheet)
- Field displayName (2–50) only; save → `PATCH /users/profile`; update cache and Home greeting.

### S90 — Offline / server unreachable
- Full-screen only when there is **no cache** to show. Copy: "مش قادرين نوصل للسيرفر" + "حاول تاني"; secondary "تفاصيل" reveals the short correlation ID when available. If cache exists, never use S90 — show cached content with a slim non-blocking notice "أنت أوفلاين — الأرقام ممكن تكون قديمة" and **disable all mutating actions** (they show "محتاج اتصال") because no idempotent offline queue is supported **[V §18]**.

---

## 8. End-to-End User Journeys

| # | Journey | Trigger → goal | Shortest path | Can go wrong → recovery | After success / links |
|---|---|---|---|---|---|
| J1 | First launch & signup | New install → get started | S01 → S02 → S04 → S10 | 409 email exists → link to S03; 429 → cooldown; offline → inline banner, inputs kept | Lands on Home with real balances |
| J2 | Sign in / session restore | Reopen app → be signed in | S00 → S10 | Revoked/expired refresh → S03 with "سجّل دخولك تاني"; offline → cached Home | Silent refresh keeps user in |
| J3 | Daily check | "Can I spend?" | Open app → read S10 hero | Stale/offline → caption + cached figures | Tap sentence → S10a for "why" |
| J4 | Record expense | Just paid for something | S10 bar → keypad → "سجّل" | 400/404 → field messages; timeout → ambiguous-outcome protocol | Toast + Undo; Home/Accounts/Budgets refresh |
| J5 | Record income | Salary received | S11 → دخل → amount → "سجّل" | same as J4 | Monthly income figure updates |
| J6 | Transfer | Move cash to bank | S11 → تحويل → destination | cross-currency blocked by filtering destination list | Both balances update |
| J7 | Correct a mistake | Wrong amount/category | S20 → S21 → تعديل | account/type wrong → "نسخة كحركة جديدة" then delete old | Balances reflect delta |
| J8 | Pay a bill | Rent due | S10 row "سدّد" → S33 → confirm | already paid → friendly msg + refetch; cross-currency → pick another account | Next occurrence shown; Safe-to-Spend recalculated |
| J9 | Plan commitments | New recurring bill | S30 "+" → S32 | past date → labeled overdue | Appears in "جاية" and Home |
| J10 | Budget | Limit grocery spend | S30 → الميزانيات → "+" → S34 | start ≥ end → inline error | Live progress after each expense |
| J11 | Find transactions | "What did I spend in Sept?" | S20 → S22 → apply | empty result → clear filters | Filter summary line stays visible |
| J12 | Manage accounts | Protect savings / archive | S40 → S41 → switch | delete used account → guidance + archive | Home figure changes after refetch |
| J13 | Reconcile balance | Balance doesn't match reality | S41 → S41a | ambiguity about income impact → notice shown | Adjustment appears in S20 |
| J14 | Return after days | Reopen after a week | S00 → S10 | access token expired → one silent refresh | Data refetched on focus |
| J15 | Failure & offline | No network | any | S90 only without cache; mutations disabled with message | Auto-refetch on reconnect |

---

## 9. Component Architecture

**Principles:** few components with clear jobs; compose, don't wrap everything. One base `ListRow` powers transaction, commitment, account, and category rows (via thin wrappers), not five copies. Keep screens as screens; extract a component only when ≥ 2 screens use it or it has non-trivial behavior.

| Layer | Components (responsibility) |
|---|---|
| Theme | `tokens.ts`, `ThemeProvider` (system/override), `useTheme`; typography roles as `AppText variant` |
| Primitives | `Screen` (insets, bg, optional scroll, max-width), `AppText`, `Icon` (Ionicons + RTL mirror prop), `Button` (primary/secondary/text/destructive; `loading`, `disabled`, press feedback), `IconButton`, `Divider` (inset hairline), `Skeleton` |
| Money & numbers | `Money` (props: `value: string`, `currency`, `size`, `sign: 'auto'|'none'|'always'`, `tone`; renders number as an LTR run + symbol as a separate run; exposes an Arabic `accessibilityLabel`), `AmountInput` (display + `Keypad`), `Keypad` |
| Forms | `Field` (label above, helper, error, LTR option), `Segmented`, `Switch` row, `DateField`, `PickerRow` (inline-expanding list), `CategoryPicker`, `AccountPicker`, `IconPicker`, `PeriodPicker` |
| Overlays | `Sheet` (detents, drag-dismiss, keyboard avoidance, dirty-guard, `accessibilityViewIsModal`; build with what the repo already has — verify library/Reanimated availability before choosing), `ConfirmDialog`, `Toast` host (queue, action button, auto-dismiss) |
| Data display | `ListRow`, `SectionHeader`, `SplitLine`, `FilterSummary`, `StatusLabel` (icon + word + tone) |
| States | `EmptyState`, `ErrorState` (message, retry, optional short correlation ID), `OfflineNotice`, `SkeletonRows` |
| Domain hooks | `useDashboard`, `useAccounts(includeArchived)`, `useCategories`, `useTransactions(filters)` (infinite), `useCommitments(status)`, `useBudgets`, `useProfile`, plus mutation hooks (each declares its invalidations) |
| Libraries (pure, unit-tested) | `money.ts` (exact decimal ops on 2-dp strings — integer-cents or the repo's existing decimal lib; **no float math for money**), `format.ts`, `names.ts`, `dates.ts` (user-timezone), `plural.ts`, `errors.ts`, `payloads.ts` (typed builders that emit only DTO fields), `splitLine.ts` |

**Must stay consistent everywhere:** `Money` for every amount; `Sheet` for every form; `ConfirmDialog` for every confirmation; `Toast` for every success; `ErrorState`/inline field errors for failures. **Custom composition allowed:** Home layout, S11 composer, S10a explainer, Split Line labeling.

---

## 10. Data, State & Interaction Rules

### 10.1 Query layer
Use the data-fetching approach already in the repo; if none provides caching, invalidation, request cancellation, and stale-while-revalidate, adopting TanStack Query is justified (document it). Query keys: `['dashboard']`, `['accounts', {includeArchived}]`, `['categories']`, `['transactions', filters]` (infinite), `['transaction', id]`, `['commitments', status]`, `['budgets', {includeArchived}]`, `['profile']`.
- **Commitments:** "active" = `status=OVERDUE` ∪ `status=PENDING`, fetched as two parallel requests and merged (the list endpoint auto-promotes past-due PENDING to OVERDUE before returning **[V]**). `PAID`/`CANCELLED` are fetched lazily.
- **Freshness:** `staleTime` 60s for dashboard/accounts/commitments/budgets; categories 10 min; transactions 30s. Refetch on screen focus when stale, on app foreground (> 60s away), and on network reconnect. No polling.
- **Cache persistence:** persist read caches (non-sensitive financial snapshots) for offline display only if the repo already has/justifies secure local storage; never persist tokens outside secure storage. Clear all caches on sign-out.

### 10.2 Auth & token lifecycle (critical)
- Store tokens only in secure storage (`expo-secure-store` or the repo's existing secure store).
- **Single-flight refresh:** at most one `/auth/refresh` in flight app-wide. All 401s (and foreground-resume proactive refreshes) await the same promise. **Persist the new refresh token before releasing queued requests.** Reason: reusing a rotated token revokes every session **[V]**.
- Proactively refresh when the access token is within 60s of expiry (decode `exp`; do not rely on the 900s value only).
- Never retry `/auth/login` or `/auth/refresh` on 401. Retry the original request once after a successful refresh. Refresh failure with 401 → clear tokens → S03 with the "سجّل دخولك تاني" message. Refresh failure from network error → **do not** clear tokens; surface offline state.
- 429 on auth routes: show cooldown; never auto-retry in a loop.
- Add `x-correlation-id` (UUID) to every request; log it on errors; show its first 8 chars only inside `ErrorState` details for 5xx/unexpected errors.

### 10.3 Mutation → invalidation matrix
| Mutation | Invalidate |
|---|---|
| Create/update/delete transaction, batch create | `dashboard`, `accounts`, `transactions`, `budgets`, `commitments` (delete can restore a commitment) |
| Pay commitment | `commitments`, `dashboard`, `accounts`, `transactions`, `budgets` |
| Create/update/delete commitment | `commitments`, `dashboard` |
| Create/update/delete budget | `budgets` |
| Create/update/archive/delete account; toggle protection | `accounts`, `dashboard` (and `transactions` filters list if archived) |
| Create/update/archive/delete category | `categories`; on rename also `transactions`, `budgets` |
| Update profile | `profile`; if `currency` changed → everything |

### 10.4 Reliability protocols
- **No optimistic financial updates.** Financial figures and balances change only after server success. Allowed local-only immediacy: pressed states, spinners, keypad echo, form validation. (The one optimistic-looking element — the Undo toast — acts only after server success.)
- **Duplicate-submission guard:** a mutation in flight locks its form/button; the client-side lock is in addition to the backend's pay-commitment lock **[V]**.
- **Ambiguous outcome protocol** (timeouts/network drops *after* sending a create/batch/pay): the backend has no idempotency keys, so do **not** auto-retry and do not clear the form. Show "مش متأكدين إن العملية اتسجلت". On user retry, first refetch transactions page 1 (or the commitment) and look for a match (same type, amount, account, note, created within the last 5 minutes); if found, offer "اتسجلت فعلاً" (close) vs "سجّلها تاني".
- **Stale/out-of-order responses:** cancel in-flight list requests when filters change (AbortController/library cancellation) and ignore responses whose filter signature isn't current.
- **Search/filter debounce:** none needed (explicit apply); keypad updates are local.
- **Preserve input** on every failure; never clear a form on error.
- **Backgrounding:** sheets keep in-memory state; on foreground refetch silently.
- **Pagination:** reset to page 1 after any mutation; de-dupe by id.

### 10.5 Error mapping (never show raw English to users)
Map by status, then by **message substring** (stable text from the Report); put the raw message and short correlation ID under "تفاصيل" only for unexpected errors.
| Status / substring | Arabic message / UI |
|---|---|
| network / timeout | "مفيش اتصال — حاول تاني" (+ ambiguous protocol for creates) |
| 400 validation array (`amount must…`, `accountId must…`) | inline field errors by property-name prefix (`amount`→المبلغ, `accountId`→الحساب, `email`, `password`, `name`…) |
| 401 on login "Invalid email or password" | "الإيميل أو كلمة السر غلط" |
| 401 "Invalid refresh token"/"Refresh token has expired" | S03 "سجّل دخولك تاني" |
| 409 "already exists" (email) | "الإيميل ده مسجّل قبل كده" |
| 409 "already exists" (account name) | "الاسم ده مستخدم" |
| 400 "Cross-currency transfers are not supported" | "مش ممكن تحوّل بين حسابين بعملتين مختلفتين" |
| 400 "already been marked as paid" | "الالتزام ده اتسدّد قبل كده" + refetch |
| 400 "Cannot permanently delete an account with recorded transactions" | "الحساب عليه معاملات — أرشفه بدل الحذف" + archive action |
| 400 "…linked to commitments" | "الحساب مرتبط بالتزامات — أرشفه أو فكّ الربط" |
| 400 "Cannot delete category with associated…" | "التصنيف ده مستخدم — أرشفه بدل الحذف" |
| 403 "System default categories…" | "التصنيفات الأساسية مش بتتعدل" |
| 404 account/category/transaction | refetch relevant lists + "العنصر ده مبقاش موجود" |
| 429 | cooldown message (auth) / "استنى شوية وحاول تاني" |
| 5xx | "حصلت مشكلة عندنا — حاول بعد شوية" + details |

---

## 11. Motion Design

Principles: motion explains cause and effect, never delays an action, and never animates a number toward a value the server hasn't confirmed. Prefer opacity/transform on the UI thread (Reanimated if present — verify); animate layout only in the specific places listed.

| Motion | Trigger | Behavior | Duration / easing | Layout? | Interrupt | Reduced motion |
|---|---|---|---|---|---|---|
| Tab switch | tab press | crossfade content | 120ms ease-out | no | immediate | instant |
| Stack push/pop | navigation | platform-native transition, RTL-mirrored | native | no | native gesture | platform default |
| Sheet present | open | translateY from bottom + scrim fade | spring (damping ≈ 28, stiffness ≈ 300), no overshoot; scrim 200ms | no | drag takes over | 120ms fade |
| Sheet dismiss | drag/scrim/close | follows finger; release by velocity | 220ms ease-out | no | re-grab | 120ms fade |
| Button press | touch | scale 0.98 + slight tint; release back | 80ms in / 120ms out | no | any | tint only |
| Segmented / chip select | tap | indicator slides; no content jump | 180ms ease-out | no | retarget | instant |
| Inline expand (pickers, collapsed sections) | tap | height + content fade, scoped to that section | 200ms ease-in-out | **yes, local only** | reversible | instant |
| New list row | created and visible at top | fade + 8dp slide-down | 160ms ease-out | local | skip if off-screen | none |
| Removed row | delete confirmed by server | fade then collapse | 180ms | local | n/a | instant |
| Split Line update | **new server data arrived** | segment widths ease from previous to new | 350ms ease-out; first mount of session: no animation | no (width of a child) | retarget | instant |
| Money value change | server data changed | 120ms crossfade at most; **no count-up** | 120ms | no | n/a | instant |
| Skeleton | loading | opacity pulse 0.6↔1 | 1.2s loop | no | stops on data | static |
| Field error | validation fails | border color + message fade in; **no shake** | 120ms | small | n/a | instant |
| Toast | success | slide up 12dp + fade; auto-dismiss 4s (6s with Undo) | 200ms ease-out | no | swipe/Undo | fade only |
| Dialog | confirm needed | fade + scale 0.96→1 | 160ms ease-out | no | n/a | fade |
| Voice listening (if built) | recording | level indicator opacity/scale only | ≤ 60fps | no | stop cancels | static dot |

**Never:** animate a transaction into a "success" state before 201/200; delay closing a sheet for a celebratory animation; animate the whole screen on each state change; animate numbers digit-by-digit.
Performance: animations run on the UI thread where possible, no per-frame React state updates, must hold 60fps on a mid-range Android device (verify; report measured device).

---

## 12. Haptic Feedback

Use `expo-haptics` **if present or justified [U]**; wrap in a single `haptics.ts` that (a) no-ops on web/unsupported devices, (b) catches all errors, (c) respects the Settings → الاهتزاز switch (default on).

| Moment | Haptic | Why |
|---|---|---|
| Segmented control / picker selection changes (type, account, category, filters) | `selection` | confirms a discrete choice |
| **Server-confirmed** create / batch / pay success | `notification: success` | meaningful completed action |
| Submission failure shown to the user (once per attempt) | `notification: error` | signals nothing was saved |
| Server-confirmed delete | `impact: medium` | neutral confirmation of an irreversible action |
| Destructive dialog opening | none | avoid alarm; copy carries the weight |

**Prohibited:** keypad digits, scrolling, list taps, tab switches, pull-to-refresh results, background refresh, toasts, skeletons, repeated validation errors, any haptic before the server confirms. Degrade silently when unavailable.

---

## 13. Arabic, RTL & Localization

### 13.1 Direction
Force RTL for the whole app regardless of device language. In React Native this requires enabling RTL support (`I18nManager.allowRTL(true)` / `forceRTL(true)`) and an app reload on first launch — implement the reload using what the project supports (Expo Updates reload or the dev-client equivalent) and verify on a production-like build, not just Expo Go **[U]**. Declare RTL support in native config only as an additive change, and report it.

### 13.2 Numbers, currency, dates
- Western digits, `,` thousands, `.` decimals, always 2 decimals for money (from server strings — **do not round**).
- Currency symbol **after** the number: `1,250.50 ج.م`. Symbols: EGP `ج.م`, USD `$`, EUR `€`, SAR `ر.س`, AED `د.إ`, KWD `د.ك`, GBP `£`; unknown → ISO code.
- Negative: U+2212 `−` immediately before the digits inside the LTR number run. Positive income: `+`.
- Render number and symbol as separate `Text` runs in a row (number run forced LTR via `writingDirection: 'ltr'` and, where a single string is unavoidable, Unicode isolates U+2066…U+2069) so bidi reordering cannot flip `−`, `.`, or `,`.
- Dates: Gregorian, Arabic month/day names, Western digits (e.g., "الأحد 18 أكتوبر 2026"). Prefer `Intl` with `ar-EG-u-nu-latn` **if Hermes in this SDK supports it [U]**, otherwise a local name table. All day-grouping, "today/yesterday", month boundaries use the **user's profile timezone**.
- Amount **input** accepts Western and Arabic-Indic digits and `٫`/`,`/`.` and normalizes before parsing.

### 13.3 RTL mechanics
- Logical style props only; flex rows flip automatically; mirror **directional** icons (chevrons, back, transfer arrow) via a `mirror` prop on `Icon`; do **not** mirror non-directional icons or the numeric keypad.
- Progress/Split Line fills from the inline-start (right) edge.
- Email, password, amount, and any LTR value inputs: `writingDirection: 'ltr'`, left-aligned text, label above in Arabic; Arabic free text (notes, names) aligns to the right.
- Swipe-back direction, tab order, and sheet-close buttons (leading side in RTL = right) must be checked on both platforms.

### 13.4 Bilingual names
Seeded names combine languages in one string (`"كاش / Cash"`, `"البنك الأهلي المصري / NBE"`, `"Groceries / بقالة ومستلزمات"`) **[V Report §3, §4, §16]**. Implement `displayName(name)`: split on `" / "`; if two segments, show the segment containing Arabic letters; else show the whole string. **Display only — never write a transformed name back to the API.** Long Arabic names truncate with ellipsis in rows and wrap in details. Use the same function in pickers, rows, filters, toasts, and dialogs.

### 13.5 Plurals & tone
Egyptian-friendly, short, calm; no formal-legalese; no exclamation marks except for genuine success. Plural helper (`plural.ts`): 1 → singular; 2 → dual (يومين، معاملتين، التزامين); 3–10 → "N + plural" (أيام، معاملات، التزامات); ≥ 11 → "N + singular" (يوم، معاملة، التزام). All strings live in `strings.ar.ts` (no inline Arabic in components) so future languages are possible without refactors.

### 13.6 Microcopy glossary (use consistently)
تقدر تصرف كام؟ · الرئيسية · المعاملات · الخطة · الحسابات · مصروف · دخل · تحويل · سجّل · سدّد · حفظ · إلغاء · احذف · تعديل · أرشفة · استرجاع · الالتزامات · الميزانيات · متأخر · جاي · اتسدّد · ملغي · كاش · حساب بنكي · مدخرات · محفظة موبايل · مرة واحدة · يومي · أسبوعي · شهري · سنوي · "اتسجّل" (success) · "حاول تاني" (retry) · "بدون تصنيف" · "حساب محمي".

---

## 14. Cross-Cutting States

| State | Rule |
|---|---|
| Loading (first) | skeletons matching the final layout; never a blank screen or a lone spinner (spinners only inside buttons and footers) |
| Refreshing | content stays; native pull-to-refresh indicator |
| Empty | one sentence + one action; never illustrations |
| Error (first load, no cache) | `ErrorState` with retry; S90 if network |
| Error (refresh with cache) | keep content, show slim notice |
| Offline | cached read-only; mutating controls disabled with "محتاج اتصال" |
| Partial data (e.g., dashboard ok, commitments failed) | render what succeeded; the failed section shows its own retry row |
| Success | toast (+Undo only where specified), never a blocking modal |
| Session expired | S03 with message; no data left visible after sign-out |

---

## 15. Backend Endpoint Mapping (screen → API)

Mirror the Report's §10 TypeScript contracts verbatim into the project's contracts location; build requests only through `payloads.ts` so that **only whitelisted DTO fields** are sent (extra fields → 400). Base URL from the existing env mechanism (`EXPO_PUBLIC_API_URL` pattern in the Report); all routes under `/api/v1`.

| Screen | Call(s) |
|---|---|
| S00 | `POST /auth/refresh` (if needed), `GET /auth/me` |
| S02 | `POST /auth/register` → `GET /accounts` |
| S03 | `POST /auth/login` → `GET /accounts` |
| S04 | `GET /accounts`, `DELETE /accounts/:id`, `POST /accounts` |
| S10 / S10a | `GET /dashboard/summary`; `GET /commitments?status=OVERDUE`, `?status=PENDING`; `GET /accounts` |
| S11 | `GET /accounts`, `GET /categories?type=…`, `POST /transactions`, `PATCH /transactions/:id`, `DELETE /transactions/:id` (undo) |
| S12 | `POST /transactions/batch` |
| S20 / S21 / S22 | `GET /transactions?type&accountId&categoryId&startDate&endDate&page&limit`, `GET /transactions/:id`, `DELETE /transactions/:id` |
| S30 / S31 / S32 / S33 | `GET /commitments?status=…`, `GET/PATCH/DELETE /commitments/:id`, `POST /commitments`, `POST /commitments/:id/pay` (`{accountId, paidAt?, note?}`) |
| S30 / S34 / S35 | `GET /budgets`, `GET /budgets/:id`, `POST/PATCH/DELETE /budgets` |
| S40 / S41 / S41a / S42 | `GET /accounts?includeArchived`, `GET/PATCH/DELETE /accounts/:id`, `POST /accounts`, `POST /transactions` (adjustment) |
| S50 / S53 | `GET/PATCH /users/profile`, `POST /auth/logout`, `GET /health` |
| S51 / S52 | `GET /categories`, `POST/PATCH/DELETE /categories/:id` |

**Payload rules:** amounts as JSON numbers with ≤ 2 decimals derived from validated decimal strings; dates ISO 8601 UTC; trim strings; omit undefined optional fields; `categoryId` omitted for TRANSFER; `PATCH /transactions/:id` only `{amount?, categoryId?, transactionDate?, note?}`; `PATCH /accounts/:id` never `initialBalance`; `PATCH /commitments/:id` status only `CANCELLED` from this UI.

---

## 16. Financial Correctness Rules

1. Never use JS floating-point for money arithmetic or comparison. Parse 2-dp strings into integer cents (or the repo's decimal lib); format back with exactly 2 decimals. Unit-test: `0.10 + 0.20`, large values (`999999999999.99`), negatives, rounding is **never** applied to server strings.
2. Display server figures verbatim (`safeToSpend`, `totalLiquidFunds`, `spent`, `remaining`, `monthlySummary`). Derived figures (balance after payment, adjustment diff, batch total, sums for S10a) use exact math and are labeled as derived.
3. Amount validation mirrors the backend: > 0, ≤ 2 decimals, ≤ 999,999,999,999.99.
4. Currency is inherited from the account; never let the user pick a currency for a transaction. Block cross-currency transfers and commitment payments in the UI (disable with reason); still map the server's rejection if it occurs.
5. Never show a balance change before the server confirms; after confirmation, refetch rather than patching balances locally.
6. Safe-to-Spend is the server's number. Explain it; never recompute it for display.
7. Deficit (`isDeficit`) must always be visible as text + icon + color.
8. Archive, don't delete, anything with history; mirror the backend's constraints with helpful copy, not raw errors.
9. Time: the user's profile timezone governs "today", month boundaries, and day grouping.
10. Preserve idempotency discipline (§10.4); no automatic retries for non-idempotent writes.

---

## 17. Accessibility & Performance

**Accessibility**
- Touch targets ≥ 48dp; spacing between adjacent targets ≥ 8dp.
- Every interactive element has `accessibilityRole`, an Arabic `accessibilityLabel`, and state (`selected`, `disabled`, `busy`). `Money` reads as "ألف ومئتين…" only if a reliable Arabic number-to-words helper exists; otherwise "1250 جنيه و50 قرش" (digits) with sign words "خصم"/"إضافة". Icons that carry meaning have labels; decorative icons are hidden.
- Logical focus order in RTL; sheets set `accessibilityViewIsModal` and return focus to the trigger on close; announce success/error with `AccessibilityInfo.announceForAccessibility`.
- Color never the sole signal (icon + word accompany every red/gold/green state). Contrast gate in §4.3.
- Dynamic type: layouts tested at 1.0×, 1.5×, and the OS maximum; no clipped or overlapping text; the Safe-to-Spend hero never truncates digits (fit-to-width).
- Reduced motion honored globally (§11). Screen-reader pass (TalkBack and/or VoiceOver) on S10, S11, S33.

**Performance**
- Lists virtualized with stable keys, memoized rows, no inline object/array props in row renderers, `getItemLayout` or the list library's equivalent where row heights are fixed.
- Keypad and form typing use local state; no global state updates per keystroke.
- No unnecessary re-renders of Home on unrelated query updates (selectors).
- Cold start to interactive Home (with cache) target ≤ 2.5s on a mid-range Android device; list scroll holds 60fps; report measured numbers and the device.
- No heavy dependencies for a single feature; no images except brand assets.

---

## 18. Testing & Verification

You must *run* these and report the results; do not merely write code.
1. **Static:** type-check, lint, build for iOS and Android (as far as the environment allows).
2. **Unit tests** (pure libs): `money`, `format` (digits, symbols, negatives, bidi), `names` (bilingual split, edge cases), `dates` (timezone, month boundaries, DST-free Cairo vs. other tz), `plural`, `errors` (substring mapping), `payloads` (whitelist: no extra fields; TRANSFER omits `categoryId`; PATCH shapes), `splitLine` (normal, zero, deficit, L ≤ 0, tiny segments).
3. **Integration against the real backend** (run locally per Report §16): read-only flows with the seeded demo user (`demo@flowsy.app`); **mutating flows only with freshly registered throwaway users** (never delete/alter the demo data; mind the 10 auth requests/min throttle — reuse sessions). Cover: register → S04 → Home; login/logout; create/edit/delete transaction (verify balance deltas); transfer; batch (valid + invalid); pay commitment (single and rapid double-tap → one transaction); recurring next occurrence; budget progress; account archive/delete guards; category guards; profile update.
4. **Auth resilience:** (a) corrupt the stored access token and fire 5 parallel requests → exactly **one** `/auth/refresh` call and all 5 succeed; (b) replay protection not triggered; (c) revoked refresh → S03; (d) airplane mode during refresh does not clear tokens.
5. **Failure drills:** offline launch with and without cache; timeout after sending a create (ambiguous protocol); 400/404/409/429/5xx rendering; backgrounding with a dirty sheet.
6. **Visual QA:** runtime screenshots of every screen (and its empty/loading/error/deficit states where applicable) at **360×640, 393×852, 430×932**, light and dark, font scale 1.0 and 1.5, RTL. Inspect them yourself and fix overlap, clipping, bidi, and contrast defects before reporting.
7. **Accessibility pass:** screen-reader traversal on S10/S11/S33; reduced-motion on; contrast script output attached.
8. **Regression inventory:** a table of every capability from §1.2 → screen → verified-by (test or manual run). Any row without evidence is reported as not done.

Deliver `docs/rebuild-report.md` containing: audit decisions, deviations from this document (with reasons), backend gaps, test evidence, screenshots index, measured performance, known issues.

---

## 19. Phased Implementation Sequence

**Phase 1 — Repository & contract audit.** Inspect repo, stack, SDK versions, navigation/data libraries, fonts, haptics/animation libs, secure storage, existing voice code. Validate the Report against the backend code where available (resolve §1.4 items). Produce `docs/rebuild-audit.md` (remove/replace/retain/migrate). *Exit:* audit file + list of resolved/unresolved [U] items.

**Phase 2 — Foundations.** Tokens, theme provider (light/dark), typography, RTL enablement (+ verified reload), `strings.ar.ts`, pure libs with tests (`money`, `format`, `names`, `dates`, `plural`, `errors`, `payloads`, `splitLine`), API client with single-flight refresh, contracts, primitives (`Screen`, `AppText`, `Button`, `Field`, `Icon`, `Money`, `ListRow`, `Sheet`, `ConfirmDialog`, `Toast`, states). Navigation shell with the four tabs and empty screens. *Exit:* unit tests green; a Storybook-like internal gallery screen (dev only, removed or gated before finish) shows components in light/dark/RTL.

**Phase 3 — Core experience.** S00–S04, S10/S10a, S11 (+ keypad), S20/S21/S22, S33 (pay). *Exit:* J1–J8 pass end-to-end against the real backend.

**Phase 4 — Remaining domains.** S30–S35, S40–S42 (+S41a), S50–S53, S90; S12 per its build rule. *Exit:* J9–J15 pass; capability inventory complete.

**Phase 5 — Interaction & motion.** Implement §11 motion, §12 haptics, reduced-motion paths, Split Line transitions, toasts with Undo. *Exit:* motion checklist verified on device/emulator; no animation precedes server confirmation.

**Phase 6 — Integration & resilience.** Failure drills, ambiguous-outcome protocol, offline behavior, invalidation matrix audit, auth resilience tests. *Exit:* §18 items 3–5 pass.

**Phase 7 — Quality assurance.** Visual QA matrix, accessibility pass, performance measurements, dead-code removal, final regression inventory, `docs/rebuild-report.md`. *Exit:* §20 satisfied or exceptions documented.

---

## 20. Objective Acceptance Criteria

1. Home shows Safe-to-Spend from `GET /dashboard/summary` exactly; deficit and zero states verified; no card stacks anywhere in the app.
2. All 25+ screens/states in §6 exist and match §7; no control without real behavior; no mock data or placeholder actions remain.
3. Every §1.2 capability is reachable in the UI (or listed in `docs/backend-gaps.md`/the report with a reason).
4. Create/edit/delete/transfer/batch/pay change balances exactly as the backend dictates (verified with before/after reads); no UI figure changes before server confirmation.
5. Exactly one refresh request under parallel 401s; session loss only on revoked/expired refresh tokens.
6. Arabic RTL correct on all screens: no flipped signs/decimals, no misordered mixed text, mirrored directional icons, keypad LTR, logical spacing.
7. Contrast script passes for all used pairs in both themes; color is never the only signal.
8. All errors in §10.5 render in Arabic with a recovery path; raw English never shown outside "تفاصيل".
9. Reduced motion and haptic opt-out work; haptics fire only per §12.
10. Layouts clean at 360×640 / 393×852 / 430×932, font scale 1.5, light/dark.
11. Unit and integration tests in §18 executed with results reported; known failures documented.
12. Brand assets (wordmark, app icon) unchanged; backend, schemas, env, native config unmodified except documented additive changes.
13. No dependency added without a recorded reason and compatibility check.

---

## 21. Final QA Checklist (tick each with evidence)

- [ ] Audit file lists every old frontend file's fate
- [ ] Backend untouched; no secrets in the repo or logs
- [ ] Tokens only in secure storage; sign-out clears cache/drafts even offline
- [ ] Money: no float math; server strings unrounded; unit tests green
- [ ] Safe-to-Spend, explainer, deficit, zero, no-accounts states verified
- [ ] Commitments: OVERDUE + PENDING both shown; pay once-only; next occurrence visible
- [ ] Transfer UI cannot select cross-currency destination
- [ ] Transaction edit never sends `type`/`accountId`; delete copy states exact balance effect
- [ ] Opening-balance flows (S04, S41a) behave and warn as specified
- [ ] Bilingual names display correctly; names are never altered on write
- [ ] Filters send correct ISO bounds in the user's timezone; pagination has no duplicates
- [ ] All lists virtualized; no console errors/warnings in key flows
- [ ] Screenshots reviewed at 3 sizes × 2 themes × 2 font scales
- [ ] Screen-reader pass on S10, S11, S33
- [ ] Offline/timeouts/429/5xx drills done
- [ ] Haptics and motion match §11–§12 and respect reduced motion/opt-out
- [ ] `docs/rebuild-report.md`, `docs/backend-gaps.md`, `docs/voice-decision.md` written

---

## Appendix A — Decisions to confirm with the product owner (defaults applied if unanswered)

1. **Opening balance of the auto-created Cash account (S04):** default = delete-and-recreate the untouched empty account with the right `initialBalance`. Alternative: leave it at 0 and use an adjustment transaction (pollutes monthly income). The default is applied only to an account verified untouched.
2. **Numerals:** default Western digits; Arabic-Indic available by changing `format.ts`.
3. **Voice entry:** preserved if it exists; otherwise built only after the §S12 feasibility check.
4. **Plan tab merges Commitments + Budgets:** default as specified; if the owner prefers a dedicated Budgets tab, Commitments must remain one tap from Home.
5. **Base-currency change exposed in Settings → متقدم** with a warning; remove if the owner prefers it locked.
6. **Future-dated transactions are blocked in the UI** (backend allows them; they would reduce balances immediately).
7. **No transaction text search** until the backend offers it.

## Appendix B — Research status of this document
This specification is grounded in the Report and in the owner's existing brand direction. **No external benchmarking or platform-guideline research was performed while writing it.** In Phase 1–2 the agent must verify (and cite in `docs/rebuild-report.md`) the current behavior of: Expo SDK/React Native RTL handling, `expo-haptics`, Hermes `Intl` support for `ar-EG`, tabular-figure support in the chosen Arabic font, bottom-sheet and keyboard-avoidance behavior on both platforms, and WCAG 2.2 target-size/contrast guidance — using primary documentation, and without copying any other product's identity.
