import type { SQLiteDatabase } from "expo-sqlite";
import { getDB } from "@/db/schema";
import { newId } from "@/db/accountTransactions";
import type { TransferTemplate, TransferTemplateInput } from "@/types";

interface TransferTemplateRow {
  id: string; name: string; from_account_id: string; to_account_id: string; amount: number; fee: number;
  income: number; income_account_id: string | null; note: string | null; created_at: string;
}

const COLUMNS =
  "id, name, from_account_id, to_account_id, amount, fee, income, income_account_id, note, created_at";

function toTemplate(r: TransferTemplateRow): TransferTemplate {
  return {
    id: r.id,
    name: r.name,
    fromId: r.from_account_id,
    toId: r.to_account_id,
    amount: r.amount,
    fee: r.fee,
    income: r.income,
    incomeAccountId: r.income_account_id,
    note: r.note,
    createdAt: r.created_at,
  };
}

function toParams(t: TransferTemplate) {
  return [t.id, t.name, t.fromId, t.toId, t.amount, t.fee, t.income, t.incomeAccountId, t.note, t.createdAt];
}

export async function getAll(): Promise<TransferTemplate[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<TransferTemplateRow>(`SELECT ${COLUMNS} FROM transfer_templates`);
  return rows.map(toTemplate);
}

export async function insert(input: TransferTemplateInput): Promise<TransferTemplate> {
  const db = await getDB();
  const template: TransferTemplate = { ...input, id: newId(), createdAt: new Date().toISOString() };
  await db.runAsync(
    `INSERT INTO transfer_templates (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    toParams(template)
  );
  return template;
}

export async function update(id: string, input: TransferTemplateInput): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE transfer_templates SET name = ?, from_account_id = ?, to_account_id = ?, amount = ?, fee = ?, income = ?,
       income_account_id = ?, note = ? WHERE id = ?`,
    [input.name, input.fromId, input.toId, input.amount, input.fee, input.income, input.incomeAccountId, input.note, id]
  );
}

export async function remove(id: string): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM transfer_templates WHERE id = ?", [id]);
}

// Restores a template from a backup. Pass the import's transaction as `db`; returns 1 when added, 0 when it
// already existed.
export async function insertOrIgnore(t: TransferTemplate, db?: SQLiteDatabase): Promise<number> {
  const conn = db ?? (await getDB());
  const result = await conn.runAsync(
    `INSERT OR IGNORE INTO transfer_templates (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    toParams(t)
  );
  return result.changes;
}
