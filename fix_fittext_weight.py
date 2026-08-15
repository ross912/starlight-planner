#!/usr/bin/env python3
"""给块级 FitText 补 font-bold，inline 的 Stats 顶部支出补 font-semibold"""
BASE = "/opt/starlight-planner/src"

def patch(path, replacements):
    full = f"{BASE}/{path}"
    with open(full, encoding="utf-8") as f:
        src = f.read()
    for old, new, label in replacements:
        n = src.count(old)
        if n != 1:
            print(f"❌ [{label}] in {path}: 期望1处，实际{n}处")
            raise SystemExit(1)
        src = src.replace(old, new, 1)
    with open(full, "w", encoding="utf-8") as f:
        f.write(src)
    print(f"✅ {path}")

# Money.tsx — 3 处块级，加 font-bold
patch("pages/Money.tsx", [
    ('<FitText className="mt-1.5 sm:mt-2 text-rose-500" maxPx={18} smMaxPx={24}>',
     '<FitText className="mt-1.5 sm:mt-2 text-rose-500 font-bold" maxPx={18} smMaxPx={24}>',
     "Money 支出"),
    ('<FitText className="mt-1.5 sm:mt-2 text-emerald-600" maxPx={18} smMaxPx={24}>',
     '<FitText className="mt-1.5 sm:mt-2 text-emerald-600 font-bold" maxPx={18} smMaxPx={24}>',
     "Money 收入"),
    ('<FitText className={`mt-1.5 sm:mt-2 ${balance >= 0 ? \'text-orange-700\' : \'text-rose-500\'}`} maxPx={18} smMaxPx={24}>',
     '<FitText className={`mt-1.5 sm:mt-2 font-bold ${balance >= 0 ? \'text-orange-700\' : \'text-rose-500\'}`} maxPx={18} smMaxPx={24}>',
     "Money 结余"),
])

# Stats.tsx — 顶部 inline 补 font-semibold（原 <b>）；3 处块级加 font-bold
patch("pages/Stats.tsx", [
    ('<FitText className="text-rose-500" maxPx={14} smMaxPx={14} minPx={10} inline>',
     '<FitText className="text-rose-500 font-semibold" maxPx={14} smMaxPx={14} minPx={10} inline>',
     "Stats 顶部支出"),
    ('<FitText className="mt-2 text-rose-500" maxPx={20} smMaxPx={24}>',
     '<FitText className="mt-2 text-rose-500 font-bold" maxPx={20} smMaxPx={24}>',
     "Stats 年度支出"),
    ('<FitText className="mt-2 text-emerald-600" maxPx={20} smMaxPx={24}>',
     '<FitText className="mt-2 text-emerald-600 font-bold" maxPx={20} smMaxPx={24}>',
     "Stats 年度收入"),
    ('<FitText className={`mt-2 ${stats.money.yearIncome - stats.money.yearExpense >= 0 ? \'text-orange-700\' : \'text-rose-500\'}`} maxPx={20} smMaxPx={24}>',
     '<FitText className={`mt-2 font-bold ${stats.money.yearIncome - stats.money.yearExpense >= 0 ? \'text-orange-700\' : \'text-rose-500\'}`} maxPx={20} smMaxPx={24}>',
     "Stats 年度结余"),
])

print("🎉 完成")
