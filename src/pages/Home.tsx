import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Flame, NotebookPen, Plus, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../lib/api'
import StatCard from '../components/StatCard'
import { LEVEL_DEFS, fenToYuan, moodOf, weatherOf } from '../lib/constants'
import type { Diary, StatsOverview, Todo } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const GREETINGS = [
  { until: 6, text: '夜深了，注意休息 🌙' },
  { until: 11, text: '早上好，新的一天开始了 ☀️' },
  { until: 14, text: '中午好，记得吃午饭 🍜' },
  { until: 18, text: '下午好，继续加油 🍵' },
  { until: 24, text: '晚上好，今天过得怎么样 🌆' },
]

export default function Home() {
  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const [todos, setTodos] = useState<Todo[]>([])
  const [diary, setDiary] = useState<Diary | null>(null)
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [newTitle, setNewTitle] = useState('')

  const greeting = GREETINGS.find((g) => now.getHours() < g.until)?.text ?? '你好'

  const load = async () => {
    const [t, s] = await Promise.all([api.listTodos('daily', todayStr), api.stats()])
    setTodos(t)
    setStats(s)
    try {
      setDiary(await api.getDiary(todayStr))
    } catch {
      setDiary(null)
    }
  }

  useEffect(() => {
    load().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doneCount = todos.filter((t) => t.done).length
  const rate = todos.length ? Math.round((doneCount / todos.length) * 100) : 0

  const toggle = async (todo: Todo) => {
    // 首页快捷切换：完成 ✅ ↔ 待办 ☐（❌ 状态点击后也会变为 ✅）
    await api.updateTodo(todo.id, { status: todo.status === 'done' ? 'pending' : 'done' })
    load()
  }

  const addTodo = async () => {
    if (!newTitle.trim()) return
    await api.createTodo({ level: 'daily', period: todayStr, title: newTitle.trim() })
    setNewTitle('')
    load()
  }

  const levelCards = useMemo(() => {
    if (!stats) return []
    return LEVEL_DEFS.map((def) => {
      const s = stats.todos.levelStats[def.key]
      return { ...def, ...s, pct: s.total ? Math.round((s.done / s.total) * 100) : 0 }
    })
  }, [stats])

  return (
    <div className="space-y-6">
      {/* 问候头部 */}
      <header>
        <p className="text-sm text-orange-800/60">
          {format(now, 'yyyy年M月d日')} 星期{WEEKDAYS[now.getDay()]}
        </p>
        <h2 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-orange-950">{greeting}</h2>
      </header>

      {/* 今日核心区域 */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        {/* 今日计划 */}
        <section className="warm-card p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-orange-950 flex items-center gap-2">
              <Sparkles size={17} className="text-orange-500" />
              今日计划
            </h3>
            <span className="text-xs text-stone-500">
              {todos.length ? `已完成 ${doneCount}/${todos.length}` : '还没有安排'}
            </span>
          </div>

          {todos.length > 0 && (
            <div className="mt-3 h-2 rounded-full bg-orange-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                style={{ width: `${rate}%` }}
              />
            </div>
          )}

          <ul className="mt-4 space-y-1.5">
            {todos.map((todo) => (
              <li key={todo.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-orange-50/80 transition">
                <button
                  onClick={() => toggle(todo)}
                  aria-label="切换完成状态"
                  className={`h-5 w-5 shrink-0 rounded-full border-2 transition-all flex items-center justify-center ${
                    todo.done
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-orange-300 hover:border-orange-500'
                  }`}
                >
                  {todo.done && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M2 6.5 4.5 9 10 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className={`text-sm flex-1 ${
                  todo.status === 'done'
                    ? 'line-through text-stone-400'
                    : todo.status === 'failed'
                      ? 'text-stone-400 line-through decoration-rose-300'
                      : 'text-stone-700'
                }`}>
                  {todo.status === 'failed' && <span className="mr-1">❌</span>}
                  {todo.title}
                </span>
                {todo.parentTitle && (
                  <span className="warm-chip opacity-80">↗ {todo.parentTitle}</span>
                )}
              </li>
            ))}
            {todos.length === 0 && (
              <li className="py-6 text-center text-sm text-stone-400">
                今天还没有计划，添加一件想做的事吧 ✨
              </li>
            )}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              className="warm-input flex-1"
              placeholder="添加今日待办，回车保存"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            />
            <button className="warm-btn" onClick={addTodo}>
              <Plus size={16} />
            </button>
          </div>

          <Link to="/plans" className="mt-3 inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800">
            查看全部计划 <ArrowRight size={12} />
          </Link>
        </section>

        {/* 今日日记 */}
        <section className="warm-card p-4 sm:p-5 flex flex-col">
          <h3 className="font-semibold text-orange-950 flex items-center gap-2">
            <NotebookPen size={17} className="text-orange-500" />
            今日日记
          </h3>
          {diary ? (
            <div className="mt-3 flex-1">
              <div className="flex items-center gap-2 text-xl">
                {moodOf(diary.mood)?.emoji}
                {weatherOf(diary.weather)?.emoji}
                {diary.tags.map((t) => (
                  <span key={t} className="warm-chip">#{t}</span>
                ))}
              </div>
              <p className="mt-3 text-sm text-stone-600 leading-relaxed line-clamp-6 whitespace-pre-wrap">
                {diary.content || '（今天还没写内容）'}
              </p>
            </div>
          ) : (
            <div className="mt-3 flex-1 flex flex-col items-center justify-center text-center py-6">
              <span className="text-3xl">📝</span>
              <p className="mt-2 text-sm text-stone-400">今天还没有写日记</p>
            </div>
          )}
          <Link to="/diary" className="warm-btn-ghost mt-3 self-start text-orange-700">
            {diary ? '继续写 →' : '去写今天 →'}
          </Link>
        </section>
      </div>

      {/* 坚持数据 */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard icon="📔" label="连续写日记" value={stats?.diary.streak ?? 0} unit="天" />
        <StatCard icon="🔥" label="连续完成日计划" value={stats?.todos.taskStreak ?? 0} unit="天" />
        <StatCard icon="📖" label="日记总数" value={stats?.diary.total ?? 0} unit="篇" />
        <StatCard
          icon="✅"
          label="任务完成率"
          value={overallRate(stats)}
          unit="%"
        />
        <Link to="/money" className="warm-card px-4 py-3.5 sm:px-5 sm:py-4 block transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-8px_rgba(194,120,40,0.4)]">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <span>💰</span>
            本月结余
          </p>
          <p className={`mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold ${moneyBalance(stats) >= 0 ? 'text-orange-900' : 'text-rose-500'}`}>
            {moneyBalance(stats) < 0 && '-'}¥{fenToYuan(Math.abs(moneyBalance(stats)))}
          </p>
        </Link>
        <Link to="/fitness" className="warm-card px-4 py-3.5 sm:px-5 sm:py-4 block transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-8px_rgba(194,120,40,0.4)]">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <span>💪</span>
            本周运动
          </p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-orange-900">
            {stats?.fitness.weekDays ?? 0}
            <span className="ml-1 text-sm font-normal text-stone-400">天</span>
            {(stats?.fitness.todayCount ?? 0) > 0 && (
              <span className="ml-2 text-xs font-normal text-orange-600">今日 {stats?.fitness.todayCount} 条</span>
            )}
          </p>
        </Link>
      </div>

      {/* 五层计划进度 */}
      <section className="warm-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-orange-950 flex items-center gap-2">
            <Flame size={17} className="text-orange-500" />
            五层计划进度
          </h3>
          <Link to="/plans" className="text-xs text-orange-600 hover:text-orange-800 inline-flex items-center gap-1">
            管理计划 <ArrowRight size={12} />
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {levelCards.map((c) => (
            <div key={c.key} className="rounded-xl border border-orange-100 bg-orange-50/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">
                  {c.icon} {c.label}
                </span>
                <span className="text-xs text-orange-700 font-semibold">{c.pct}%</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-orange-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${c.pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-stone-400">
                {c.done}/{c.total} 项
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function overallRate(stats: StatsOverview | null): number {
  if (!stats) return 0
  const all = Object.values(stats.todos.levelStats)
  const total = all.reduce((s, x) => s + x.total, 0)
  const done = all.reduce((s, x) => s + x.done, 0)
  return total ? Math.round((done / total) * 100) : 0
}

function moneyBalance(stats: StatsOverview | null): number {
  if (!stats?.money) return 0
  return stats.money.income - stats.money.expense
}
