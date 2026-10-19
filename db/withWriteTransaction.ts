import type { SQLiteDatabase } from "expo-sqlite";

type TWriteTask = Parameters<SQLiteDatabase["withExclusiveTransactionAsync"]>[0];

export async function withWriteTransaction(db: SQLiteDatabase, task: TWriteTask): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync("PRAGMA busy_timeout = 5000;");
    await task(txn);
  });
}
