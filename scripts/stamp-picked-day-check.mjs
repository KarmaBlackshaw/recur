import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import dayjs from "dayjs";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { stampPickedDay } = await import("../utils/dates/stampPickedDay.ts");
const { equal, ok } = assert;

const todayPicked = dayjs().startOf("day").toISOString();
const earlierToday = dayjs().startOf("day").add(1, "minute").toISOString();
const before = Date.now();
const stamped = stampPickedDay(todayPicked);
ok(Date.parse(stamped) >= before && Date.parse(stamped) <= Date.now());
ok(Date.parse(stamped) > Date.parse(todayPicked));

const lastWeek = dayjs().subtract(7, "day");
equal(stampPickedDay(lastWeek.startOf("day").toISOString()), lastWeek.endOf("day").toISOString());

const saved = lastWeek.hour(9).toISOString();
equal(stampPickedDay(lastWeek.startOf("day").toISOString(), saved), saved);
equal(stampPickedDay(todayPicked, earlierToday), earlierToday);
ok(Date.parse(stampPickedDay(todayPicked, saved)) >= before);
console.log("stamp-picked-day-check ok");
