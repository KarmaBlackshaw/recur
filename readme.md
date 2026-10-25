# Recur

A recurring expenses tracker built with React Native and Expo. Track monthly bills, subscriptions, and one-off expenses with a dark-first mobile UI.

## Features

- Track expenses by recurrence: monthly, yearly, or one-off, with optional start and end months
- Due day anchoring with smart month-end clamping
- Overdue detection with visual warnings
- Mark paid / reset per cycle
- KPI summary row: Total, Paid, Unpaid
- Custom categories with icon picker
- Month-by-month navigation
- Swipe-to-delete with confirmation

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
| Fonts | Caveat (headings) + Quicksand (body) |

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
npm run build:apk  # Android APK (EAS preview)
npm run build:aab  # Android AAB (EAS production)
```

Requires EAS CLI and an Expo account for cloud builds.

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
