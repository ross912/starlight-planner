import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import StatCard from '../components/StatCard'
import { LEVEL_DEFS, fenToYuan, moodOf, txCatOf } from '../lib/constants'
import type { StatsOverview } from '../types'

export default function StatsPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null)

  useEffect(() => {
    api.stats().then(setStats).catch(console.error)
  }, [])

  const trend = useMemo(
    () =>
      (stats?.todos.trend ?? []).map((t) => ({
        ...t,
        label: `${Number(t.date.slice(5, 7))}/${Number(t.date.slice(8, 10))}`,
        undone: Math.max(0, t.total - t.done),
      })),
    [stats],
  )

  const moodData = useMemo(
    () =>
      (stats?.diary.moodDistribution ?? [])
        .map((m) => ({ name: moodOf(m.mood)?.label ?? m.mood, emoji: moodOf(m.mood)?.emoji ?? '', value: m.count, color: moodOf(m.mood)?.color ?? '#f59e0b' }))
        .sort((a, b) => b.value - a.value),
    [stats],
  )

  const totals = useMemo(() => {
    if (!stats) return { total: 0, done: 0, rate: 0 }
    const all = Object.values(stats.todos.levelStats)
    const total = all.reduce((s, x) => s + x.total, 0)
    const done = all.reduce((s, x) => s + x.done, 0)
    return { total, done, rate: total ? Math.round((done / total) * 100) : 0 }
  }, [stats])

  // 热力图：7 行（周一~周日）× 12 列（周）
  const heatColumns = useMemo(() => {
    const days = stats?.diary.heatmap ?? []
    if (!days.length) return []
    const first = new Date(days[0].date)
    const offset = (first.getDay() + 6) % 7 // 周一开头
    const cells: ({ date: string; has: boolean } | null)[] = [...Array(offset).fill(null), ...days]
    const cols: (typeof cells)[] = []
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7))
    return cols
  }, [stats])

  if (!stats) {
    return <p className="py-20 text-center text-sm text-stone-400">统计加载中…</p>
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-950">统计</h2>
        <p className="mt-1 text-sm text-stone-500">坚持的痕迹，看得见。</p>
      </header>

      {/* 总览卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard icon="📖" label="日记总数" value={stats.diary.total} unit="篇" />
        <StatCard icon="🔥" label="连续写日记" value={stats.diary.streak} unit="天" />
        <StatCard icon="✅" label="任务总数" value={totals.total} unit="项" />
        <StatCard icon="🎯" label="总完成率" value={totals.rate} unit="%" />
        <StatCard icon="⚡" label="连续完成日计划" value={stats.todos.taskStreak} unit="天" />
        <Link to="/reading" className="warm-card px-3.5 py-3 sm:px-5 sm:py-4 block transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-8px_rgba(194,120,40,0.4)]">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <span>📚</span>
            今年读完
          </p>
          <p className="mt-2 text-2xl font-bold text-orange-900">
            {stats.books.doneThisYear}
            <span className="ml-1 text-sm font-normal text-stone-400">本</span>
            {stats.books.reading > 0 && <span className="ml-2 text-xs font-normal text-orange-600">在读 {stats.books.reading}</span>}
          </p>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 近 14 天日计划 */}
        <section className="warm-card p-4 sm:p-5">
          <h3 className="font-semibold text-orange-950">近 14 天 · 日计划完成情况</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5e0c3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={{ stroke: '#f5e0c3' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: 'rgba(251,191,36,0.12)' }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #fde8cd', fontSize: 12 }}
                  formatter={(v: number, name: string) => [v, name === 'done' ? '已完成' : '未完成']}
                  labelFormatter={(l) => `日期 ${l}`}
                />
                <Legend formatter={(v) => (v === 'done' ? '已完成' : '未完成')} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="done" stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                <Bar dataKey="undone" stackId="a" fill="#fde3c2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 心情分布 */}
        <section className="warm-card p-4 sm:p-5">
          <h3 className="font-semibold text-orange-950">心情分布</h3>
          {moodData.length > 0 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={moodData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3}>
                    {moodData.map((m) => (
                      <Cell key={m.name} fill={m.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #fde8cd', fontSize: 12 }}
                    formatter={(v: number, name: string) => {
                      const m = moodData.find((x) => x.name === name)
                      return [`${m?.emoji ?? ''} ${v} 天`, name]
                    }}
                  />
                  <Legend formatter={(v) => v} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-stone-400">写日记时记录心情后，这里会出现分布图</p>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 五层完成率 */}
        <section className="warm-card p-4 sm:p-5">
          <h3 className="font-semibold text-orange-950">五层计划完成率</h3>
          <div className="mt-4 space-y-3.5">
            {LEVEL_DEFS.map((def) => {
              const s = stats.todos.levelStats[def.key]
              const pct = s.total ? Math.round((s.done / s.total) * 100) : 0
              return (
                <div key={def.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-700">
                      {def.icon} {def.label}
                    </span>
                    <span className="text-xs text-stone-400">
                      {s.done}/{s.total} · <span className="text-orange-700 font-semibold">{pct}%</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-orange-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 日记热力图 */}
        <section className="warm-card p-4 sm:p-5">
          <h3 className="font-semibold text-orange-950">近 12 周 · 日记打卡</h3>
          <div className="mt-4 flex gap-1 overflow-x-auto pb-2">
            {heatColumns.map((col, i) => (
              <div key={i} className="flex flex-col gap-1">
                {col.map((cell, j) =>
                  cell ? (
                    <div
                      key={j}
                      title={cell.date}
                      className={`h-4 w-4 rounded-[4px] transition ${
                        cell.has ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-orange-100/70'
                      }`}
                    />
                  ) : (
                    <div key={j} className="h-4 w-4" />
                  ),
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-xs text-stone-400">
            <span>未写</span>
            <div className="h-3 w-3 rounded-[3px] bg-orange-100/70" />
            <div className="h-3 w-3 rounded-[3px] bg-gradient-to-br from-amber-400 to-orange-500" />
            <span>已写</span>
          </div>
        </section>
      </div>

      {/* 健身汇总 */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-orange-950">💪 健身汇总</h3>
          <Link to="/fitness" className="text-xs text-orange-600 hover:text-orange-800">去健身 →</Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="✅" label="本月运动" value={stats.fitness.month.days} unit="天" />
          <StatCard icon="🏃" label="本月跑步" value={Number(stats.fitness.month.runKm.toFixed(1))} unit="公里" />
          <StatCard icon="🏸" label="本月羽毛球" value={stats.fitness.month.badmintonMin} unit="分钟" />
          <StatCard icon="📅" label="运动记录" value={stats.fitness.monthSessions} unit="条" />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* 近 14 天运动打卡 */}
          <section className="warm-card p-4 sm:p-5">
            <h3 className="font-semibold text-orange-950">近 14 天 · 运动打卡</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.fitness.trend.map((t) => ({ ...t, label: `${Number(t.date.slice(5, 7))}/${Number(t.date.slice(8, 10))}` }))} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5e0c3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={{ stroke: '#f5e0c3' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    cursor={{ fill: 'rgba(251,191,36,0.12)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #fde8cd', fontSize: 12 }}
                    formatter={(v: number) => [`${v} 条`, '运动记录']}
                    labelFormatter={(l) => `日期 ${l}`}
                  />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 力量 PR 榜 */}
          <section className="warm-card p-4 sm:p-5">
            <h3 className="font-semibold text-orange-950">力量 PR 榜（各项目最大重量）</h3>
            {stats.fitness.prs.length > 0 ? (
              <div className="mt-4 space-y-3">
                {stats.fitness.prs.map((p) => {
                  const max = stats.fitness.prs[0].weightKg || 1
                  return (
                    <div key={p.exercise}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-stone-700">{p.exercise}</span>
                        <span className="text-xs text-orange-700 font-semibold">{p.weightKg} kg</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-orange-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
                          style={{ width: `${Math.round((p.weightKg / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-stone-400">录入力量训练后，这里会出现你的 PR 榜</p>
            )}
          </section>
        </div>
      </section>

      {/* 记账年度汇总 */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-orange-950">💰 {stats.money.year} 年记账汇总</h3>
          <Link to="/money" className="text-xs text-orange-600 hover:text-orange-800">去记账 →</Link>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
            <p className="text-xs text-stone-500">本年支出</p>
            <p className="mt-2 text-xl md:text-2xl font-bold text-rose-500">¥{fenToYuan(stats.money.yearExpense)}</p>
          </div>
          <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
            <p className="text-xs text-stone-500">本年收入</p>
            <p className="mt-2 text-xl md:text-2xl font-bold text-emerald-600">¥{fenToYuan(stats.money.yearIncome)}</p>
          </div>
          <div className="warm-card px-3.5 py-3 sm:px-5 sm:py-4">
            <p className="text-xs text-stone-500">本年结余</p>
            <p className={`mt-2 text-xl md:text-2xl font-bold ${stats.money.yearIncome - stats.money.yearExpense >= 0 ? 'text-orange-700' : 'text-rose-500'}`}>
              {stats.money.yearIncome - stats.money.yearExpense < 0 && '-'}¥{fenToYuan(Math.abs(stats.money.yearIncome - stats.money.yearExpense))}
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* 全年逐月收支 */}
          <section className="warm-card p-4 sm:p-5">
            <h3 className="font-semibold text-orange-950">逐月收支趋势</h3>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.money.yearTrend.map((m) => ({ ...m, label: `${Number(m.month.slice(5, 7))}月`, e: m.expense / 100, i: m.income / 100 }))} barSize={7}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5e0c3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={{ stroke: '#f5e0c3' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip
                    cursor={{ fill: 'rgba(251,191,36,0.12)' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #fde8cd', fontSize: 12 }}
                    formatter={(v: number, name: string) => [`¥${v.toLocaleString('zh-CN')}`, name === 'e' ? '支出' : '收入']}
                  />
                  <Legend formatter={(v) => (v === 'e' ? '支出' : '收入')} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="e" fill="#fb923c" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="i" fill="#34d399" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 全年支出分类 */}
          <section className="warm-card p-4 sm:p-5">
            <h3 className="font-semibold text-orange-950">全年支出分类</h3>
            {stats.money.yearByCategory.length > 0 ? (
              <div className="mt-4 space-y-3">
                {stats.money.yearByCategory.slice(0, 8).map((c) => {
                  const cat = txCatOf('expense', c.category)
                  const max = stats.money.yearByCategory[0].total || 1
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-stone-700">{cat?.emoji} {cat?.label ?? c.category}</span>
                        <span className="text-xs text-stone-400">¥{fenToYuan(c.total)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-orange-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.round((c.total / max) * 100)}%`, background: cat?.color ?? '#fb923c' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="py-16 text-center text-sm text-stone-400">今年还没有支出记录</p>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
