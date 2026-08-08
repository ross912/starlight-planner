import re

with open('/opt/starlight-planner/src/lib/api.ts', 'r') as f:
    content = f.read()

if 'getBudget' in content:
    print('预算API已存在，跳过')
else:
    marker = "transactionStats: (month: string) => http<TxStats>(`/api/transactions/stats?month=${month}`),"
    addition = """
  getBudget: (month: string) => http<{ id: number; month: string; amount: number } | null>(`/api/budgets?month=${month}`),
  saveBudget: (month: string, amount: number) => http<{ ok: boolean }>('/api/budgets', { method: 'PUT', body: JSON.stringify({ month, amount }) }),"""
    content = content.replace(marker, marker + addition)
    with open('/opt/starlight-planner/src/lib/api.ts', 'w') as f:
        f.write(content)
    print('✓ api.ts 已添加 budget 方法')
