---
name: feedback-db-pragma-android
description: Android SQLite gotcha — separate PRAGMA from CREATE TABLE in execAsync
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c9362bf8-7fe8-46dd-8745-ec9a2566893c
---

Never mix PRAGMA statements with DDL (CREATE TABLE, ALTER TABLE) in a single `db.execAsync()` call on Android expo-sqlite.

**Why:** Causes `NullPointerException` in `NativeDatabase.prepareAsync` on Android — the entire batch silently fails, leaving tables uncreated.

**How to apply:** Always run `PRAGMA journal_mode = WAL` (or any PRAGMA) in its own `execAsync` call before the CREATE TABLE batch.
