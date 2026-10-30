# Design System: Recur

**Skill:** stitch-design-taste, adapted to a native React Native app (Expo Router, NativeWind v4, dark only).
Sizes are in dp. NativeWind's rem is 14 on native (`text-sm` is 12.25px, `w-9` is 31.5dp), so shared
primitives use explicit px values. Code conventions live in `CLAUDE.md`; this file owns the visual language.

## Configuration

| Dial | Level | Why |
|------|-------|-----|
| **Creativity** | `4` | A personal ledger. Personality comes from Oswald numerals and one indigo accent, not layout experiments. |
| **Density** | `6` | Lists are the product. Rows are 56dp so a phone screen shows a dozen of them. |
| **Variance** | `2` | One predictable column. People scan amounts here; they do not explore layouts. |
| **Motion Intent** | `3` | Motion only for feedback and state change: list entry, swipe, sheets. No idle loops. |

## 1. Visual Theme & Atmosphere
A dark, quiet ledger. Near-black canvas, white numerals, and color that appears only when it means
something: mint when money arrives or a bill is paid, coral when something is late, indigo for cards,
loans and the one primary action. Lists run full-bleed and borderless so the eye travels down the amounts,
not around boxes. Elevated surfaces (KPI tiles, balance heroes, sheets) are rare, which is exactly why
they read as important.

