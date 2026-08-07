import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../lib/api'
import { EXPENSE_CATS, INCOME_CATS, fenToYuan, txCatOf } from '../lib/constants'
import type { Transaction, TxStats, TxType } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function MoneyPage() {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [list, setList] = useState<Transaction[]>([])
  const [stats, setStats] = useState<TxStats | null>(null)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [l, s] = await Promise.all([api.listTransactions(month), api.transactionStats(month)])
    setList(l)
    setStats(s)
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
        .map((c) => ({ ...c, ...(txCatOf('expense', c.category) ?? { label: c.category, emoji: '\uD83D\uDCE6', color: '#a8a29e' }) })),
    [stats],
  )

  const balance = (stats?.income ?? 0) - (stats?.expense ?? 0)
  const [y, mo] = month.split('-')

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
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <TrendingDown size={13} className="text-rose-400" /> 本月支出
          </p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-rose-500">¥{fenToYuan(stats?.expense ?? 0)}</p>
        </div>
        <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-500" /> 本月收入
          </p>
          <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold text-emerald-600">¥{fenToYuan(stats?.income ?? 0)}</p>
        </div>
        <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <Wallet size={13} className="text-orange-500" /> 结余
          </p>
          <p className={`mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold ${balance >= 0 ? 'text-orange-700' : 'text-rose-500'}`}>
            {balance < 0 && '-'}¥{fenToYuan(Math.abs(balance))}
          </p>
        </div>
      </div>

      {/* ---- 记一笔 ---- */}
      <AddForm onSaved={load} />

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
                      ? 'bg-orange-100 ring-2 ring-orange-300 scale-95'
                      : isToday
                        ? 'bg-amber-50 ring-1 ring-amber-200'
                        : cell.hasData
                          ? 'bg-stone-50 hover:bg-orange-50'
                          : 'hover:bg-stone-50'
                    }
                  `}
                >
                  <span className={`font-medium ${isToday ? 'text-orange-600' : 'text-stone-600'}`}>
                    {cell.day}
                  </span>
                  {cell.hasData && (
                    <div className="flex flex-col items-center leading-tight mt-0.5">
                      {hasExpense && (
                        <span className="text-[9px] sm:text-[10px] text-rose-400">-¥{fenToYuan(cell.expense)}</span>
                      )}
                      {hasIncome && (
                        <span className="text-[9px] sm:text-[10px] text-emerald-500">+¥{fenToYuan(cell.income)}</span>
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
                  const cat = txCatOf(tx.type, tx.category)
                  return (
                    <li
                      key={tx.id}
                      className="group flex items-center gap-3 px-2 py-2.5 hover:bg-orange-50/40 transition rounded-lg"
                    >
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-base"
                        style={{ background: `${cat?.color ?? '#a8a29e'}1f` }}
                      >
                        {cat?.emoji ?? '\uD83D\uDCE6'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800">{cat?.label ?? tx.category}</p>
                        {tx.note && <p className="text-xs text-stone-400 truncate">{tx.note}</p>}
                      </div>
                      <span
                        className={`text-sm font-semibold ${tx.type === 'expense' ? 'text-rose-500' : 'text-emerald-600'}`}
                      >
                        {tx.type === 'expense' ? '-' : '+'}¥{fenToYuan(tx.amount)}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {editing && <EditTxDialog tx={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

/** 记一笔表单 */
function TxFields({
  type, setType, amount, setAmount, category, setCategory, date, setDate, note, setNote,
}: {
  type: TxType; setType: (t: TxType) => void
  amount: string; setAmount: (v: string) => void
  category: string; setCategory: (v: string) => void
  date: string; setDate: (v: string) => void
  note: string; setNote: (v: string) => void
}) {
  const cats = type === 'expense' ? EXPENSE_CATS : INCOME_CATS
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
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
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
      </div>
    </div>
  )
}

function AddForm({ onSaved }: { onSaved: () => void }) {
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

function EditTxDialog({ tx, onClose, onSaved }: { tx: Transaction; onClose: () => void; onSaved: () => void }) {
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
