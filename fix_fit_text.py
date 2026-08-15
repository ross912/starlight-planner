#!/usr/bin/env python3
"""
Money.tsx 汇总区数字自适应缩放：添加 FitText 组件 + 替换 3 处 <p> 标签
算法：用隐藏 span 测量文本自然宽度，与容器宽度比较，按比例缩放字号
"""
import re

FILE = "/opt/starlight-planner/src/pages/Money.tsx"

with open(FILE, "r", encoding="utf-8") as f:
    src = f.read()

# ---- 1. 更新 React import：加 useRef, useLayoutEffect, type ReactNode ----
old_import = "import { useCallback, useEffect, useMemo, useState } from 'react'"
new_import = "import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'"
assert old_import in src, "找不到 React import 行"
src = src.replace(old_import, new_import, 1)

# ---- 2. 在 export default function MoneyPage() 前插入 FitText 组件 ----
fit_text_component = '''/**
 * FitText — 自适应缩放字号，严格束缚在容器内不换行
 * 原理：用隐藏 span 在最大字号下测量文本自然宽度，
 *       与容器实际宽度比较，按比例缩放到刚好容纳。
 *       ResizeObserver 监听容器尺寸变化（横竖屏/窗口缩放）自动重算。
 */
function FitText({
  children,
  maxPx = 18,
  smMaxPx = 24,
  minPx = 10,
  className = '',
}: {
  children: ReactNode
  maxPx?: number
  smMaxPx?: number
  minPx?: number
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const hiddenRef = useRef<HTMLSpanElement>(null)
  const [fontSize, setFontSize] = useState(maxPx)

  useLayoutEffect(() => {
    const calc = () => {
      const container = containerRef.current
      const hidden = hiddenRef.current
      if (!container || !hidden) return

      const cw = container.clientWidth
      if (cw === 0) return // 容器还没布局完，跳过

      // ① 先试桌面端最大字号
      hidden.style.fontSize = `${smMaxPx}px`
      let tw = hidden.scrollWidth
      if (tw <= cw) { setFontSize(smMaxPx); return }

      // ② 再试手机端字号
      hidden.style.fontSize = `${maxPx}px`
      tw = hidden.scrollWidth
      if (tw <= cw) { setFontSize(maxPx); return }

      // ③ 都装不下 → 按比例缩放（留 2px 安全边距防亚像素溢出）
      const scale = (cw - 2) / tw
      setFontSize(Math.max(minPx, Math.floor(maxPx * scale)))
    }

    calc()
    const ro = new ResizeObserver(calc)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [children, maxPx, smMaxPx, minPx])

  return (
    <div ref={containerRef} className={className} style={{ overflow: 'hidden' }}>
      <span style={{ fontSize: `${fontSize}px`, whiteSpace: 'nowrap', display: 'inline-block', fontWeight: 700 }}>
        {children}
      </span>
      <span
        ref={hiddenRef}
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', fontWeight: 700, pointerEvents: 'none', left: -9999 }}
      >
        {children}
      </span>
    </div>
  )
}

'''

marker = "export default function MoneyPage()"
assert marker in src, "找不到 MoneyPage 导出标记"
src = src.replace(marker, fit_text_component + marker, 1)

# ---- 3. 替换支出 <p> ----
old_expense = '<p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-rose-500 whitespace-nowrap">¥{fenToYuan(spent)}</p>'
new_expense = '<FitText className="mt-1.5 sm:mt-2 text-rose-500" maxPx={18} smMaxPx={24}>¥{fenToYuan(spent)}</FitText>'
assert old_expense in src, "找不到支出 <p> 标签"
src = src.replace(old_expense, new_expense, 1)

# ---- 4. 替换收入 <p> ----
old_income = '<p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-emerald-600 whitespace-nowrap">¥{fenToYuan(stats?.income ?? 0)}</p>'
new_income = '<FitText className="mt-1.5 sm:mt-2 text-emerald-600" maxPx={18} smMaxPx={24}>¥{fenToYuan(stats?.income ?? 0)}</FitText>'
assert old_income in src, "找不到收入 <p> 标签"
src = src.replace(old_income, new_income, 1)

# ---- 5. 替换结余 <p>（多行，带条件渲染）----
old_balance = """<p className={`mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold whitespace-nowrap ${balance >= 0 ? 'text-orange-700' : 'text-rose-500'}`}>
            {balance < 0 && '-'}¥{fenToYuan(Math.abs(balance))}
          </p>"""
new_balance = """<FitText className={`mt-1.5 sm:mt-2 ${balance >= 0 ? 'text-orange-700' : 'text-rose-500'}`} maxPx={18} smMaxPx={24}>
            {balance < 0 && '-'}¥{fenToYuan(Math.abs(balance))}
          </FitText>"""
assert old_balance in src, "找不到结余 <p> 标签"
src = src.replace(old_balance, new_balance, 1)

# ---- 写回 ----
with open(FILE, "w", encoding="utf-8") as f:
    f.write(src)

print("✅ 全部 5 处替换成功")
print("  1. React import 更新")
print("  2. FitText 组件插入")
print("  3. 支出 <p> → <FitText>")
print("  4. 收入 <p> → <FitText>")
print("  5. 结余 <p> → <FitText>")
