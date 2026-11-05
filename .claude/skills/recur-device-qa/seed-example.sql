-- QA rows for `db.sh --seed`. Check live columns first (`db.sh ".schema expenses"`).
-- start_month is 0-based: use the pinned clock's month, or every month since shows overdue.
INSERT OR REPLACE INTO accounts (id, name, type, sort_order, created_at) VALUES ('qa-bpi', 'BPI Savings', 'debit', 1, '2026-01-01T00:00:00.000Z');
INSERT OR REPLACE INTO accounts (id, name, type, sort_order, credit_limit, statement_day, due_day, created_at) VALUES ('qa-card', 'QA Card', 'credit', 2, 50000, 25, 15, '2026-01-01T00:00:00.000Z');
-- Opening balance: debit and cash accounts can't go below 0, so paying needs money in them.
INSERT OR REPLACE INTO account_transactions (id, account_id, kind, amount, created_at) VALUES ('qa-open-bpi', 'qa-bpi', 'adjust', 10000, '2026-01-01T00:00:00.000Z');
INSERT OR REPLACE INTO expenses (id, name, category, amount, dueDay, recurrence, status, createdAt, is_variable, start_year, start_month, account_id) VALUES
 ('qa-elec', 'Electricity', 'Utilities', NULL, 20, 'monthly', 'unpaid', '2026-01-01T00:00:00.000Z', 1, 2026, 10, 'qa-bpi'),
 ('qa-water', 'Water', 'Utilities', 2000, 25, 'monthly', 'unpaid', '2026-01-01T00:00:00.000Z', 0, 2026, 10, 'qa-bpi'),
 ('qa-gym', 'Gym', 'Health', 1000, 10, 'monthly', 'unpaid', '2026-01-01T00:00:00.000Z', 0, 2026, 10, 'qa-bpi');
