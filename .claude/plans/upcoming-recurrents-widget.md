# Plan — Android Home-Screen Widget: Upcoming Recurrents (Top 3)

## TL;DR
Add a native **Android home-screen widget** that shows the **top 3 soonest unpaid recurring expenses** (name · due label · amount). Built with `react-native-android-widget` (widget UI in JSX — no hand-written Kotlin/XML). The app computes the list from the existing in-memory `expenses` + context helpers, writes a small JSON snapshot to AsyncStorage, and calls `requestWidgetUpdate` on every data change; a periodic system refresh (~30 min) re-renders so relative due labels stay fresh. Tapping the widget deep-links to Home. Android only (repo has `android/`, no `ios/`).

## Decisions (locked)
- Platform: **Android only** (`react-native-android-widget`).
- Data: **top 3 soonest** unpaid, non-ended, recurring (skips one-off + already-paid-this-cycle + ended months).
- Tap: **open Home** (`recur://` deep link → `/`).
- Refresh: **on-change push + periodic ~30 min**.

## ASCII layout

Before: (no widget exists)

After — 2×2 home-screen widget, dark theme (`bg #161618`, `surface #1C1C1E`, text `#FFFFFF`, muted `rgba(255,255,255,0.5)`, accent `#818CF8`, overdue `#F87171`):

```
┌─────────────────────────────────┐
│  UPCOMING · RECUR               │   ← header, muted uppercase, accent dot
│                                 │
│  Netflix            in 2d   $15 │   ← name (white) · due (accent) · amount (white)
│  Rent               Jul 5  $1,2k│
│  Gym Membership     in 6d   $40 │
│                                 │
│  Updated 9:41 AM                │   ← tiny muted footer
└─────────────────────────────────┘

Empty state (nothing upcoming):
┌─────────────────────────────────┐
│  UPCOMING · RECUR               │
│                                 │
│        ✓  All clear             │
│     Nothing coming up           │
└─────────────────────────────────┘
```
- Overdue-but-unpaid items (if they fall in the soonest 3) show the due label in `#F87171`.

## Architecture / data flow
```
ExpenseProvider (expenses, monthStatuses change)
   └─ effect → updateWidgetSnapshot(expenses, {resolveExpensePaid})
                 ├─ compute top ~8 upcoming (utils/widgetData.ts)
                 ├─ AsyncStorage.setItem('@recur/widget', JSON)   // {updatedAt, items:[{id,name,amount,dueISO}]}
                 └─ requestWidgetUpdate({ widgetName:'Upcoming', renderWidget })
Widget headless task (WIDGET_ADDED / WIDGET_UPDATE / periodic / WIDGET_CLICK)
   └─ widget-task-handler.tsx → read AsyncStorage → renderWidget(<UpcomingWidget items/>)
        └─ UpcomingWidget filters dueISO>=today, takes 3, labels via formatDueDate() at render
Tap → clickAction OPEN_URI 'recur://' → app opens on Home
```
Snapshot stores **absolute `dueISO`** (not relative text) so periodic re-render recomputes "in Nd" without the app running. Paid-status may be up to one app-open stale — acceptable for a glance widget.

## Files (partitioned — no two agents share a file)
| Group | Files | Complexity |
|-------|-------|-----------|
| A. Native scaffold | `package.json` (deps + `main`), `app.json` (plugin), `index.js` (new entry) | [med] |
| B. Data logic | `utils/widgetData.ts` (new) | [med] |
| C. Widget UI | `widgets/UpcomingWidget.tsx`, `widgets/widget-task-handler.tsx` (new) | [med] |
| D. Context hook | `context/ExpenseContext.tsx` (add one effect) | [low] |
| E. Preview asset | `assets/widget-preview.png` (new) | [low] |

