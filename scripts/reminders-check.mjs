import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { planReminders, reminderLead, billReminderLead } = await import("../utils/reminders.ts");

const bill = (title, dueDate, daysBefore) => ({ title, dueDate: new Date(dueDate), daysBefore });
const plan = (reminders, now = "2026-12-01T08:00", limit = 60) =>
  planReminders(reminders, "09:00", new Date(now), limit).map((fire) => ({
    at: fire.fireAt.toISOString(),
    daysBefore: fire.daysBefore,
    titles: fire.reminders.map((r) => r.title),
  }));
const at = (day) => new Date(`2026-12-${day}T09:00`).toISOString();

// A lead time adds an earlier reminder; the due day always reminds.
assert.deepEqual(plan([bill("Rent", "2026-12-20", 3)]), [
  { at: at(17), daysBefore: 3, titles: ["Rent"] },
  { at: at(20), daysBefore: 0, titles: ["Rent"] },
]);

// No lead: the due day still reminds.
assert.deepEqual(plan([bill("Rent", "2026-12-20", null)]), [{ at: at(20), daysBefore: 0, titles: ["Rent"] }]);
assert.deepEqual(plan([bill("Rent", "2026-12-20", 0)]), [{ at: at(20), daysBefore: 0, titles: ["Rent"] }]);

// Once the earlier reminder has passed, the due day's still fires.
assert.deepEqual(plan([bill("Rent", "2026-12-20", 3)], "2026-12-18T08:00"), [
  { at: at(20), daysBefore: 0, titles: ["Rent"] },
]);

// Bills firing at the same time share a notification only when they're due the same day, sooner due first.
assert.deepEqual(plan([bill("Rent", "2026-12-20", 1), bill("Water", "2026-12-21", 2), bill("Gym", "2026-12-21", 2)]), [
  { at: at(19), daysBefore: 1, titles: ["Rent"] },
  { at: at(19), daysBefore: 2, titles: ["Water", "Gym"] },
  { at: at(20), daysBefore: 0, titles: ["Rent"] },
  { at: at(21), daysBefore: 0, titles: ["Water", "Gym"] },
]);

// Only the soonest `limit` notifications are kept.
assert.deepEqual(plan([bill("Rent", "2026-12-20", 3), bill("Water", "2026-12-25", 1)], undefined, 2), [
  { at: at(17), daysBefore: 3, titles: ["Rent"] },
  { at: at(20), daysBefore: 0, titles: ["Rent"] },
]);

// Stored lead: null is the default day before, 0 is none; a card's lead wins for bills charged to it.
assert.equal(reminderLead(null), 1);
assert.equal(reminderLead(undefined), 1);
assert.equal(reminderLead(0), null);
assert.equal(reminderLead(7), 7);
assert.equal(billReminderLead({ reminderDaysBefore: 7 }, { reminderDaysBefore: 0 }), null);
assert.equal(billReminderLead({ reminderDaysBefore: 0 }, undefined), null);
assert.equal(billReminderLead({ reminderDaysBefore: 0 }, { reminderDaysBefore: null }), 1);

console.log("reminders-check: ok");
