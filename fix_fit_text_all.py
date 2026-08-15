#!/usr/bin/env python3
"""
将 FitText 抽成共享组件，并在 Money/Stats/Home 三页统一使用。
"""
import subprocess, sys

BASE = "/opt/starlight-planner/src"

# ---- 工具函数 ----
def read(path):
    with open(f"{BASE}/{path}", "r", encoding="utf-8") as f:
        return f.read()

def write(path, src):
    with open(f"{BASE}/{path}", "w", encoding="utf-8") as f:
        f.write(src)

def replace(src, old, new, label, count=1):
    n = src.count(old)
    if n != count:
        print(f"❌ [{label}] 期望 {count} 处匹配，实际 {n} 处")
        print(f"   查找串: {old[:80]}...")
        sys.exit(1)
    return src.replace(old, new, count)

# ============================================================
# 1. Money.tsx — 删除内联 FitText，改用 import
# ============================================================
print("=== Money.tsx ===")
m = read("pages/Money.tsx")

# 1a. 还原 React import（FitText 移走后不需要 useLayoutEffect/useRef/ReactNode）
m = replace(m,
    "import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'",
    "import { useCallback, useEffect, useMemo, useState } from 'react'",
    "Money React import")

# 1b. 删除内联 FitText 组件（从 /** 注释到 export default 之前）
# 用精确标记切除
fit_text_start = m.index("/**\n * FitText")
fit_text_end = m.index("export default function MoneyPage()")
removed = m[fit_text_start:fit_text_end]
assert "function FitText" in removed and "ResizeObserver" in removed, "FitText 组件块定位异常"
m = m[:fit_text_start] + m[fit_text_end:]
print(f"  删除内联 FitText 组件（{len(removed)} 字符）")

# 1c. 添加 import FitText（在 import type 行之后）
m = replace(m,
    "import type { Transaction, TxStats, TxType } from '../types'",
    "import type { Transaction, TxStats, TxType } from '../types'\nimport FitText from '../components/FitText'",
    "Money FitText import")

write("pages/Money.tsx", m)
print("  ✅ Money.tsx 完成")

# ============================================================
# 2. Stats.tsx — 添加 import，替换 4 处金额
# ============================================================
print("=== Stats.tsx ===")
s = read("pages/Stats.tsx")

# 2a. 添加 import（在 import StatCard 行之后）
s = replace(s,
    "import StatCard from '../components/StatCard'",
    "import StatCard from '../components/StatCard'\nimport FitText from '../components/FitText'",
    "Stats FitText import")

# 2b. 顶部摘要行的年度支出（inline 模式，嵌在 flex 行内）
s = replace(s,
    '<span className="text-stone-600">💰 支出 <b className="text-rose-500 whitespace-nowrap">¥{fenToYuan(stats.money.yearExpense)}</b></span>',
    '<span className="text-stone-600">💰 支出 <FitText className="text-rose-500" maxPx={14} smMaxPx={14} minPx={10} inline>¥{fenToYuan(stats.money.yearExpense)}</FitText></span>',
    "Stats 顶部摘要支出")

# 2c. 年度汇总卡片 — 本年支出
s = replace(s,
    '<p className="mt-2 text-xl md:text-2xl font-bold text-rose-500 whitespace-nowrap">¥{fenToYuan(stats.money.yearExpense)}</p>',
    '<FitText className="mt-2 text-rose-500" maxPx={20} smMaxPx={24}>¥{fenToYuan(stats.money.yearExpense)}</FitText>',
    "Stats 年度支出卡片")

# 2d. 年度汇总卡片 — 本年收入
s = replace(s,
    '<p className="mt-2 text-xl md:text-2xl font-bold text-emerald-600 whitespace-nowrap">¥{fenToYuan(stats.money.yearIncome)}</p>',
    '<FitText className="mt-2 text-emerald-600" maxPx={20} smMaxPx={24}>¥{fenToYuan(stats.money.yearIncome)}</FitText>',
    "Stats 年度收入卡片")

# 2e. 年度汇总卡片 — 本年结余
s = replace(s,
    """<p className={`mt-2 text-xl md:text-2xl font-bold whitespace-nowrap ${stats.money.yearIncome - stats.money.yearExpense >= 0 ? 'text-orange-700' : 'text-rose-500'}`}>
              {stats.money.yearIncome - stats.money.yearExpense < 0 && '-'}¥{fenToYuan(Math.abs(stats.money.yearIncome - stats.money.yearExpense))}
            </p>""",
    """<FitText className={`mt-2 ${stats.money.yearIncome - stats.money.yearExpense >= 0 ? 'text-orange-700' : 'text-rose-500'}`} maxPx={20} smMaxPx={24}>
              {stats.money.yearIncome - stats.money.yearExpense < 0 && '-'}¥{fenToYuan(Math.abs(stats.money.yearIncome - stats.money.yearExpense))}
            </FitText>""",
    "Stats 年度结余卡片")

write("pages/Stats.tsx", s)
print("  ✅ Stats.tsx 完成（4 处替换）")

# ============================================================
# 3. Home.tsx — 添加 import，替换本月结余
# ============================================================
print("=== Home.tsx ===")
h = read("pages/Home.tsx")

# 3a. 添加 import
h = replace(h,
    "import { fenToYuan, moodOf, weatherOf } from '../lib/constants'",
    "import { fenToYuan, moodOf, weatherOf } from '../lib/constants'\nimport FitText from '../components/FitText'",
    "Home FitText import")

# 3b. 本月结余（inline 模式，因为前面有"本月结余"文字）
h = replace(h,
    """<p className={`mt-1 text-sm font-medium ${moneyBalance(stats) >= 0 ? 'text-stone-700' : 'text-rose-500'}`}>
                本月结余 {moneyBalance(stats) < 0 && '-'}¥{fenToYuan(Math.abs(moneyBalance(stats)))}
              </p>""",
    """<p className={`mt-1 text-sm font-medium flex items-center gap-1 ${moneyBalance(stats) >= 0 ? 'text-stone-700' : 'text-rose-500'}`}>
                <span>本月结余</span>
                <FitText maxPx={14} smMaxPx={14} minPx={9} inline>
                  {moneyBalance(stats) < 0 && '-'}¥{fenToYuan(Math.abs(moneyBalance(stats)))}
                </FitText>
              </p>""",
    "Home 本月结余")

write("pages/Home.tsx", h)
print("  ✅ Home.tsx 完成")

print("\n🎉 全部完成")
