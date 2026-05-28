# Recur — Claude Instructions

## Project

React Native / Expo recurring expenses tracker. Expo Router, TypeScript, NativeWind v4, expo-sqlite, React Context + useReducer (no Zustand), date-fns, react-native-reanimated, @gorhom/bottom-sheet, react-hook-form.

## Stack Conventions

- **Styling:** NativeWind utility classes everywhere. **Never use `StyleSheet.create`** — it is banned. Use inline `style={{}}` only for: (1) Reanimated animated styles, (2) runtime-computed values that can't be expressed as static classes (e.g. dynamic `backgroundColor`, `shadowColor`). Never wrap these in `StyleSheet.create` — plain object inline only.
- **State:** `context/ExpenseContext.tsx` is the single source of truth. All mutations go through the context dispatcher after calling the DB helper.
- **DB:** All SQLite access goes through `db/expenses.ts` and `db/categories.ts`. Never query the DB directly from components.
- **Dates:** All date logic uses `date-fns`. No manual date arithmetic. Due is a day-of-month integer (1–31), not a full date string. `getDueDate(dueDay)` clamps to last day of month for short months.
- **Icons:** `@expo/vector-icons` (Ionicons / Feather) only. No emojis as icons. Use `FeatherIconName` (`keyof typeof Feather.glyphMap`, exported from `types.ts`) for all Feather icon name values — never `string`. The only permitted `as FeatherIconName` cast is at external boundaries (SQLite reads, URL params).
- **Forms:** `react-hook-form` with `Controller` for every form field. Save button disabled when `!isValid`.
- **Animations:** `react-native-reanimated` for all animations. No `Animated` API from React Native core.
- **Bottom sheets:** `@gorhom/bottom-sheet` (`BottomSheetModal`). No plain `Modal` for primary flows.

## Data Model

```ts
type Recurrence = 'weekly' | 'monthly' | 'yearly' | 'one-off';
type Status = 'unpaid' | 'paid';

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDay: number;        // 1–31, anchor day of month
  recurrence: Recurrence;
  status: Status;        // default: 'unpaid'
  notes?: string;
  createdAt: string;
}
```

## Business Rules

- Expenses always sorted ascending by `dueDay`.
- Overdue = `status === 'unpaid' && getDueDate(dueDay) < startOfToday()`. Never auto-change status — only show red warning.
- Mark paid on a recurring expense: status flips to `paid`. Stays paid until user resets it next cycle.
- One-off expenses stay paid permanently.
- KPI totals (Total / Paid / Unpaid) are computed from the in-memory expenses array — no extra DB query.
- Swipe-to-delete via `react-native-gesture-handler` `Swipeable`. Confirm with `Alert` before deleting.

## Design Tokens

```
bg:       #161618
surface:  #1C1C1E
primary:  #6366F1
secondary:#818CF8
paid:     #34D399
overdue:  #F87171
text:     #FFFFFF
border:   rgba(255,255,255,0.07)
```

Fonts: Caveat (headings) + Quicksand (body) via `@expo-google-fonts`.

## Folder Structure

```
app/_layout.tsx          # Root: GestureHandlerRootView, BottomSheetModalProvider, fonts
app/index.tsx            # Main screen
components/              # All UI components
context/ExpenseContext.tsx
db/schema.ts             # initDB() — run once on mount
db/expenses.ts           # getAll, insert, updateStatus, remove
db/categories.ts         # getCustom, insertCustom
utils/dateHelpers.ts     # getDueDate, isOverdue, formatDue
utils/categories.ts      # PRESET_CATEGORIES
constants/theme.ts       # Color tokens (mirrors tailwind.config.js)
types.ts                 # Shared TS types
```

## Workflow Rules

- **Always** invoke the `superpowers:using-superpowers` skill at the start of every session before taking any action.
- ⚠️ **Always** invoke the `superpowers:dispatching-parallel-agents` skill (via the Skill tool) before executing ANY plan with 2+ tasks. Never run independent work sequentially. This applies even if tasks look small.
- **Any UI/component work** — invoke `web-component-design` skill before implementation.
- **Any visual/design work** (new screens, redesigns, styling) — invoke `frontend-design` skill before implementation.

## Planning Rules

- Every plan must include ALL of the following sections — **skipping any one is a failure**:
  1. **TL;DR** — 2–3 sentence summary of what's changing and why.
  2. **ASCII layout** — for any UI change, ASCII mockup of the new screen/component. Show before + after. Mandatory for all UI/visual changes.
  3. ⚠️ **Executor prompt** ⚠️ — A self-contained copy-paste prompt with FULL context (repo path, file paths, tech constraints, task list) ready to hand to a fresh executor agent that has zero prior context. **THIS IS MANDATORY. DO NOT SKIP. DO NOT FORGET.** Use `superpowers:dispatching-parallel-agents` for any independent steps inside the prompt.
  4. **Implementation steps** — numbered, with file paths and complexity tags `[low]` / `[med]` / `[high]`.
  5. **Verification** — bullet list of how to confirm the change works end-to-end.
- Default execution: **subagent-driven** (`superpowers:subagent-driven-development`). **Never ask which execution approach to use.** Never present "Option 1 / Option 2" execution choices. Always proceed directly to subagent-driven after plan approval — this overrides any skill that asks for execution preference.
- **Never commit during plan execution.** Write code only. User commits manually.
- After execution is confirmed working, **delete the plan file** from `.claude/plans/`.
- Plan files live at `.claude/plans/<slug>.md`. Never leave stale plans around.

## Preset Categories

Housing, Utilities, Subscriptions, Insurance, Transport, Food, Health, Other
(Users can add custom categories — stored in SQLite `categories` table.)
