import dayjs, { type Dayjs } from "dayjs";
import type { BankId } from "@/constants/banks";

export type SmsDirection = "expense" | "income";

export interface ParsedSms {
  direction: SmsDirection;
  amount: number | null;
  counterparty: string | null;
  day: string | null; // YYYY-MM-DD, never after today
  bank: BankId | null;
  isCard: boolean;
  lastDigits: string | null;
}

const BANK_PATTERNS: Record<BankId, RegExp> = {
  bdo: /\bbdo\b/gi,
  bpi: /\bbpi\b/gi,
  metrobank: /\bmetro ?bank\b/gi,
  unionbank: /\bunion ?bank\b|\bubp\b/gi,
  securitybank: /\bsecurity ?bank\b/gi,
  rcbc: /\brcbc\b/gi,
  eastwest: /\beast ?west\b/gi,
  chinabank: /\bchina ?bank\b/gi,
  landbank: /\bland ?bank\b/gi,
  pnb: /\bpnb\b/gi,
  gcash: /\bg-?cash\b/gi,
  maya: /\b(?:pay)?maya\b/gi,
  maribank: /\bmari ?bank\b|\bsea ?bank\b/gi,
  gotyme: /\bgo ?tyme\b/gi,
};

const INCOME_WORDS = /\b(?:received|receive|credited|deposited|cash(?:ed)?[- ]?in|refund(?:ed)?)\b/i;
const EXPENSE_WORDS =
  /\b(?:sent|paid|payment|debited|purchased?|used|spent|withdrawn|withdrawal|withdrew|cash(?:ed)?[- ]?out|charged|transferred)\b/i;