## Implementation steps
1. **[med] Native scaffold (Group A)**
   - `npm i react-native-android-widget @react-native-async-storage/async-storage`
   - `app.json` → add to `plugins`:
     ```json
     ["react-native-android-widget", {
       "widgets": [{
         "name": "Upcoming",
         "label": "Recur — Upcoming",
         "minWidth": "180dp", "minHeight": "110dp",
         "targetCellWidth": 2, "targetCellHeight": 2,
         "description": "Your next recurring expenses",
         "previewImage": "./assets/widget-preview.png",
         "updatePeriodMillis": 1800000
       }]
     }]
     ```
   - New `index.js` (project root), set `package.json` `"main": "index.js"`:
     ```js
     import 'expo-router/entry';
     import { registerWidgetTaskHandler } from 'react-native-android-widget';
     import { widgetTaskHandler } from './widgets/widget-task-handler';
     registerWidgetTaskHandler(widgetTaskHandler);
     ```
2. **[med] Data logic (Group B)** — `utils/widgetData.ts`:
   - `interface WidgetItem { id: string; name: string; amount: number; dueISO: string }`
   - `computeUpcoming(expenses, isUnpaid, limit=8): WidgetItem[]` — for each recurring (`recurrence !== 'one-off'`), scan months offset 0..2 from today via `getDueDateForMonth(dueDay, y, m)`; take the **first occurrence whose date >= startOfToday**, where `!isEndedOn(endYear,endMonth,y,m)` and `isUnpaid(e,y,m)`; push one item per expense; sort ascending by `dueISO`; slice `limit`.
   - `updateWidgetSnapshot(expenses, resolveExpensePaid)`: build items with `isUnpaid = (e,y,m) => !resolveExpensePaid(e,y,m)`, `AsyncStorage.setItem('@recur/widget', JSON.stringify({updatedAt:new Date().toISOString(), items}))`, then `requestWidgetUpdate({ widgetName:'Upcoming', renderWidget: () => <UpcomingWidget snapshot/> , widgetNotFound: () => {} })`. (Import the render lazily to avoid a cycle, or have the handler own rendering and here just `setItem` — see note.) **Note:** keep `requestWidgetUpdate`'s `renderWidget` identical to the task handler's by importing a shared `renderUpcoming(snapshot)` from `widgets/UpcomingWidget.tsx`.
3. **[med] Widget UI (Group C)**
   - `widgets/UpcomingWidget.tsx` — export `UpcomingWidget({snapshot})` using `FlexWidget`/`TextWidget` from `react-native-android-widget`; filter `items` to `dueISO >= startOfToday`, take 3, render rows; label via `formatDueDate(parseISO(dueISO))`, amount via `formatAmount`; empty → "All clear". Root `FlexWidget` `clickAction="OPEN_URI"` `clickActionData={{ uri: 'recur://' }}`, bg `#161618`, rounded. Export `renderUpcoming(snapshot)` helper returning `<UpcomingWidget snapshot={snapshot} />`.
   - `widgets/widget-task-handler.tsx` — `export async function widgetTaskHandler(props)`: read `@recur/widget` from AsyncStorage (`{items:[]}` fallback); on `WIDGET_ADDED`/`WIDGET_UPDATE`/`WIDGET_RESIZED` → `props.renderWidget(renderUpcoming(snapshot))`; `WIDGET_CLICK` handled by OPEN_URI (no-op here); `WIDGET_DELETED` no-op.
4. **[low] Context hook (Group D)** — in `ExpenseProvider`, add:
   ```ts
   useEffect(() => {
     if (state.loading) return;
     updateWidgetSnapshot(state.expenses, resolveExpensePaid);
   }, [state.expenses, state.monthStatuses, state.statementStatuses, state.accounts, state.loading]);
   ```
   Import `updateWidgetSnapshot` from `../utils/widgetData`. (Fire-and-forget; wrap in try/catch inside the util.)
5. **[low] Preview asset (Group E)** — add `assets/widget-preview.png` (~360×360 mockup of the widget; can be a simple dark card render or reuse/adapt `assets/icon.png`).
6. **Apply native + build** — `npx expo prebuild -p android --clean` (applies the widget config plugin to `android/`), then `npm run android`.

