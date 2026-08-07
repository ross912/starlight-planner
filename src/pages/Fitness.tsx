import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Dumbbell, Plus, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { BADMINTON_TYPES, WEATHERS, WEEKDAYS, badmintonTypeOf, fmtDuration, weatherOf } from '../lib/constants'
import type { Exercise, MatchType, Workout } from '../types'


export default function FitnessPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [date, setDate] = useState(todayStr)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])

  const load = useCallback(async () => {
    const [w, e] = await Promise.all([api.listWorkouts(date), api.listExercises()])
    setWorkouts(w)
    setExercises(e)
  }, [date])

  useEffect(() => {
    // 微任务中加载，避免在 effect 同步阶段触发 setState
    queueMicrotask(() => { load().catch(console.error) })
  }, [load])

  const remove = async (id: number) => {
    await api.deleteWorkout(id)
    load()
  }

  const strength = useMemo(() => workouts.filter((w) => w.type === 'strength'), [workouts])
  const runs = useMemo(() => workouts.filter((w) => w.type === 'run'), [workouts])
  const badmintons = useMemo(() => workouts.filter((w) => w.type === 'badminton'), [workouts])

  const d = parseISO(date)
  const summary = useMemo(() => {
    const parts: string[] = []
    const exSet = new Set(strength.map((w) => w.exercise))
    const totalSets = strength.reduce((s, w) => s + (w.sets ?? 0), 0)
    if (strength.length) parts.push(`力量 ${exSet.size} 项 ${totalSets} 组`)
    const dist = runs.reduce((s, w) => s + (w.distanceKm ?? 0), 0)
    const runMin = runs.reduce((s, w) => s + (w.durationMin ?? 0), 0)
    if (runs.length) parts.push(`跑步 ${dist.toFixed(1)} 公里 ${runMin} 分钟`)
    const bMin = badmintons.reduce((s, w) => s + (w.durationMin ?? 0), 0)
    if (badmintons.length) parts.push(`羽毛球 ${bMin} 分钟`)
    return parts
  }, [strength, runs, badmintons])

  return (
    <div className="space-y-5">
      {/* 头部 + 日期导航 */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-950">健身</h2>
          <p className="mt-1 hidden text-sm text-stone-500 sm:block">文明精神，野蛮体魄。</p>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button className="warm-btn-ghost min-h-11 min-w-11 !px-2" aria-label="前一天" onClick={() => setDate(format(addDays(d, -1), 'yyyy-MM-dd'))}>
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-28 text-center text-sm font-medium text-stone-700 sm:min-w-40">
            {d.getMonth() + 1}月{d.getDate()}日 周{WEEKDAYS[d.getDay()]}
          </span>
          <button className="warm-btn-ghost min-h-11 min-w-11 !px-2" aria-label="后一天" onClick={() => setDate(format(addDays(d, 1), 'yyyy-MM-dd'))} disabled={date >= todayStr}>
            <ChevronRight size={16} />
          </button>
          {date !== todayStr && (
            <button className="warm-btn-ghost min-h-11 text-xs" onClick={() => setDate(todayStr)}>回今天</button>
          )}
        </div>
      </header>

      {/* 当日概览 */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {summary.length > 0 ? (
          summary.map((s) => <span key={s} className="warm-chip !px-3 !py-1.5 !text-xs sm:!px-3.5 sm:!text-sm">💪 {s}</span>)
        ) : (
          <span className="text-sm text-stone-400">这一天还没有运动记录，从下面开始吧</span>
        )}
      </div>

      <StrengthCard date={date} entries={strength} exercises={exercises} onChanged={load} onRemove={remove} />
      <RunCard date={date} entries={runs} onChanged={load} onRemove={remove} />
      <BadmintonCard date={date} entries={badmintons} onChanged={load} onRemove={remove} />
    </div>
  )
}

/* ---------------- 力量训练 ---------------- */

function StrengthCard({
  date, entries, exercises, onChanged, onRemove,
}: {
  date: string
  entries: Workout[]
  exercises: Exercise[]
  onChanged: () => void
  onRemove: (id: number) => void
}) {
  const [selected, setSelected] = useState('')
  const [kg, setKg] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [addingEx, setAddingEx] = useState(false)
  const [newEx, setNewEx] = useState('')

  const current = selected || exercises[0]?.name || ''

  // 当日全部力量记录，按项目分组罗列（与选择哪个标签无关）
  const grouped = useMemo(() => {
    const map = new Map<string, Workout[]>()
    for (const w of entries) {
      const key = w.exercise ?? '其他'
      const arr = map.get(key) ?? []
      arr.push(w)
      map.set(key, arr)
    }
    return [...map.entries()]
  }, [entries])

  const addExercise = async () => {
    const name = newEx.trim()
    if (!name) return
    const ex = await api.createExercise(name)
    setNewEx('')
    setAddingEx(false)
    setSelected(ex.name)
    onChanged()
  }

  const removeExercise = async (e: Exercise) => {
    if (!window.confirm(`删除项目「${e.name}」？已记录的历史健身数据会保留。`)) return
    await api.deleteExercise(e.id)
    if (current === e.name) setSelected('')
    onChanged()
  }

  const addEntry = async () => {
    const weight = Number(kg)
    const s = Number(sets)
    const r = Number(reps)
    if (!current || !Number.isFinite(weight) || weight < 0 || !Number.isFinite(s) || s < 1 || !Number.isFinite(r) || r < 1) return
    await api.createWorkout({ type: 'strength', date, exercise: current, weightKg: weight, sets: s, reps: r })
    setKg('')
    setSets('')
    setReps('')
    onChanged()
  }

  return (
    <section className="warm-card p-4 sm:p-5">
      <h3 className="font-semibold text-orange-950 flex items-center gap-2">
        <Dumbbell size={17} className="text-orange-500" /> 力量训练
      </h3>

      {/* 项目选择（选择录入对象，不影响下方记录展示） */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {exercises.map((e) => (
          <span key={e.id} className="group/ex relative inline-flex">
            <button
              onClick={() => setSelected(e.name)}
              className={`rounded-xl px-3 py-2 text-xs sm:text-sm transition border ${
                current === e.name
                  ? 'bg-orange-100 border-orange-300 font-medium text-orange-800 shadow-sm'
                  : 'border-transparent bg-white/60 text-stone-500 hover:bg-orange-50'
              }`}
            >
              {e.name}
            </button>
            <button
              onClick={() => removeExercise(e)}
              title={`删除项目「${e.name}」`}
              aria-label={`删除项目「${e.name}」`}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-stone-300 text-white hover:bg-rose-400 sm:hidden sm:group-hover/ex:flex"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {addingEx ? (
          <span className="inline-flex items-center gap-1">
            <input
              className="warm-input !py-1.5 !px-2.5 text-sm w-32"
              placeholder="新项目名称"
              value={newEx}
              autoFocus
              onChange={(e) => setNewEx(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExercise()}
            />
            <button className="warm-btn !px-3 !py-2" onClick={addExercise} aria-label="确认新增项目"><Plus size={14} /></button>
            <button className="warm-btn-ghost !px-3 !py-2" onClick={() => setAddingEx(false)} aria-label="取消新增项目"><X size={14} /></button>
          </span>
        ) : (
          <button
            className="rounded-xl px-3 py-2 text-sm border border-dashed border-orange-300 text-orange-600 hover:bg-orange-50 transition"
            onClick={() => setAddingEx(true)}
          >
            ＋ 自定义项目
          </button>
        )}
      </div>

      {/* 录入区：重量 kg × 组数 × 每组个数 */}
      {current && (
        <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-orange-800">录入「{current}」</span>
            <span className="text-[11px] text-stone-400">自重项目重量填 0</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 sm:gap-2">
            <input
              className="warm-input min-w-0 flex-1 !bg-white !px-2"
              placeholder="重量"
              inputMode="decimal"
              aria-label="重量（kg）"
              value={kg}
              onChange={(e) => setKg(e.target.value.replace(/[^\d.]/g, ''))}
            />
            <span className="shrink-0 text-xs text-stone-400 sm:text-sm">kg ×</span>
            <input
              className="warm-input min-w-0 flex-1 !bg-white !px-2"
              placeholder="组数"
              inputMode="numeric"
              aria-label="组数"
              value={sets}
              onChange={(e) => setSets(e.target.value.replace(/\D/g, ''))}
            />
            <span className="shrink-0 text-xs text-stone-400 sm:text-sm">组 ×</span>
            <input
              className="warm-input min-w-0 flex-1 !bg-white !px-2"
              placeholder="个数"
              inputMode="numeric"
              aria-label="每组个数"
              value={reps}
              onChange={(e) => setReps(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            />
            <span className="shrink-0 text-xs text-stone-400 sm:text-sm">个</span>
            <button className="warm-btn shrink-0 !px-3 !py-2" onClick={addEntry}>
              <Plus size={15} /> 添加
            </button>
          </div>
        </div>
      )}

      {/* 当日全部力量记录，按项目分组罗列 */}
      <div className="mt-4">
        <p className="text-xs font-medium text-stone-500">今日力量记录（{entries.length} 条）</p>
        {grouped.length > 0 ? (
          <div className="mt-2 space-y-3">
            {grouped.map(([ex, items]) => (
              <div key={ex}>
                <p className="text-xs font-semibold text-orange-800">
                  {ex}
                  <span className="ml-1.5 font-normal text-stone-400">{items.length} 条</span>
                </p>
                <ul className="mt-1">
                  {items.map((w) => (
                    <li key={w.id} className="group flex items-center gap-3 border-b border-orange-100/80 py-2.5 last:border-0">
                      <span className="flex-1 text-sm text-stone-800">
                        {w.weightKg === 0 ? '自重' : <><b className="text-orange-800">{w.weightKg}</b> kg</>}
                        <span className="mx-1.5 text-stone-300">×</span>
                        <b className="text-orange-800">{w.sets}</b> 组
                        {w.reps ? (
                          <>
                            <span className="mx-1.5 text-stone-300">×</span>
                            <b className="text-orange-800">{w.reps}</b> 个
                          </>
                        ) : null}
                      </span>
                      <button
                        className="warm-btn-ghost !p-2 text-stone-400 hover:text-red-500 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => onRemove(w.id)}
                        title="删除"
                        aria-label="删除该条记录"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 py-3 text-xs text-stone-400">今天还没有力量训练记录，选一个项目在上面录入</p>
        )}
      </div>
    </section>
  )
}

/* ---------------- 跑步 ---------------- */

function RunCard({ date, entries, onChanged, onRemove }: { date: string; entries: Workout[]; onChanged: () => void; onRemove: (id: number) => void }) {
  const [dur, setDur] = useState('')
  const [dist, setDist] = useState('')
  const [weather, setWeather] = useState('')

  const add = async () => {
    const d = Number(dur) || 0
    const k = Number(dist) || 0
    if (d <= 0 && k <= 0) return
    await api.createWorkout({ type: 'run', date, durationMin: d, distanceKm: k, weather })
    setDur('')
    setDist('')
    setWeather('')
    onChanged()
  }

  return (
    <section className="warm-card p-4 sm:p-5">
      <h3 className="font-semibold text-orange-950">🏃 跑步</h3>
      <ul className="mt-2">
        {entries.map((w) => (
          <li key={w.id} className="group flex items-center gap-3 border-b border-orange-100/80 py-2.5 last:border-0">
            <span className="flex-1 text-sm text-stone-800">
              {w.distanceKm ? <><b className="text-orange-800">{w.distanceKm}</b> 公里</> : null}
              {w.distanceKm && w.durationMin ? ' · ' : ''}
              {w.durationMin ? <><b className="text-orange-800">{fmtDuration(w.durationMin)}</b></> : null}
              {w.weather && <span className="ml-2">{weatherOf(w.weather)?.emoji} {weatherOf(w.weather)?.label}</span>}
            </span>
            <button className="warm-btn-ghost !p-2 text-stone-400 hover:text-red-500 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" onClick={() => onRemove(w.id)} title="删除" aria-label="删除该条记录">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {entries.length === 0 && <li className="py-3 text-xs text-stone-400">今天还没有跑步记录</li>}
      </ul>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <input className="warm-input min-w-0 flex-1 !px-2" placeholder="公里数" inputMode="decimal" aria-label="公里数" value={dist} onChange={(e) => setDist(e.target.value.replace(/[^\d.]/g, ''))} />
          <span className="shrink-0 text-xs text-stone-400 sm:text-sm">km</span>
          <input className="warm-input min-w-0 flex-1 !px-2" placeholder="时长" inputMode="numeric" aria-label="时长（分钟）" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ''))} />
          <span className="shrink-0 text-xs text-stone-400 sm:text-sm">分钟</span>
          <button className="warm-btn shrink-0 !px-3 !py-2" onClick={add}><Plus size={15} /> 添加</button>
        </div>
        <div className="flex gap-1">
          {WEATHERS.slice(0, 5).map((w) => (
            <button
              key={w.key}
              title={w.label}
              aria-label={`天气：${w.label}`}
              onClick={() => setWeather(weather === w.key ? '' : w.key)}
              className={`flex-1 rounded-lg px-1.5 py-2 text-base transition border sm:flex-none ${weather === w.key ? 'bg-orange-100 border-orange-300' : 'border-transparent hover:bg-orange-50'}`}
            >
              {w.emoji}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------- 羽毛球 ---------------- */

function BadmintonCard({ date, entries, onChanged, onRemove }: { date: string; entries: Workout[]; onChanged: () => void; onRemove: (id: number) => void }) {
  const [matchType, setMatchType] = useState<MatchType>('ms')
  const [dur, setDur] = useState('')

  const add = async () => {
    const d = Number(dur)
    if (!Number.isFinite(d) || d < 1) return
    await api.createWorkout({ type: 'badminton', date, matchType, durationMin: d })
    setDur('')
    onChanged()
  }

  return (
    <section className="warm-card p-4 sm:p-5">
      <h3 className="font-semibold text-orange-950">🏸 羽毛球</h3>
      <ul className="mt-2">
        {entries.map((w) => (
          <li key={w.id} className="group flex items-center gap-3 border-b border-orange-100/80 py-2.5 last:border-0">
            <span className="flex-1 text-sm text-stone-800">
              <b className="text-orange-800">{badmintonTypeOf(w.matchType ?? '')?.label}</b>
              <span className="mx-1.5 text-stone-300">·</span>
              {fmtDuration(w.durationMin ?? 0)}
            </span>
            <button className="warm-btn-ghost !p-2 text-stone-400 hover:text-red-500 transition-opacity sm:opacity-0 sm:group-hover:opacity-100" onClick={() => onRemove(w.id)} title="删除" aria-label="删除该条记录">
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {entries.length === 0 && <li className="py-3 text-xs text-stone-400">今天还没有打球记录</li>}
      </ul>

      <div className="mt-3 space-y-2">
        <div className="flex rounded-xl bg-orange-100/70 p-1">
          {BADMINTON_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setMatchType(t.key)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm transition sm:flex-none sm:px-3.5 ${matchType === t.key ? 'bg-white text-orange-700 font-semibold shadow-sm' : 'text-stone-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <input className="warm-input min-w-0 flex-1 !px-2" placeholder="时长" inputMode="numeric" aria-label="时长（分钟）" value={dur} onChange={(e) => setDur(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <span className="shrink-0 text-xs text-stone-400 sm:text-sm">分钟</span>
          <button className="warm-btn shrink-0 !px-3 !py-2" onClick={add}><Plus size={15} /> 添加</button>
        </div>
      </div>
    </section>
  )
}
