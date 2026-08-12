#!/usr/bin/env python3
with open('/opt/starlight-planner/src/pages/Stats.tsx', 'r') as f:
    content = f.read()

# 修复 1: 结余金额行加 whitespace-nowrap
old = 'mt-2 text-xl md:text-2xl font-bold ${stats.money.yearIncome - stats.money.yearExpense >= 0'
new = 'mt-2 text-xl md:text-2xl font-bold whitespace-nowrap ${stats.money.yearIncome - stats.money.yearExpense >= 0'
if old in content:
    content = content.replace(old, new)
    print('fixed 结余 line')

# 修复 2: 全年支出分类金额加 whitespace-nowrap
old2 = '<span className="text-xs text-stone-400">'
new2 = '<span className="text-xs text-stone-400 whitespace-nowrap">'
if old2 in content:
    content = content.replace(old2, new2)
    print('fixed category amounts')

with open('/opt/starlight-planner/src/pages/Stats.tsx', 'w') as f:
    f.write(content)
print('done')