### Parallelization (subagent-driven)
Wave 1: **B** (defines snapshot shape/key) + **A** + **E** in parallel (distinct files).
Wave 2: **C** (needs lib + snapshot shape) + **D** (needs `updateWidgetSnapshot`) in parallel.
Wave 3: prebuild + run (manual, user's machine).

## Verification
- `npx tsc --noEmit` — no **new** errors vs baseline (baseline: global.css TS2882 + DraggableList SharedValue TS2694 ×4).
- `npx expo prebuild -p android --clean` succeeds; `android/app/src/main/AndroidManifest.xml` contains an `appwidget-provider` receiver for `Upcoming`.
- `npm run android` builds; long-press home screen → widget picker shows "Recur — Upcoming" with preview.
- Add widget → shows top-3 unpaid recurring by soonest due; matches Home "Upcoming" ordering.
- Mark a shown item paid in-app → widget drops it (on-change push).
- Wait for periodic tick (or force) → relative labels ("in Nd") recompute.
- Tap widget → app opens on Home.
- Empty case (all paid) → "All clear".

## Risks
- **RN 0.85 / Expo 56 compat**: `react-native-android-widget` is bleeding-edge-sensitive. Install latest; if peer/build fails, pin to its newest release and re-check new-arch support. Flag to user if incompatible.
- **AsyncStorage in headless task**: standard/supported by the library's examples; if reads fail in the task, fall back to `expo-file-system` sync `File` API.
- **`prebuild --clean`** regenerates `android/` — all native config lives in `app.json` so this is safe, but confirm no uncommitted manual native edits first.

---
## ⚠️ EXECUTOR PROMPT (copy-paste, zero prior context) ⚠️
```
You are implementing an Android home-screen widget in an Expo React Native app.

REPO: /Users/admin/Documents/personal/recur  (Expo SDK 56, RN 0.85.3, React 19, expo-router,
TypeScript, NativeWind v4 — but WIDGET UI uses react-native-android-widget's own components,
NOT NativeWind. expo-sqlite DB, React Context+useReducer.)

GOAL: A 2x2 Android widget "Upcoming" showing the TOP 3 SOONEST unpaid recurring expenses
(name · due label · amount). Tap opens the app on Home. Data pushed from app on change +
periodic 30-min refresh. Library: react-native-android-widget. Android only.

CONVENTIONS (from CLAUDE.md): async/await only (no .then); date logic via date-fns only;
FeatherIconName not string; no StyleSheet.create; reuse existing helpers, do not reinvent.
Never query DB from components — the widget reads an AsyncStorage snapshot the app writes.

REUSE THESE (already exist):
- utils/dateHelpers.ts: getDueDateForMonth(dueDay,year,month), isEndedOn(endYear,endMonth,year,month),
  formatDueDate(date), formatAmount(amount).  date-fns startOfToday/parseISO.
- context/ExpenseContext.tsx: useExpenses() → { expenses, resolveExpensePaid(e,y,m):boolean, ... }.
  State reducer holds state.expenses/state.monthStatuses/state.statementStatuses/state.accounts/state.loading.
- types.ts: Expense { id,name,category,amount,dueDay, recurrence:'weekly'|'monthly'|'yearly'|'one-off',
  endYear?,endMonth?, ... }.

DO THESE FILES (partitioned — safe to run in parallel where noted):

1) NATIVE SCAFFOLD:
   - Run: npm i react-native-android-widget @react-native-async-storage/async-storage
   - app.json: append to expo.plugins:
     ["react-native-android-widget", { "widgets": [{ "name":"Upcoming","label":"Recur — Upcoming",
       "minWidth":"180dp","minHeight":"110dp","targetCellWidth":2,"targetCellHeight":2,
       "description":"Your next recurring expenses","previewImage":"./assets/widget-preview.png",
       "updatePeriodMillis":1800000 }] }]
   - Create /index.js at repo root:
       import 'expo-router/entry';
       import { registerWidgetTaskHandler } from 'react-native-android-widget';
       import { widgetTaskHandler } from './widgets/widget-task-handler';
       registerWidgetTaskHandler(widgetTaskHandler);
     Change package.json "main" from "expo-router/entry" to "index.js".

2) utils/widgetData.ts (new):
   export interface WidgetItem { id:string; name:string; amount:number; dueISO:string }
   export interface WidgetSnapshot { updatedAt:string; items:WidgetItem[] }
   - computeUpcoming(expenses:Expense[], isUnpaid:(e,y,m)=>boolean, limit=8):WidgetItem[]
       today=startOfToday(); for each e where e.recurrence!=='one-off':
         for offset 0..2: y/m = today + offset months; d=getDueDateForMonth(e.dueDay,y,m);
         if d>=today && !isEndedOn(e.endYear,e.endMonth,y,m) && isUnpaid(e,y,m):
            push {id:e.id,name:e.name,amount: (current month amount — just use e.amount),
                  dueISO:d.toISOString()}; break (first future occurrence per expense).
       sort ascending by dueISO; return first `limit`.
   - export async function updateWidgetSnapshot(expenses, resolveExpensePaid): try/catch:
       const items = computeUpcoming(expenses, (e,y,m)=>!resolveExpensePaid(e,y,m));
       await AsyncStorage.setItem('@recur/widget', JSON.stringify({updatedAt:new Date().toISOString(), items}));
       await requestWidgetUpdate({ widgetName:'Upcoming',
         renderWidget: () => renderUpcoming({updatedAt:..., items}), widgetNotFound: () => {} });
     (import { requestWidgetUpdate } from 'react-native-android-widget'; import { renderUpcoming } from '../widgets/UpcomingWidget';)

3) widgets/UpcomingWidget.tsx (new): use FlexWidget, TextWidget from 'react-native-android-widget'.
   export function UpcomingWidget({ snapshot }:{snapshot:WidgetSnapshot}) — root FlexWidget:
     clickAction="OPEN_URI", clickActionData={{ uri:'recur://' }},
     style: { height:'match_parent', width:'match_parent', flexDirection:'column',
              backgroundColor:'#161618', borderRadius:16, padding:12 }.
     Header TextWidget "UPCOMING" (color rgba(255,255,255,0.5), fontSize 11, letterSpacing wide).
     const today=startOfToday(); const rows=snapshot.items.filter(i=>parseISO(i.dueISO)>=today).slice(0,3);
     if rows empty → centered TextWidget "All clear" + "Nothing coming up".
     else map rows → FlexWidget row (flexDirection:'row', justifyContent:'space-between'):
        name TextWidget (#FFFFFF, truncate), due TextWidget formatDueDate(parseISO(dueISO)) (#818CF8),
        amount TextWidget formatAmount(amount) (#FFFFFF).
     footer TextWidget "Updated " + time (muted) — optional.
   export function renderUpcoming(snapshot:WidgetSnapshot){ return <UpcomingWidget snapshot={snapshot} />; }

4) widgets/widget-task-handler.tsx (new):
   import AsyncStorage; import { renderUpcoming } from './UpcomingWidget';
   export async function widgetTaskHandler(props){
     const raw = await AsyncStorage.getItem('@recur/widget');
     const snapshot = raw ? JSON.parse(raw) : { updatedAt:new Date().toISOString(), items:[] };
     switch(props.widgetAction){
       case 'WIDGET_ADDED':
       case 'WIDGET_UPDATE':
       case 'WIDGET_RESIZED': props.renderWidget(renderUpcoming(snapshot)); break;
       default: break; // WIDGET_CLICK handled by OPEN_URI, WIDGET_DELETED no-op
     }
   }

5) context/ExpenseContext.tsx: add near other effects in ExpenseProvider (import updateWidgetSnapshot from '../utils/widgetData'):
     useEffect(() => { if (state.loading) return;
       updateWidgetSnapshot(state.expenses, resolveExpensePaid); },
       [state.expenses, state.monthStatuses, state.statementStatuses, state.accounts, state.loading]);
   (resolveExpensePaid is the useCallback already defined above this effect — place the effect AFTER it.)

6) assets/widget-preview.png (new): a ~360x360 dark preview image of the widget (simple mockup ok).

VERIFY: npx tsc --noEmit → no NEW errors beyond baseline (global.css TS2882 + 4 DraggableList
SharedValue TS2694). Do NOT run prebuild/build (the user runs `npx expo prebuild -p android --clean`
then `npm run android`). Report any react-native-android-widget peer/compat error with RN 0.85.

DO NOT commit. Report a short summary of each file changed.
```