## 2. Color Palette & Roles
- **Ledger Black** (#161618): canvas behind every screen and every list row.
- **Raised Graphite** (#1C1C1E): elevated containers only (KPI tiles, hero balances, inputs, sheets).
- **Hairline** (rgba(255,255,255,0.07)): 1px border on elevated containers.
- **Ink** (#FFFFFF): titles, amounts, headings.
- **Secondary Graphite** (rgba(255,255,255,0.65)): meta lines, captions, secondary copy.
- **Muted Graphite** (rgba(255,255,255,0.50)): tertiary text, ended or de-emphasized rows.
- **Indigo** (#6366F1) with **Periwinkle** (#818CF8): the single accent family. Primary buttons, active tab,
  links, and the "card, loan, charged" signal.
- **Mint** (#34D399): signal only. Money in; "paid" at the summary level (KPI tile, band header, Pay action).
- **Coral** (#F87171): signal only. Late, overdrawn, destructive.

Rules:
- One accent family. Indigo is the existing brand and stays, always flat: no glows, no gradients, no neon.
- Mint and coral are states, never decoration.
- Tints are a signal color at 15% for icon tiles and 6 to 10% for tinted panels.
- Categories never get their own colors. A neutral tile plus a glyph identifies them.
- Never pure black (#000000).

## 3. Typography Rules
- **Display: Oswald Medium.** Tab titles 28px, detail titles and day numbers 22px, hero balances 32 to 34px.
  Condensed, so large numbers stay narrow.
- **Amounts: Oswald Regular.** 16px in list rows, 17px in cards. Band totals use Oswald Medium 13px.
- **Body: Quicksand** 400, 500, 700. Row titles 14px bold, body 14px, button labels 12.25px bold.
- **Meta: Quicksand Medium 10.5px.** Meta lines and captions.
- **Overline: Quicksand Bold 10.5px**, uppercase, wide tracking. Band headers and section labels only.
- **Banned:** Inter, any serif, the system default font, monospace.

## 4. Component Stylings

### List Row (`components/ui/AppListRow.tsx`)
The one row for every money item: expenses, card bills, income, interest, transfers, bill payments, loans,
account transactions. Never hand-build another row.

```
[tile]  Title                                  Amount
        Meta                                  Caption
```

- **Frame:** full-bleed, 56dp minimum height, 17.5dp side gutters, 10.5dp gaps, Ledger Black fill (opaque,
  so swipe actions stay hidden until revealed). No border, no card, no divider.
- **Tile:** 36dp square, 10.5dp radius, 17px Feather glyph. The glyph says what the money was for
  (`categoryIcon()` for categories; transfer, interest, card or person for the other kinds). The tint says
  direction or state.
- **Title:** Quicksand Bold 14px Ink, one line, truncates first.
- **Meta:** what or where, Quicksand 10.5px Secondary Graphite, one line, at most one " · " ("Housing · BPI").
  An optional periwinkle bell before it marks a reminder.
- **Amount:** Oswald 16px. Never truncated.
- **Caption:** when, or which state, 10.5px under the amount. Upcoming dates read "Today", "Tomorrow",
  "in 4 days", then "Nov 30". Late reads "3 days late" in coral. Settled reads "Paid Oct 21" in the neutral
  tone (the band or KPI already says paid, so a mint caption on every row would only repeat it) or
  "Charged Oct 21" in periwinkle. Ledger rows under a day header carry no date; they only flag "Charged".
- **Accessory:** optional trailing Muted Graphite glyph: chevron to drill in, trash for deletable rows.
- **Pressed:** opacity 0.7. A row with `onPress` is a button; without it, one accessible element with the
  full spoken label.

| Tone | Tile | Amount | Caption | Used for |
|------|------|--------|---------|----------|
| neutral | white 6% | Ink | Secondary Graphite | default |
| positive | Mint 15% | Mint | Mint | money in (income, interest, repayments, collected loans) |
| negative | Coral 15% | Coral | Coral | late |
| accent | Periwinkle 15% | Periwinkle | Periwinkle | card bills and charges, loans, people |
| muted | white 4% | Secondary Graphite | Muted Graphite | ended or not-due rows, transfer amounts |

- **Swipe (expense rows):** dragging right reveals Pay or Unpay (mint, 80dp); dragging left reveals Delete
  (coral, 80dp), which confirms with an Alert.

### Band Header
Overline label in its signal color, optional count and caption, total on the right. Collapsible bands
(Home months) add a chevron and announce expanded or collapsed.

### Day Header
Day number in Oswald 22px, weekday (Sunday coral, Saturday periwinkle, weekdays muted), month and year,
optional day total.

### Cards
Only where elevation communicates hierarchy: KPI tiles, hero balances, the loan summary, account cards.
14dp radius (21dp for account cards), Raised Graphite or a 10% tint, 1px Hairline. Never wrap list rows
in cards.

### Buttons (`AppButton`)
Primary: Indigo fill, Ink label. Tonal: Indigo 15% with a Periwinkle label. Ghost: Hairline outline.
Destructive: coral. 52dp tall, 10.5dp radius. One primary action per screen.

### Inputs (`AppTextInput`)
Label above, coral error text below, Raised Graphite field with a Hairline border, 52dp tall. Every field
is a react-hook-form `Controller`; Save stays disabled until the form is valid.

### Sheets
`@gorhom/bottom-sheet` modals, content-sized. No plain `Modal` for primary flows.

### Stats (`app/stats.tsx`)
The donut (`AppDonutChart`, built from Views since there is no SVG) and each row's 3dp share bar use `chartHues` by
rank within the period, biggest first, so a hue says which slice is which row and never belongs to a category. Past
the sixth, categories fold into one neutral slice. Row tiles stay neutral with a glyph. Amounts and labels stay in Ink
and Secondary Graphite.

### Empty and Loading States
Empty: one large muted glyph, a short title, one plain sentence, and the action that fills it when there
is one. Loading: `LoadingState` for whole screens only; lists never flash a spinner per row.

## 5. Layout Principles
- One column. 17.5dp side gutters on headers, cards and row content.
- Group with headers and whitespace (band headers, day headers), not boxes.
- Scroll views keep 140dp of bottom padding so the floating tab bar never covers the last row.
- Touch targets are at least 44dp.
- Money lists sort by date. Home shows Overdue first, then this month, then next month once it is at most
  7 days away.
- Home Overdue also lists unpaid dues and card bills from the last 3 months; their caption keeps counting "N days late".
- The Accounts tab keeps archived accounts in a collapsed "Archived" band under the grid: compact cards at 60%
  opacity, captioned "Archived". The net worth hero breaks down into Assets, Lent (only while someone owes you)
  and Owed under a hairline. The header's layers toggle (saved, carried in backups) groups active accounts into a
  band per bank, in account order, with accounts that have no bank last under "Other".
- The Recurring tab ends with a muted "Not due" band for plans with no cycle that month (not started yet,
  ended, or a yearly plan outside its month): counted, never totalled, captioned "Starts Nov 2026",
  "Ended Aug 2026" or "Every Mar 10".

## 6. Motion & Interaction
- `react-native-reanimated` only; never the core `Animated` API.
- Expense rows enter with FadeInDown, 300ms, staggered 40ms and capped at 8 rows. Reduced motion turns
  it off.
- Swipe actions track the finger with no overshoot.
- A just-paid row lingers for 1.2s showing "Paid" before it leaves its list.
- No perpetual loops, shimmer or pulsing. Every animation answers "what just changed?".

## 7. Anti-Patterns (Banned)
- Emojis anywhere, including as icons.
- `StyleSheet.create`.
- Cards around list rows, or status pills inside them.
- Dates squeezed into icon tiles.
- The same status signal on every row: a green check, a "Paid" pill or a mint caption repeated down a list
  says nothing the header has not already said.
- Rainbow category colors, or any color without a meaning.
- More than one " · " in a meta or caption line; decorative dots.
- Neon glows, gradient text, pure black.
- Em-dashes in UI copy.
- Inter, serif or system fonts.
