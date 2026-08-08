#!/usr/bin/env python3
"""给 server/index.js 添加 budgets 表和 API"""
import re

with open('/opt/starlight-planner/server/index.js', 'r') as f:
    content = f.read()

original = content

# 1. 在 transactions 索引之后添加 budgets 表
idx_tx_type = "CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);"
budgets_table = """CREATE TABLE IF NOT EXISTS budgets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  month      TEXT NOT NULL,              -- yyyy-MM
  amount     INTEGER NOT NULL,           -- 预算金额，单位：分
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, month)
);"""

if idx_tx_type in content and "CREATE TABLE IF NOT EXISTS budgets" not in content:
    content = content.replace(
        idx_tx_type,
        idx_tx_type + "\n" + budgets_table
    )
    print("✓ 添加 budgets 表")
else:
    print("⚠ budgets 表已存在或锚点未找到")

# 2. 在迁移表列表中加 budgets
migrate_line = "for (const t of ['diaries', 'todos', 'transactions', 'books', 'exercises', 'workouts', 'sessions']) {"
if migrate_line in content:
    new_migrate = "for (const t of ['diaries', 'todos', 'transactions', 'books', 'budgets', 'exercises', 'workouts', 'sessions']) {"
    content = content.replace(migrate_line, new_migrate)
    print("✓ 迁移列表加 budgets")
else:
    print("⚠ 迁移行未找到，尝试 fallback...")
    # Fallback: find any line adding user_id to tables and add budgets
    for line in content.split('\n'):
        if "todos', 'transactions'" in line and "'books'" in line and "'budgets'" not in line and 'for (const t' in line:
            print("找到类似行:", line.strip())
            break

# 3. 添加 budget API 端点，放在 transactions stats 之后
stats_end = """)""".join(content.split("res.json({ month, expense: sum('expense'), income: sum('income'), byCategory, daily })")[0:1])
# Find the exact location
marker = "res.json({ month, expense: sum('expense'), income: sum('income'), byCategory, daily })"
next_section = "\n})"

if marker in content:
    budget_api = """
// ---------------- 预算 ----------------
app.get('/api/budgets', (req, res) => {
  const month = req.query.month || fmtDate(new Date()).slice(0, 7)
  const row = db.prepare('SELECT * FROM budgets WHERE user_id = ? AND month = ?').get(req.userId, month)
  res.json(row ? { id: row.id, month: row.month, amount: row.amount } : null)
})

app.put('/api/budgets', (req, res) => {
  const { month, amount } = req.body
  const uid = req.userId
  const now = fmtDate(new Date())
  const existing = db.prepare('SELECT id FROM budgets WHERE user_id = ? AND month = ?').get(uid, month)
  if (existing) {
    db.prepare('UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ?').run(amount, now, existing.id)
  } else {
    db.prepare('INSERT INTO budgets (user_id, month, amount, created_at, updated_at) VALUES (?,?,?,?,?)').run(uid, month, amount, now, now)
  }
  res.json({ ok: true, month, amount })
})
"""
    # Insert after the stats endpoint closing
    insert_after = marker + "\n})"
    if insert_after in content and "app.get('/api/budgets'" not in content:
        content = content.replace(insert_after, insert_after + "\n" + budget_api)
        print("✓ 添加预算 API")
    else:
        print("⚠ 预算 API 已存在或锚点2未匹配")
else:
    print("⚠ stats 锚点未找到")

if content == original:
    print("没有改动")
else:
    with open('/opt/starlight-planner/server/index.js', 'w') as f:
        f.write(content)
    print("✓ server/index.js 已更新")
