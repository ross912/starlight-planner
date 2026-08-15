import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, TrendingDown, TrendingUp, Wallet, Target, X } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../lib/api'
import { EXPENSE_CATS, INCOME_CATS, fenToYuan, txCatOf } from '../lib/constants'
import type { Transaction, TxStats, TxType } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 自定义分类类型 */
type CustomCat = { id: number; type: 'expense' | 'income'; key: string; label: string; emoji: string; color: string }

/** 颜色调色板：循环分配 */
const COLOR_PALETTE = ['#f97316', '#eab308', '#ec4899', '#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#38bdf8', '#fb7185', '#84cc16', '#f59e0b', '#06b6d4']

/** 金额缩略：超过 1 万用 "w" 表示 */
function shortAmount(fen: number): string {
  const yuan = fen / 100
  if (yuan >= 10000) return (yuan / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
  return yuan.toFixed(yuan % 1 === 0 ? 0 : 2)
}

/** 合并内置 + 自定义分类的查找函数 */
function catLookup(type: 'expense' | 'income', key: string, customCats: CustomCat[]) {
  const builtin = txCatOf(type, key)
  if (builtin) return builtin
  return customCats.find((c) => c.type === type && c.key === key) ?? { key, label: key, emoji: '📦', color: '#a8a29e' }
}

/**
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

export default function MoneyPage() {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [list, setList] = useState<Transaction[]>([])
  const [stats, setStats] = useState<TxStats | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // ---- 预算 ----
  const [budget, setBudget] = useState<{ id: number; month: string; amount: number } | null>(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  // ---- 自定义分类 ----
  const [customCats, setCustomCats] = useState<CustomCat[]>([])

  const load = useCallback(async () => {
    const [l, s, b, cc] = await Promise.all([
      api.listTransactions(month),
      api.transactionStats(month),
      api.getBudget(month),
      api.listTxCategories(),
    ])
    setList(l)
    setStats(s)
    setBudget(b)
    setCustomCats(cc as CustomCat[])
  }, [month])

  useEffect(() => {
    queueMicrotask(() => { load().catch(console.error) })
  }, [load])

  // 切月时清除选中日期
  useEffect(() => { setSelectedDate(null) }, [month])

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    setMonth(format(new Date(y, m - 1 + delta, 1), 'yyyy-MM'))
  }

  const remove = async (tx: Transaction) => {
    if (!window.confirm(`删除这笔${tx.type === 'expense' ? '支出' : '收入'}「¥${fenToYuan(tx.amount)}」？`)) return
    await api.deleteTransaction(tx.id)
    load()
  }

  // ---- 保存预算 ----
  const saveBudget = async () => {
    const v = Number(budgetInput)
    if (!Number.isFinite(v) || v <= 0) return
    await api.saveBudget(month, Math.round(v * 100))
    setBudget({ id: budget?.id ?? 0, month, amount: Math.round(v * 100) })
    setEditingBudget(false)
  }

  const startEditBudget = () => {
    setBudgetInput(budget ? String(budget.amount / 100) : '')
    setEditingBudget(true)
  }

  // ---- 日历数据 ----
  const calendar = useMemo(() => {
    const [year, monthNum] = month.split('-').map(Number)
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    const firstDayOfWeek = new Date(year, monthNum - 1, 1).getDay() // 0=Sun

    // date → transactions map
    const dateMap = new Map<string, Transaction[]>()
    for (const tx of list) {
      const arr = dateMap.get(tx.date) ?? []
      arr.push(tx)
      dateMap.set(tx.date, arr)
    }

    type Cell = { day: number; date: string; expense: number; income: number; hasData: boolean }
    const cells: (null | Cell)[] = []

    // 月初补齐空白
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const txs = dateMap.get(dateStr) ?? []
      cells.push({
        day,
        date: dateStr,
        expense: txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        income: txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        hasData: txs.length > 0,
      })
    }

    return { cells, dateMap }
  }, [list, month])

  const selectedTxs = useMemo(
    () => (selectedDate ? (calendar.dateMap.get(selectedDate) ?? []) : []),
    [selectedDate, calendar.dateMap],
  )

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // ---- 饼图 ----
  const expensePie = useMemo(
    () =>
      (stats?.byCategory ?? [])
        .filter((c) => c.type === 'expense')
        .map((c) => ({ ...c, ...catLookup('expense', c.category, customCats) })),
    [stats, customCats],
  )

  const balance = (stats?.income ?? 0) - (stats?.expense ?? 0)
  const [y, mo] = month.split('-')

  // ---- 预算进度 ----
  const spent = stats?.expense ?? 0
  const budgetAmount = budget?.amount ?? 0
  const budgetPct = budgetAmount > 0 ? Math.min(100, Math.round((spent / budgetAmount) * 100)) : 0
  const overBudget = budgetAmount > 0 && spent > budgetAmount

  // ---- 添加自定义分类 ----
  const addCustomCat = async (type: TxType, label: string, emoji: string) => {
    const color = COLOR_PALETTE[customCats.length % COLOR_PALETTE.length]
    await api.addTxCategory({ type, label, emoji, color })
    const cc = await api.listTxCategories()
    setCustomCats(cc as CustomCat[])
  }

  // ---- 删除自定义分类 ----
  const deleteCustomCat = async (id: number) => {
    await api.deleteTxCategory(id)
    const cc = await api.listTxCategories()
    setCustomCats(cc as CustomCat[])
  }

  return (
    <div className="space-y-5">
      {/* ---- 头部：月份导航 ---- */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-950">记账</h2>
          <p className="mt-1 text-sm text-stone-500">每一笔收支，都是生活的注脚。</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="warm-btn-ghost !px-2" onClick={() => shiftMonth(-1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-28 text-center text-sm font-medium text-stone-700">{y}年{Number(mo)}月</span>
          <button className="warm-btn-ghost !px-2" onClick={() => shiftMonth(1)}>
            <ChevronRight size={16} />
          </button>
          {month !== format(new Date(), 'yyyy-MM') && (
            <button className="warm-btn-ghost text-xs" onClick={() => setMonth(format(new Date(), 'yyyy-MM'))}>
              回本月
            </button>
          )}
        </div>
      </header>

      {/* ---- 月度汇总 ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <TrendingDown size={13} className="text-rose-400" /> 本月支出
          </p>
          <FitText className="mt-1.5 sm:mt-2 text-rose-500" maxPx={18} smMaxPx={24}>¥{fenToYuan(spent)}</FitText>
        </div>
        <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-500" /> 本月收入
          </p>
          <FitText className="mt-1.5 sm:mt-2 text-emerald-600" maxPx={18} smMaxPx={24}>¥{fenToYuan(stats?.income ?? 0)}</FitText>
        </div>
        <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <Wallet size={13} className="text-orange-500" /> 结余
          </p>
          <FitText className={`mt-1.5 sm:mt-2 ${balance >= 0 ? 'text-orange-700' : 'text-rose-500'}`} maxPx={18} smMaxPx={24}>
            {balance < 0 && '-'}¥{fenToYuan(Math.abs(balance))}
          </FitText>
        </div>
        {/* 预算卡片 */}
        <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <Target size={13} className="text-violet-400" /> 本月预算
          </p>
          {editingBudget ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-sm text-stone-400">¥</span>
              <input
                className="warm-input w-20 py-1 text-sm font-bold"
                autoFocus
                inputMode="decimal"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value.replace(/[^\d.]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
                placeholder="0"
              />
              <button className="warm-btn-ghost text-xs !px-2" onClick={saveBudget}>确定</button>
            </div>
          ) : (
            <button className="mt-1.5 sm:mt-2 group flex items-center gap-1" onClick={startEditBudget}>
              <span className={`text-lg sm:text-2xl font-bold ${budgetAmount > 0 ? 'text-violet-600' : 'text-stone-300'}`}>
                {budgetAmount > 0 ? `¥${fenToYuan(budgetAmount)}` : '未设置'}
              </span>
              <Pencil size={12} className="text-stone-300 group-hover:text-stone-500 transition" />
            </button>
          )}
        </div>
      </div>

      {/* ---- 预算进度条 ---- */}
      {budgetAmount > 0 && (
        <div className="warm-card px-4 py-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-stone-500">
              已花费 <span className={overBudget ? 'text-rose-500 font-semibold' : 'text-stone-700 font-medium'}>¥{fenToYuan(spent)}</span>
            </span>
            <span className={`text-xs font-medium ${overBudget ? 'text-rose-500' : budgetPct >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {budgetPct}%
              {overBudget && ' 已超支'}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overBudget ? 'bg-rose-400' : budgetPct >= 80 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, (spent / budgetAmount) * 100)}%` }}
            />
          </div>
          {overBudget && (
            <p className="mt-1.5 text-xs text-rose-400">
              超出预算 ¥{fenToYuan(spent - budgetAmount)}
            </p>
          )}
          {budgetAmount > 0 && !overBudget && (
            <p className="mt-1.5 text-xs text-stone-400">
              剩余 ¥{fenToYuan(budgetAmount - spent)} 可用
            </p>
          )}
        </div>
      )}

      {/* ---- 记一笔 ---- */}
      <AddForm onSaved={load} customCats={customCats} onAddCat={addCustomCat} onDeleteCat={deleteCustomCat} />

      {/* ---- 支出分类饼图 ---- */}
      {list.length > 0 && (
        <section className="warm-card p-4 sm:p-5">
          <h3 className="font-semibold text-orange-950">支出分类占比</h3>
          {expensePie.length > 0 ? (
            <>
              <div className="mt-4 h-44 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensePie} dataKey="total" nameKey="label" innerRadius={46} outerRadius={74} paddingAngle={3}>
                      {expensePie.map((c) => (
                        <Cell key={c.category} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #fde8cd', fontSize: 12 }}
                      formatter={(v: number, name: string) => {
                        const c = expensePie.find((x) => x.label === name)
                        return [`${c?.emoji ?? ''} ¥${fenToYuan(v)}`, name]
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {expensePie.map((c) => (
                  <span key={c.category} className="inline-flex items-center gap-1 text-xs text-stone-500">
                    <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    {c.emoji} {c.label} ¥{fenToYuan(c.total)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-stone-400">本月还没有支出记录</p>
          )}
        </section>
      )}

      {/* ---- 日历状统计 ---- */}
      {list.length > 0 && (
        <section className="warm-card p-3 sm:p-5">
          <h3 className="font-semibold text-orange-950 mb-3">{Number(mo)}月</h3>

          {/* 星期头 */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[11px] sm:text-xs text-stone-400 py-1">
                {w}
              </div>
            ))}
          </div>

          {/* 日历格子 */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {calendar.cells.map((cell, i) => {
              if (!cell) return <div key={`empty-${i}`} className="aspect-square" />

              const isToday = cell.date === todayStr
              const isSelected = cell.date === selectedDate
              const hasExpense = cell.expense > 0
              const hasIncome = cell.income > 0

              return (
                <button
                  key={cell.date}
                  onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                  className={`
                    aspect-square rounded-lg flex flex-col items-center justify-center transition text-[11px] sm:text-xs
                    ${isSelected
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
                    }
                  `}
                >
                  <span className={`font-medium ${isToday ? 'text-orange-700' : 'text-stone-700'}`}>
                    {cell.day}
                  </span>
                  {cell.hasData && (
                    <div className="flex flex-col items-center leading-tight mt-0.5 w-full px-0.5">
                      {hasExpense && (
                        <span className="text-[9px] sm:text-[10px] text-rose-600 font-medium whitespace-nowrap max-w-full truncate">
                          -¥{shortAmount(cell.expense)}
                        </span>
                      )}
                      {hasIncome && (
                        <span className="text-[9px] sm:text-[10px] text-emerald-600 font-medium whitespace-nowrap max-w-full truncate">
                          +¥{shortAmount(cell.income)}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* 选中日期的明细 */}
          {selectedDate && selectedTxs.length > 0 && (
            <div className="mt-4 border-t border-orange-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-stone-700">
                  {(() => {
                    const d = new Date(selectedDate + 'T00:00:00')
                    return `${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`
                  })()}
                </span>
                <span className="text-xs text-stone-400">
                  {selectedTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) > 0 && (
                    <span className="text-rose-400">
                      -¥{fenToYuan(selectedTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}
                    </span>
                  )}
                  {selectedTxs.some((t) => t.type === 'expense') && selectedTxs.some((t) => t.type === 'income') && ' · '}
                  {selectedTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) > 0 && (
                    <span className="text-emerald-500">
                      +¥{fenToYuan(selectedTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0))}
                    </span>
                  )}
                </span>
              </div>
              <ul className="divide-y divide-orange-50">
                {selectedTxs.map((tx) => {
                  const cat = catLookup(tx.type, tx.category, customCats)
                  return (
                    <li
                      key={tx.id}
                      className="group flex items-center gap-3 px-2 py-2.5 hover:bg-orange-50/40 transition rounded-lg"
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                        style={{ background: `${cat?.color ?? '#a8a29e'}1f` }}
                      >
                        {cat?.emoji ?? '📦'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800">{cat?.label ?? tx.category}</p>
                        {tx.note && <p className="text-xs text-stone-400 truncate">{tx.note}</p>}
                      </div>
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${tx.type === 'expense' ? 'text-rose-500' : 'text-emerald-600'}`}
                      >
                        {tx.type === 'expense' ? '-' : '+'}¥{fenToYuan(tx.amount)}
                      </span>
                      <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          className="warm-btn-ghost !px-1.5 text-stone-400 hover:text-orange-600"
                          onClick={() => setEditing(tx)}
                          title="编辑"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="warm-btn-ghost !px-1.5 text-stone-400 hover:text-red-500"
                          onClick={() => remove(tx)}
                          title="删除"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* 选中的日期没有数据 */}
          {selectedDate && selectedTxs.length === 0 && (
            <div className="mt-4 border-t border-orange-100 pt-6 pb-4 text-center text-sm text-stone-400">
              当天没有收支记录
            </div>
          )}
        </section>
      )}

      {/* 空状态 */}
      {list.length === 0 && (
        <p className="py-12 text-center text-sm text-stone-400">本月还没有记录，从上面「记一笔」开始吧 💰</p>
      )}

      {editing && (
        <EditTxDialog
          tx={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          customCats={customCats}
          onAddCat={addCustomCat}
          onDeleteCat={deleteCustomCat}
        />
      )}
    </div>
  )
}

/** 记一笔表单 */
function TxFields({
  type, setType, amount, setAmount, category, setCategory, date, setDate, note, setNote,
  customCats, onAddCat, onDeleteCat,
}: {
  type: TxType; setType: (t: TxType) => void
  amount: string; setAmount: (v: string) => void
  category: string; setCategory: (v: string) => void
  date: string; setDate: (v: string) => void
  note: string; setNote: (v: string) => void
  customCats: CustomCat[]
  onAddCat: (type: TxType, label: string, emoji: string) => void
  onDeleteCat: (id: number) => void
}) {
  const builtin = type === 'expense' ? EXPENSE_CATS : INCOME_CATS
  const custom = customCats.filter((c) => c.type === type)
  const [addingCat, setAddingCat] = useState(false)
  const [newCatLabel, setNewCatLabel] = useState('')
  const [selectedEmoji, setSelectedEmoji] = useState('📦')

  const submitNewCat = () => {
    const label = newCatLabel.trim()
    if (!label) return
    onAddCat(type, label, selectedEmoji)
    setNewCatLabel('')
    setSelectedEmoji('📦')
    setAddingCat(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-orange-100/70 p-1">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-lg px-4 py-1.5 text-sm transition ${
                type === t
                  ? t === 'expense'
                    ? 'bg-white text-rose-500 font-semibold shadow-sm'
                    : 'bg-white text-emerald-600 font-semibold shadow-sm'
                  : 'text-stone-500'
              }`}
            >
              {t === 'expense' ? '支出' : '收入'}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-36">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">¥</span>
          <input
            className="warm-input w-full pl-7"
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          />
        </div>
        <input type="date" className="warm-input" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          className="warm-input flex-1 min-w-32"
          placeholder="备注（可选）"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {builtin.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-xl px-2.5 py-1.5 text-sm transition border ${
              category === c.key ? 'bg-orange-100 border-orange-300 shadow-sm scale-105' : 'border-transparent hover:bg-orange-50'
            }`}
          >
            <span>{c.emoji}</span>
            <span className="ml-1 text-xs text-stone-600">{c.label}</span>
          </button>
        ))}
        {/* 自定义分类 */}
        {custom.map((c) => (
          <div key={c.key} className="relative group/cat inline-flex">
            <button
              onClick={() => setCategory(c.key)}
              className={`rounded-xl px-2.5 py-1.5 text-sm transition border ${
                category === c.key ? 'bg-orange-100 border-orange-300 shadow-sm scale-105' : 'border-transparent hover:bg-orange-50'
              }`}
            >
              <span>{c.emoji}</span>
              <span className="ml-1 text-xs text-stone-600">{c.label}</span>
            </button>
            <button
              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-stone-300 text-white text-[10px] flex items-center justify-center opacity-0 group-hover/cat:opacity-100 hover:bg-rose-400 transition"
              onClick={(e) => { e.stopPropagation(); onDeleteCat(c.id) }}
              title="删除自定义分类"
            >
              <X size={8} />
            </button>
          </div>
        ))}
        {/* 添加自定义分类 */}
        {addingCat ? (
          <span className="inline-flex items-center gap-1.5">
            <input
              className="warm-input !py-1.5 !px-2.5 text-sm w-28"
              placeholder="分类名称"
              value={newCatLabel}
              autoFocus
              onChange={(e) => setNewCatLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewCat(); if (e.key === 'Escape') setAddingCat(false) }}
            />
            <button className="warm-btn !px-3 !py-2" onClick={submitNewCat} aria-label="确认新增">
              <Plus size={14} />
            </button>
            <button className="warm-btn-ghost !px-3 !py-2" onClick={() => setAddingCat(false)} aria-label="取消">
              <X size={14} />
            </button>
          </span>
        ) : (
          <button
            className="rounded-xl px-2.5 py-1.5 text-sm border border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 transition"
            onClick={() => setAddingCat(true)}
          >
            ＋ 自定义
          </button>
        )}
      </div>
    </div>
  )
}

function AddForm({ onSaved, customCats, onAddCat, onDeleteCat }: { onSaved: () => void; customCats: CustomCat[]; onAddCat: (type: TxType, label: string, emoji: string) => void; onDeleteCat: (id: number) => void }) {
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const switchType = (t: TxType) => {
    setType(t)
    setCategory(t === 'expense' ? 'food' : 'salary')
  }

  const submit = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('请输入正确的金额')
      return
    }
    setError('')
    await api.createTransaction({ type, amount: value, category, note: note.trim(), date })
    setAmount('')
    setNote('')
    onSaved()
  }

  return (
    <section className="warm-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-orange-950">记一笔</h3>
        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>
      <div className="mt-3">
        <TxFields
          type={type} setType={switchType}
          amount={amount} setAmount={setAmount}
          category={category} setCategory={setCategory}
          date={date} setDate={setDate}
          note={note} setNote={setNote}
          customCats={customCats}
          onAddCat={onAddCat}
          onDeleteCat={onDeleteCat}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button className="warm-btn" onClick={submit}>
          <Plus size={16} /> 保存
        </button>
      </div>
    </section>
  )
}

function EditTxDialog({ tx, onClose, onSaved, customCats, onAddCat, onDeleteCat }: { tx: Transaction; onClose: () => void; onSaved: () => void; customCats: CustomCat[]; onAddCat: (type: TxType, label: string, emoji: string) => void; onDeleteCat: (id: number) => void }) {
  const [type, setType] = useState<TxType>(tx.type)
  const [amount, setAmount] = useState(String(tx.amount / 100))
  const [category, setCategory] = useState(tx.category)
  const [date, setDate] = useState(tx.date)
  const [note, setNote] = useState(tx.note)

  const switchType = (t: TxType) => {
    setType(t)
    setCategory(t === 'expense' ? 'food' : 'salary')
  }

  const save = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    await api.updateTransaction(tx.id, { type, amount: value, category, note: note.trim(), date })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="warm-card relative w-full max-w-lg p-6 shadow-xl">
        <h4 className="font-semibold text-orange-950">编辑记录</h4>
        <div className="mt-4">
          <TxFields
            type={type} setType={switchType}
            amount={amount} setAmount={setAmount}
            category={category} setCategory={setCategory}
            date={date} setDate={setDate}
            note={note} setNote={setNote}
            customCats={customCats}
            onAddCat={onAddCat}
            onDeleteCat={onDeleteCat}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="warm-btn-ghost" onClick={onClose}>取消</button>
          <button className="warm-btn" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  )
}
