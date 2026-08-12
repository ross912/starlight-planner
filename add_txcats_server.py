#!/usr/bin/env python3
"""在 server/index.js 中添加自定义记账分类支持：
1. 新建 tx_categories 表
2. GET/POST/DELETE /api/transactions/categories 端点
3. 在 transaction 返回中附带分类元数据（可选）
"""
import re

with open('/opt/starlight-planner/server/index.js', 'r') as f:
    code = f.read()

# 1. 在 budgets 表之后添加 tx_categories 表
tx_cats_table = """
CREATE TABLE IF NOT EXISTS tx_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  type       TEXT NOT NULL,
  key        TEXT NOT NULL,
  label      TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '📦',
  color      TEXT NOT NULL DEFAULT '#a8a29e',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, type, key)
);
CREATE INDEX IF NOT EXISTS idx_txcats_user ON tx_categories(user_id, type);
"""

# 找到 budgets 表定义结束的位置（在 CREATE TABLE budgets ... 之后）
# 用 budgets 表的结束 ); 作为锚点
anchor = "  amount     INTEGER NOT NULL,           -- 预算金额（分）\n  created_at TEXT NOT NULL\n);"
if anchor not in code:
    # 尝试另一种格式
    print("WARNING: budgets anchor not found, searching...")
    # 找 budgets 表
    m = re.search(r'CREATE TABLE IF NOT EXISTS budgets.*?\);', code, re.DOTALL)
    if m:
        anchor = m.group(0)
        print(f"Found budgets table at: {anchor[:80]}...")
    else:
        raise Exception("Cannot find budgets table")

# 在 budgets 表后插入 tx_categories 表
if 'tx_categories' not in code:
    insert_pos = code.index(anchor) + len(anchor)
    code = code[:insert_pos] + '\n' + tx_cats_table + code[insert_pos:]
    print("✓ tx_categories table added")
else:
    print("✓ tx_categories table already exists")

# 2. 添加 API 端点 —— 在 /api/transactions/stats 之前插入
api_code = """
// ---------------- 自定义记账分类 ----------------
app.get('/api/transactions/categories', (req, res) => {
  const rows = db.prepare('SELECT id, type, key, label, emoji, color FROM tx_categories WHERE user_id = ? ORDER BY id ASC').all(req.userId)
  res.json(rows)
})

app.post('/api/transactions/categories', (req, res) => {
  const type = String(req.body?.type ?? '').trim()
  const label = String(req.body?.label ?? '').trim()
  if (!type || (type !== 'expense' && type !== 'income')) return res.status(400).json({ error: 'invalid_type' })
  if (!label || label.length > 20) return res.status(400).json({ error: 'invalid_label' })
  const emoji = String(req.body?.emoji ?? '📦').slice(0, 4) || '📦'
  const color = String(req.body?.color ?? '#a8a29e').slice(0, 7) || '#a8a29e'
  // 生成 key：中文转拼音不支持，用 label 原文做 key（SQLite TEXT 无压力）
  let key = label
  // 如果 key 已存在，加数字后缀
  let suffix = 1
  while (db.prepare('SELECT id FROM tx_categories WHERE user_id = ? AND type = ? AND key = ?').get(req.userId, type, key)) {
    suffix++
    key = `${label}${suffix}`
  }
  const t = now()
  db.prepare('INSERT INTO tx_categories (user_id, type, key, label, emoji, color, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.userId, type, key, label, emoji, color, t)
  const row = db.prepare('SELECT id, type, key, label, emoji, color FROM tx_categories WHERE user_id = ? AND type = ? AND key = ?').get(req.userId, type, key)
  res.status(201).json(row)
})

app.delete('/api/transactions/categories/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tx_categories WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true, deleted: info.changes })
})

"""

# 在 /api/transactions/stats 之前插入
stats_anchor = "// 月度汇总：收支合计"
if stats_anchor not in code:
    raise Exception("Cannot find stats anchor")

if '/api/transactions/categories' not in code:
    insert_pos = code.index(stats_anchor)
    code = code[:insert_pos] + api_code + '\n' + code[insert_pos:]
    print("✓ tx_categories API endpoints added")
else:
    print("✓ tx_categories API already exists")

# 3. 将 tx_categories 加入清理列表（第 297 行附近的数组）
cleanup_list = "['diaries', 'todos', 'transactions', 'books', 'budgets', 'exercises', 'workouts', 'sessions']"
if cleanup_list in code and 'tx_categories' not in cleanup_list:
    new_list = "['diaries', 'todos', 'transactions', 'books', 'budgets', 'exercises', 'workouts', 'sessions', 'tx_categories']"
    code = code.replace(cleanup_list, new_list)
    print("✓ tx_categories added to cleanup list")
else:
    print("✓ cleanup list already updated or not found")

with open('/opt/starlight-planner/server/index.js', 'w') as f:
    f.write(code)

print("\nDone. Run 'node --check server/index.js' to verify.")
