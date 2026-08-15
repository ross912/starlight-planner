path = "/opt/starlight-planner/src/pages/Home.tsx"
with open(path, encoding="utf-8") as f:
    src = f.read()

old = '''              <p className={`mt-1 text-sm font-medium flex items-center gap-1 ${moneyBalance(stats) >= 0 ? 'text-stone-700' : 'text-rose-500'}`}>
                <span>本月结余</span>
                <FitText maxPx={14} smMaxPx={14} minPx={9} inline>
                  {moneyBalance(stats) < 0 && '-'}¥{fenToYuan(Math.abs(moneyBalance(stats)))}
                </FitText>
              </p>'''

new = '''              <p className="mt-1 text-sm font-medium text-stone-500 whitespace-nowrap">本月结余</p>
              <FitText
                className={`mt-0.5 ${moneyBalance(stats) >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                maxPx={18}
                smMaxPx={20}
                minPx={11}
              >
                {moneyBalance(stats) < 0 && '-'}¥{fenToYuan(Math.abs(moneyBalance(stats)))}
              </FitText>'''

n = src.count(old)
assert n == 1, f"期望1处，实际{n}处"
src = src.replace(old, new, 1)
with open(path, "w", encoding="utf-8") as f:
    f.write(src)
print("✅ Home 记账卡片改为两行布局")
