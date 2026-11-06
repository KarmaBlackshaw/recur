import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

// Runs `task` in one transaction on a connection of its own, so writes on `db` can't land in the middle of it.
// A new connection starts with foreign keys off and SQLite ignores the pragma once a transaction is open, so it is
// set before BEGIN: that keeps every ON DELETE CASCADE working inside the transaction too.
export async function withWriteTransaction(
  db: SQLiteDatabase,
  task: (txn: SQLiteDatabase) => Promise<void>
): Promise<void> {
  const slash = db.databasePath.lastIndexOf("/");
  const txn = await openDatabaseAsync(
    db.databasePath.slice(slash + 1),
    { ...db.options, useNewConnection: true },
    db.databasePath.slice(0, slash)
  );
  try {
    await txn.execAsync("PRAGMA foreign_keys = ON;");
    await txn.execAsync("PRAGMA busy_timeout = 5000;");
    await txn.withTransactionAsync(() => task(txn));
  } finally {
    await txn.closeAsync();
  }
}
