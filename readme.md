# Recur

A recurring expenses tracker built with React Native and Expo. Track monthly bills, subscriptions, and one-off expenses with a dark-first mobile UI.

## Features

- Track expenses by recurrence: monthly, yearly, or one-off, with optional start and end months
- Due day anchoring with smart month-end clamping
- Overdue detection with visual warnings
- Pay a bill from the list (tap it on Home, the pay circle on Recurring, or a full swipe) with Undo; a Pay sheet records the real amount, date and account
- A bill screen per recurring expense: this month's status, payment history, edit and delete
- Home summary: left to pay this month, paid of total, overdue count
- Activity search across months, with lending kept separate from spending
- Editable, backdatable transfers and loan payments
- Reminders that name the bill, with a Mark paid action
- Custom categories, created right from the category picker
- Month-by-month navigation

## Stack

| Layer | Tech |
|---|---|
| Framework | Expo (SDK 56) + Expo Router |
| Language | TypeScript |
| Styling | NativeWind v4 (Tailwind) |
| Database | expo-sqlite |
| State | React Context + useReducer |
| Forms | react-hook-form |
| Animations | react-native-reanimated v4 |
| Bottom sheets | @gorhom/bottom-sheet v5 |
| Date logic | dayjs |
| Icons | @expo/vector-icons (Ionicons / Feather) |
| Fonts | Oswald (headings) + Quicksand (body) |

## Design Tokens

| Token | Value |
|---|---|
| Background | `#161618` |
| Surface | `#1C1C1E` |
| Primary | `#6366F1` |
| Secondary | `#818CF8` |
| Paid | `#34D399` |
| Overdue | `#F87171` |
| Text | `#FFFFFF` |
| Border | `rgba(255,255,255,0.07)` |

## Project Structure

```
app/
  _layout.tsx          # Root providers (GestureHandler, BottomSheet, fonts)
  index.tsx            # Main screen
  add-expense.tsx      # Add/edit expense form
  settings.tsx         # Settings screen
  settings/
    profile.tsx        # Profile settings
    category/          # Category management
components/            # UI components
context/
  ExpenseContext.tsx   # Single source of truth — all mutations here
db/
  schema.ts            # initDB() — run once on mount
  expenses.ts          # getAll, insert, updateStatus, remove
  categories.ts        # getCustom, insertCustom
  expenseMonths.ts     # Month-keyed expense data
  preferences.ts       # User preferences
utils/
  dateHelpers.ts       # getDueDate, isOverdue, formatDue
  categories.ts        # PRESET_CATEGORIES
  monthKey.ts          # Month key helpers
constants/
  theme.ts             # Color tokens
types.ts               # Shared TS types
```

## Getting Started

```bash
npm install
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator
```

### iOS Simulator

Needs Xcode (with an iOS simulator runtime) and CocoaPods.

```bash
brew install cocoapods                # once
npx expo run:ios -d "iPhone 17 Pro"   # once, and after native changes: builds + installs the debug app (ios/ is generated, not committed)
npm run start:wt -- --ios             # this checkout's Metro, with the simulator pointed at it
```

The iOS app's prebuilt React Native always looks for Metro on :8081, so with several checkouts running it can
load another one's code. `start:wt -- --ios` sets the simulator's bundler location to this checkout's port.

## Build

```bash
npm run build:apk      # Android APK (EAS preview)
npm run build:aab      # Android AAB (EAS production)
npm run build:ios-sim  # iOS Simulator build (EAS, no Apple account needed)
npm run build:ipa      # iPhone build for registered devices (EAS preview, needs an Apple Developer account)
```

Requires EAS CLI and an Expo account for cloud builds. Pushing to `master` builds the APK and the iOS Simulator
build (`.eas/workflows/build.yml`). Install the latest simulator build with `npx eas-cli build:run -p ios --latest`.

To get installable iPhone builds: join the Apple Developer Program, run `npm run build:ipa` once to sign in and
let EAS create the certificate and profile, register each iPhone with `npx eas-cli device:create`, then switch
`build_ios` in `.eas/workflows/build.yml` to the `preview` profile.

### App size

Android release builds ship `arm64-v8a` and `armeabi-v7a` only, run R8 and resource shrinking, and leave out
Fresco's GIF/WebP decoders (`app.json`, `plugins/`). Don't turn on Expo's experimental Metro tree shaking
(`EXPO_UNSTABLE_TREE_SHAKING`): it drops NativeWind's `global.css` import and the app renders unstyled.

Generated assets, committed alongside their sources:

```bash
node scripts/subset-fonts.mjs        # Oswald without Cyrillic/Greek + the Ionicons in constants/ionicons.ts
node scripts/generate-bank-logos.mjs # assets/banks/*.svg → @1x/@2x/@3x PNGs
```

## Data Model

```ts
type Recurrence = 'monthly' | 'yearly' | 'one-off';
type Status = 'unpaid' | 'paid';

interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;        // null shown as "TBD"
  dueDay: number;        // 1–31, anchor day of month
  recurrence: Recurrence;
  status: Status;
  notes?: string;
  createdAt: string;
}
```

## Preset Categories

Housing · Utilities · Subscriptions · Insurance · Transport · Food · Health · Other
