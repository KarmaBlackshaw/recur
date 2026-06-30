---
name: add-form-focus-chain
description: Auto-focus chain in the Add/Edit Expense form — Name → Amount → Category sheet → Due Day, with an inline "Next: Category" button (no floating keyboard bar)
metadata:
  type: project
---

# Add/Edit Expense — auto-focus chain

## What was built (final)
Sequential field focus in [app/expense/add.tsx](../../app/expense/add.tsx):
- **Name** `returnKeyType="next"` + `submitBehavior="submit"` (RN 0.85 replacement for deprecated `blurOnSubmit={false}`) + `onSubmitEditing` → focuses **Amount** (`amountRef`). Variable checkbox sits between them but is a TouchableOpacity (not focusable) so it's skipped naturally.
- **Amount** keyboard is `decimal-pad` → **no return/next key**, so there is NO auto-advance from Amount. (An inline "Next: Category →" button was tried then **removed at user request** — see lesson below.) User taps the Category row manually.
- **Category** picked → sheet auto-dismisses → on `onDismiss` focus **Due Day** (`dueDayRef`), gated by `pendingDueFocus` ref so cancel (X/backdrop) does NOT steal focus. Recurring only — regular/one-off has no Due Day, chain stops at Category.

## Current state (after removal)
The Amount→Category advance affordance was **removed at user request**. Surviving chain: Name → (return) → Amount auto-focus; and Category pick → Due Day focus (via sheet `onDismiss` + `pendingDueFocus`). `amountFocused` state and all its `onFocus` handlers were deleted. `amountRef`/`dueDayRef`/`pendingDueFocus` remain.

## THE key lesson (kept for future): don't float a tap target outside the ScrollView while the keyboard is up
Two earlier attempts used a floating `KeyboardNextBar` (a `Keyboard`-listener-driven absolute View, sibling of the ScrollView). **Both failed — the tap never reached the button.** Root cause: while the soft keyboard is open, the first tap *outside* the focused input is consumed by the OS dismissing the IME (and on Android `adjustResize` the window resizes out from under the finger), so a touchable that lives OUTSIDE the ScrollView never gets its `onPress`. `keyboardShouldPersistTaps="handled"` fixes this **but only protects touchables INSIDE that ScrollView**.
- **Fix:** move the Next control inside the ScrollView (which already has `keyboardShouldPersistTaps="handled"`). Tap is delivered reliably, keyboard persists, `present()` runs. No keyboard-height math, no `Platform.OS` branch, no blur race. `KeyboardNextBar.tsx` was deleted.
- Red herring #1: blur-unmount race (Amount `onBlur` → `setAmountFocused(false)` unmounted the bar before press). Real for the floating bar but not the actual blocker — fixing it alone didn't help.
- Red herring #2: positioning. Android manifest IS `adjustResize` (verified `android/app/src/main/AndroidManifest.xml`), so `bottom:0` placed the bar correctly above the keyboard — it was visible, just not tappable.
- If you ever genuinely need a control floating ON the keyboard cross-platform, that needs `react-native-keyboard-controller` (native dep + rebuild); `InputAccessoryView` is iOS-only.

## Other decisions kept
- **Due-Day focus on `onDismiss`, not setTimeout.** Added `onDismiss?: () => void` passthrough to [AppSelectBottomSheet.tsx](../../components/ui/AppSelectBottomSheet.tsx) (→ BottomSheetModal `onDismiss`) and [CategoryBottomSheet.tsx](../../components/CategoryBottomSheet.tsx).
- **[AppTextInput.tsx](../../components/ui/AppTextInput.tsx) now `forwardRef<TextInput>`** — needed to expose `.focus()`. Backward compatible.
- `amountFocused` state: set true on Amount `onFocus`, false on the `onFocus` of other text inputs (Name/DueDay/Notes/Reminder) and after tapping the Next button.

## Verify
Type Name → return jumps to Amount → "Next: Category →" button appears under the Amount field → tap → Category sheet opens → pick → Due Day keyboard pops (recurring expense).

## Baseline tsc noise (unchanged by this work)
`app/_layout.tsx` global.css TS2882 + DraggableList SharedValue TS2694 ×4 (the DraggableList ones carry a node_modules path, hidden by `grep -v node_modules`).
