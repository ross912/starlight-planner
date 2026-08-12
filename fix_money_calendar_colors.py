import re

with open('src/pages/Money.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 日历格子背景色：有数据的日子根据收支类型显示不同底色
old_cell_classes = """                    ${isSelected
                      ? 'bg-orange-100 ring-2 ring-orange-300 scale-95'
                      : isToday
                        ? 'bg-amber-50 ring-1 ring-amber-200'
                        : cell.hasData
                          ? 'bg-stone-50 hover:bg-orange-50'
                          : 'hover:bg-stone-50'
                    }"""

new_cell_classes = """                    ${isSelected
                      ? 'bg-orange-200 ring-2 ring-orange-400 scale-95'
                      : isToday
                        ? 'bg-amber-100 ring-1 ring-amber-300'
                        : cell.hasData
                          ? hasExpense && !hasIncome
                            ? 'bg-rose-50 hover:bg-rose-100'
                            : hasIncome && !hasExpense
                              ? 'bg-emerald-50 hover:bg-emerald-100'
                              : 'bg-amber-50 hover:bg-amber-100'
                          : 'hover:bg-stone-100'
                    }"""

content = content.replace(old_cell_classes, new_cell_classes)

# 2. 日期数字：加深颜色
content = content.replace(
    "<span className={`font-medium ${isToday ? 'text-orange-600' : 'text-stone-600'}`}>",
    "<span className={`font-medium ${isToday ? 'text-orange-700' : 'text-stone-700'}`}>"
)

# 3. 支出金额：rose-400 → rose-600，加粗
content = content.replace(
    'text-[9px] sm:text-[10px] text-rose-400 whitespace-nowrap',
    'text-[9px] sm:text-[10px] text-rose-600 font-medium whitespace-nowrap'
)

# 4. 收入金额：emerald-500 → emerald-600，加粗
content = content.replace(
    'text-[9px] sm:text-[10px] text-emerald-500 whitespace-nowrap',
    'text-[9px] sm:text-[10px] text-emerald-600 font-medium whitespace-nowrap'
)

# 5. 选中格子内的金额文字也要适配深色底
# 选中时支出文字用更深的红
# (rose-600 在 orange-200 底上对比度够，不需要额外改)

with open('src/pages/Money.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Money.tsx calendar colors enhanced')

# 验证关键改动是否生效
checks = [
    'bg-orange-200 ring-2 ring-orange-400',
    'bg-amber-100 ring-1 ring-amber-300',
    'bg-rose-50 hover:bg-rose-100',
    'bg-emerald-50 hover:bg-emerald-100',
    'text-rose-600 font-medium',
    'text-emerald-600 font-medium',
    'text-orange-700',
    'text-stone-700',
]
for c in checks:
    if c in content:
        print(f'  OK: {c}')
    else:
        print(f'  MISSING: {c}')