// Case-sensitive so a lone "p" inside a word never reads as pesos.
const AMOUNT = /(?:\bPHP|\bPhp|\bphp|\bP|₱)\s?(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(?![\d,])/g;
const NOT_THE_AMOUNT = /\b(?:bal|balance|avail|available|limit|fee)\b.{0,15}$/i;

// A bank named right after one of these is the other side of the transaction, not the user's account.
const COUNTERPARTY_LEAD = /\b(?:to|from|at)\s+$/i;
const NAME_END =
  /\s+(?:on|with|via|using|for|ref|is|was|has|had|and|amounting|worth)\b|\s+(?:\+?63|0)?\d{4,}|[,;:(]|\.(?:\s|$)|\s+-\s/i;
const NAME_TAIL = /\s+(?:(?:savings\s+)?account|acct|card)(?:\s+(?:ending(?:\s+in)?|no))?$/i;
const NOT_A_NAME = /^(?:your|you|my|the|account|acct|ref)\b/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAME = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?";

export function mentionsBank(text: string, bank: BankId): boolean {
  return new RegExp(BANK_PATTERNS[bank].source, "i").test(text);
}

function findBank(text: string): BankId | null {
  let best: { bank: BankId; index: number } | null = null;
  for (const bank of Object.keys(BANK_PATTERNS) as BankId[]) {
    for (const match of text.matchAll(BANK_PATTERNS[bank])) {
      const isCounterparty = COUNTERPARTY_LEAD.test(text.slice(0, match.index));
      if (!isCounterparty && (best === null || match.index < best.index)) {
        best = { bank, index: match.index };
      }
    }
  }
  return best?.bank ?? null;
}

function findDirection(text: string): SmsDirection {
  const income = text.search(INCOME_WORDS);
  const expense = text.search(EXPENSE_WORDS);
  if (income === -1) {
    return "expense";
  }
  return expense === -1 || income < expense ? "income" : "expense";
}

function findAmount(text: string): { amount: number; end: number } | null {
  for (const match of text.matchAll(AMOUNT)) {
    const before = text.slice(Math.max(0, match.index - 30), match.index);
    if (NOT_THE_AMOUNT.test(before)) {
      continue;
    }
    const amount = parseFloat(`${match[1].replace(/,/g, "")}${match[2] ?? ""}`);
    if (amount > 0) {
      return { amount, end: match.index + match[0].length };
    }
  }
  return null;
}

function cleanName(raw: string): string | null {
  const end = raw.search(NAME_END);
  const name = (end === -1 ? raw : raw.slice(0, end)).replace(/\s+/g, " ").trim().replace(NAME_TAIL, "");
  if (!/[a-z]/i.test(name) || NOT_A_NAME.test(name)) {
    return null;
  }
  return name.slice(0, 60).trim();
}

function nameAfter(text: string, lead: RegExp): string | null {
  for (const match of text.matchAll(lead)) {
    const name = cleanName(text.slice(match.index + match[0].length));
    if (name) {
      return name;
    }
  }
  return null;
}

function findCounterparty(text: string, amountEnd: number, direction: SmsDirection): string | null {
  const afterAmount = text.slice(amountEnd);
  if (direction === "income") {
    return nameAfter(afterAmount, /\bfrom\s+/gi) ?? nameAfter(text, /\bfrom\s+/gi);
  }
  return (
    nameAfter(afterAmount, /\b(?:to|at)\s+/gi) ?? nameAfter(afterAmount, /\bfor\s+/gi) ?? nameAfter(text, /\b(?:to|at)\s+/gi)
  );
}

function toDay(year: number, month: number, date: number): Dayjs | null {
  const fullYear = year < 100 ? 2000 + year : year;
  const day = dayjs(new Date(fullYear, month, date));
  return day.month() === month && day.date() === date ? day : null;
}

function monthOf(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase());
}

function findDay(text: string, today: Dayjs): Dayjs | null {
  const candidates: { index: number; day: Dayjs | null }[] = [];
  for (const match of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
    candidates.push({ index: match.index, day: toDay(+match[1], +match[2] - 1, +match[3]) });
  }
  // Month first, as PH banks write it; a first number past 12 can only be the day.
  for (const match of text.matchAll(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})\b/g)) {
    const [first, second, year] = [+match[1], +match[2], +match[3]];
    candidates.push({ index: match.index, day: toDay(year, first - 1, second) ?? toDay(year, second - 1, first) });
  }
  for (const match of text.matchAll(new RegExp(`\\b${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"))) {
    candidates.push({ index: match.index, day: toDay(+match[3], monthOf(match[1]), +match[2]) });
  }
  for (const match of text.matchAll(new RegExp(`\\b(\\d{1,2})[\\s-]+${MONTH_NAME}[\\s,-]+(\\d{4})\\b`, "gi"))) {
    candidates.push({ index: match.index, day: toDay(+match[3], monthOf(match[2]), +match[1]) });
  }
  for (const match of text.matchAll(new RegExp(`\\b${MONTH_NAME}\\s+(\\d{1,2})\\b(?!,?\\s*\\d)`, "gi"))) {
    const thisYear = toDay(today.year(), monthOf(match[1]), +match[2]);
    candidates.push({
      index: match.index,
      day: thisYear?.isAfter(today, "day") ? thisYear.subtract(1, "year") : thisYear,
    });
  }
  const found = candidates.filter((c) => c.day !== null).sort((a, b) => a.index - b.index);
  return found[0]?.day ?? null;
}

// Reads a bank or e-wallet transaction SMS. Whatever it can't find stays null, for the user to fill in on the form.
// Text with no amount isn't a transaction, so nothing is read from it.
export function parseTransactionSms(text: string, today: Dayjs = dayjs()): ParsedSms {
  const direction = findDirection(text);
  const found = findAmount(text);
  if (!found) {
    return { direction, amount: null, counterparty: null, day: null, bank: null, isCard: false, lastDigits: null };
  }
  const day = findDay(text, today);
  return {
    direction,
    amount: found.amount,
    counterparty: findCounterparty(text, found.end, direction),
    day: day ? (day.isAfter(today, "day") ? today : day).format("YYYY-MM-DD") : null,
    bank: findBank(text),
    isCard: /\bcredit\s*card\b/i.test(text) || (/\bcard\b/i.test(text) && !/\bdebit\s*card\b/i.test(text)),
    lastDigits: text.match(/(?:\bending(?:\s+in)?|x{2,}|\*{2,})[\s#-]*(\d{3,4})\b/i)?.[1] ?? null,
  };
}
