#!/usr/bin/env python3
"""在 api.ts 中添加自定义记账分类 API 方法"""
with open('/opt/starlight-planner/src/lib/api.ts', 'r') as f:
    code = f.read()

# 在 transactionStats 行之后插入自定义分类 API
anchor = "  transactionStats: (month: string) => http<TxStats>(`/api/transactions/stats?month=${month}`),"
if anchor not in code:
    raise Exception("Cannot find transactionStats anchor")

insert_after = anchor + """
  listTxCategories: () => http<{ id: number; type: 'expense' | 'income'; key: string; label: string; emoji: string; color: string }[]>('/api/transactions/categories'),
  addTxCategory: (data: { type: 'expense' | 'income'; label: string; emoji?: string; color?: string }) =>
    http<{ id: number; type: string; key: string; label: string; emoji: string; color: string }>('/api/transactions/categories', { method: 'POST', body: JSON.stringify(data) }),
  deleteTxCategory: (id: number) => http<{ ok: boolean }>(`/api/transactions/categories/${id}`, { method: 'DELETE' }),"""

if 'listTxCategories' not in code:
    code = code.replace(anchor, insert_after)
    print("✓ txCategory API methods added")
else:
    print("✓ txCategory API methods already exist")

with open('/opt/starlight-planner/src/lib/api.ts', 'w') as f:
    f.write(code)
print("Done.")
