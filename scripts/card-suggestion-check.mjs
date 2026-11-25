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
const { suggestCard } = await import("../utils/accounts/suggestCard.ts");

const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = new Date(2026, 10, 25, 9, 30);

const card = (id, statementDay, dueDay, extra = {}) => ({
  id,
  name: id,
  type: "credit",
  creditLimit: 50000,
  statementDay,
  dueDay,
  archivedAt: null,
  ...extra,
});
// A purchase on Nov 25 lands on: gold's Jan 14 bill (closed yesterday), plat's Dec 30, and titan's Dec 15
// (its statement closes today, so today's purchase still counts toward it).
const gold = card("gold", 24, 14);
const plat = card("plat", 10, 30);
const titan = card("titan", 25, 15);

const pick = (accounts, balances = {}) =>
  suggestCard({ accounts, getBalance: (id) => balances[id] ?? 0, today });
const winner = (accounts, balances) => pick(accounts, balances)?.account.id ?? null;

// Most days of float wins, whatever the account order.
const best = pick([titan, plat, gold]);
assert.equal(best.account.id, "gold");
assert.equal(ymd(best.dueDate), "2027-1-14");
assert.equal(best.days, 50);
assert.equal(pick([titan, plat]).days, 35);
const onStatementDay = pick([titan, card("debit", 25, 15, { type: "debit" }), card("other", 25, 15)]);
assert.equal(ymd(onStatementDay.dueDate), "2026-12-15");
assert.equal(onStatementDay.days, 20);

// Same float: more credit left wins; a card without a limit always has more.
const twin = card("twin", 24, 14);
assert.equal(winner([gold, twin], { gold: 30000, twin: 10000 }), "twin");
assert.equal(winner([twin, gold], { gold: 10000, twin: 30000 }), "gold");
assert.equal(winner([gold, card("open", 24, 14, { creditLimit: null })], { open: 900000 }), "open");
// A full tie keeps account order.
assert.equal(winner([twin, gold]), "twin");

// A maxed-out or over-limit card is skipped; one without a limit never is.
assert.equal(winner([gold, plat, titan], { gold: 50000 }), "plat");
assert.equal(winner([gold, plat], { gold: 50000.004 }), "plat");
assert.equal(winner([gold, plat], { gold: 49999.99 }), "gold");
assert.equal(winner([gold, plat], { gold: 50000, plat: 60000 }), null);
assert.equal(winner([card("open", 24, 14, { creditLimit: null }), plat], { open: 1e9 }), "open");

// It needs two active cards with both days to compare.
assert.equal(pick([]), null);
assert.equal(pick([gold]), null);
assert.equal(pick([gold, card("nodue", 24, null)]), null);
assert.equal(pick([gold, card("nostatement", null, 14)]), null);
assert.equal(pick([gold, card("debit", 24, 14, { type: "debit" })]), null);
assert.equal(pick([gold, card("old", 24, 14, { archivedAt: "2026-10-01T00:00:00.000Z" })]), null);
assert.equal(winner([card("old", 24, 14, { archivedAt: "2026-10-01T00:00:00.000Z" }), plat, titan]), "plat");

// A short month clamps the days to its last day.
const feb = suggestCard({
  accounts: [card("end", 31, 15), card("mid", 10, 12)],
  getBalance: () => 0,
  today: new Date(2026, 1, 28),
});
assert.equal(feb.account.id, "end");
assert.equal(ymd(feb.dueDate), "2026-3-15");
assert.equal(feb.days, 15);

console.log("card-suggestion-check: ok");
