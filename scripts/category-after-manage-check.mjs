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
const { categoryAfterManage, snapshotBeforeManage } = await import("../utils/categories.ts");
const { equal } = assert;

const rows = [
  { id: 1, name: "Housing" },
  { id: 2, name: "Food" },
  { id: 3, name: "Other" },
];
const before = snapshotBeforeManage(rows, "Food");

equal(categoryAfterManage(before, rows), undefined);
equal(categoryAfterManage(before, rows.map((row) => (row.id === 2 ? { ...row, name: "Groceries" } : row))), "Groceries");
equal(categoryAfterManage(before, rows.filter((row) => row.id !== 2)), "");
equal(categoryAfterManage(before, rows.map((row) => (row.id === 1 ? { ...row, name: "Rent" } : row))), undefined);
equal(categoryAfterManage(before, [...rows.filter((row) => row.id !== 2), { id: 4, name: "Dining" }]), "Dining");
equal(categoryAfterManage(snapshotBeforeManage(rows, "Gone"), rows.filter((row) => row.id !== 2)), undefined);
equal(categoryAfterManage(snapshotBeforeManage([], ""), [{ id: 1, name: "First" }]), "First");
console.log("category-after-manage-check ok");
