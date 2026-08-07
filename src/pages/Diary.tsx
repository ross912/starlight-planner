import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Cloud, Hash, Smile, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { MOODS, WEATHERS, WEEKDAYS, moodOf, weatherOf } from '../lib/constants'
import type { Diary } from '../types'

type Draft = { content: string; mood: string; weather: string; tags: string[] }
const EMPTY: Draft = { content: '', mood: '', weather: '', tags: [] }

export default function DiaryPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [selected, setSelected] = useState(todayStr)
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [entries, setEntries] = useState<Diary[]>([])
  const [tagInput, setTagInput] = useState('')

  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const draftRef = useRef(draft)
  draftRef.current = draft
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const timer = useRef<number | undefined>(undefined)

  const refreshList = useCallback(async () => {
    setEntries(await api.listDiaries({ month }))
  }, [month])

  const flushSave = useCallback(async () => {
    if (!dirtyRef.current) return
    window.clearTimeout(timer.current)
    setStatus('saving')
    await api.saveDiary(selectedRef.current, draftRef.current)
    dirtyRef.current = false
    setDirty(false)
    setStatus('saved')
    refreshList()
  }, [refreshList])

  const loadDate = useCallback(async (date: string) => {
    try {
      const d = await api.getDiary(date)
      setDraft({ content: d.content, mood: d.mood, weather: d.weather, tags: d.tags })
    } catch {
      setDraft(EMPTY)
    }
    setDirty(false)
    dirtyRef.current = false
    setStatus('idle')
  }, [])

  const selectDate = useCallback(async (date: string) => {
    await flushSave()
    setSelected(date)
  }, [flushSave])

  // 初次加载
  useEffect(() => {
    refreshList().catch(console.error)
  }, [refreshList])

  // 切换日期时加载
  useEffect(() => {
    loadDate(selected).catch(console.error)
  }, [selected, loadDate])

  // 修改后 1.2s 自动保存
  const mutate = (patch: Partial<Draft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setDirty(true)
    dirtyRef.current = true
    setStatus('idle')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      flushSave().catch(console.error)
    }, 1200)
  }

  // 离开页面前保存
  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (dirtyRef.current) api.saveDiary(selectedRef.current, draftRef.current).catch(() => {})
  }, [])

  // Ctrl/⌘ + S 立即保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        flushSave().catch(console.error)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flushSave])

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '')
    if (!t || draft.tags.includes(t) || draft.tags.length >= 10) return
    mutate({ tags: [...draft.tags, t] })
    setTagInput('')
  }

  const removeDiary = async () => {
    if (!window.confirm(`确定删除 ${selected} 的日记吗？此操作不可恢复。`)) return
    await api.deleteDiary(selected)
    await loadDate(selected)
    refreshList()
  }

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    setMonth(format(new Date(y, m - 1 + delta, 1), 'yyyy-MM'))
  }

  // 日历数据
  const entryMap = useMemo(() => {
    const m = new Map<string, Diary>()
    for (const e of entries) m.set(e.date, e)
    return m
  }, [entries])

  const cells = useMemo(() => {
    const [year, monthNum] = month.split('-').map(Number)
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    const firstDayOfWeek = new Date(year, monthNum - 1, 1).getDay() // 0=Sun
    const list: ({ day: number; date: string } | null)[] = []
    for (let i = 0; i < firstDayOfWeek; i++) list.push(null)
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      list.push({ day, date: dateStr })
    }
    return list
  }, [month])

  const selDate = parseISO(selected)
  const hasEntry = entryMap.has(selected)
  const [y, mo] = month.split('-')

  return (
    <div className="grid gap-5">
      {/* 上：编辑器 */}
      <section className="warm-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-orange-950">
              {selDate.getFullYear()}年{selDate.getMonth() + 1}月{selDate.getDate()}日
              <span className="ml-2 text-base font-normal text-stone-400">周{WEEKDAYS[selDate.getDay()]}</span>
            </h2>
            <p className="mt-1 text-xs text-stone-400">
              {selected === todayStr ? '今天' : '这一天'}
              {hasEntry ? ' · 已有记录' : ''}
              {' · '}
              {status === 'saving' ? '保存中…' : status === 'saved' ? '已自动保存 ✓' : dirty ? '编辑中…' : '自动保存已开启'}
            </p>
          </div>
          <button onClick={removeDiary} className="warm-btn-ghost text-stone-400 hover:text-red-500" title="删除这篇日记">
            <Trash2 size={16} />
          </button>
        </div>

        {/* 心情 & 天气 */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-stone-500 flex items-center gap-1 mb-2">
              <Smile size={13} /> 今天的心情
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => mutate({ mood: draft.mood === m.key ? '' : m.key })}
                  className={`rounded-xl px-2.5 py-1.5 text-sm transition border ${
                    draft.mood === m.key
                      ? 'bg-orange-100 border-orange-300 shadow-sm scale-105'
                      : 'border-transparent hover:bg-orange-50'
                  }`}
                  title={m.label}
                >
                  <span className="text-lg">{m.emoji}</span>
                  <span className="ml-1 text-xs text-stone-600">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500 flex items-center gap-1 mb-2">
              <Cloud size={13} /> 今天的天气
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEATHERS.map((w) => (
                <button
                  key={w.key}
                  onClick={() => mutate({ weather: draft.weather === w.key ? '' : w.key })}
                  className={`rounded-xl px-2.5 py-1.5 text-sm transition border ${
                    draft.weather === w.key
                      ? 'bg-orange-100 border-orange-300 shadow-sm scale-105'
                      : 'border-transparent hover:bg-orange-50'
                  }`}
                  title={w.label}
                >
                  <span className="text-lg">{w.emoji}</span>
                  <span className="ml-1 text-xs text-stone-600">{w.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 标签 */}
        <div className="mt-5">
          <p className="text-xs font-medium text-stone-500 flex items-center gap-1 mb-2">
            <Hash size={13} /> 标签
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {draft.tags.map((t) => (
              <span key={t} className="warm-chip">
                #{t}
                <button onClick={() => mutate({ tags: draft.tags.filter((x) => x !== t) })} className="hover:text-red-500">
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              className="warm-input !py-1 !px-2.5 text-xs w-36"
              placeholder="加标签，回车确认"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
            />
          </div>
        </div>

        {/* 正文 */}
        <textarea
          className="warm-input mt-5 w-full min-h-[320px] resize-y leading-relaxed text-[15px]"
          placeholder={'今天发生了什么？\n随手记下此刻的想法、值得感恩的小事、或者明天的期待…'}
          value={draft.content}
          onChange={(e) => mutate({ content: e.target.value })}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
          <span>{draft.content.length} 字</span>
          <span>Ctrl/⌘ + S 立即保存</span>
        </div>
      </section>

      {/* 下：月历 */}
      <aside className="warm-card p-4">
        {/* 月份导航 */}
        <div className="flex items-center justify-between mb-3 max-w-sm mx-auto w-full">
          <button className="warm-btn-ghost !px-2 min-h-9" onClick={() => shiftMonth(-1)} aria-label="上个月">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-stone-700">{y}年{Number(mo)}月</span>
          <button className="warm-btn-ghost !px-2 min-h-9" onClick={() => shiftMonth(1)} aria-label="下个月">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 星期头 */}
        <div className="grid grid-cols-7 gap-0.5 mb-1 max-w-sm mx-auto w-full">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[11px] text-stone-400 py-1">
              {w}
            </div>
          ))}
        </div>

        {/* 日历格子 */}
        <div className="grid grid-cols-7 gap-0.5 max-w-sm mx-auto w-full">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} className="aspect-square" />

            const entry = entryMap.get(cell.date)
            const isToday = cell.date === todayStr
            const isSelected = cell.date === selected
            const isFuture = cell.date > todayStr

            return (
              <button
                key={cell.date}
                disabled={isFuture}
                onClick={() => { void selectDate(cell.date) }}
                className={`
                  aspect-square rounded-lg flex flex-col items-center justify-center transition text-[11px]
                  ${isSelected
                    ? 'bg-orange-100 ring-2 ring-orange-300 scale-95'
                    : isToday
                      ? 'bg-amber-50 ring-1 ring-amber-200'
                      : entry
                        ? 'bg-stone-50 hover:bg-orange-50'
                        : 'hover:bg-stone-50'
                  }
                  ${isFuture ? 'opacity-30 cursor-default' : ''}
                `}
              >
                <span className={`font-medium ${isToday ? 'text-orange-600' : 'text-stone-600'}`}>
                  {cell.day}
                </span>
                {entry && (
                  <span className="text-[10px] leading-tight mt-0.5">
                    {moodOf(entry.mood)?.emoji ?? ''}{weatherOf(entry.weather)?.emoji ?? ''}
                    {!entry.mood && !entry.weather && <span className="inline-block h-1 w-1 rounded-full bg-orange-400" />}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 回到今天 */}
        {selected !== todayStr && (
          <button
            className="warm-btn-ghost mt-3 text-xs w-full"
            onClick={() => {
              setMonth(format(new Date(), 'yyyy-MM'))
              void selectDate(todayStr)
            }}
          >
            回到今天
          </button>
        )}
      </aside>
    </div>
  )
}
