import { useCallback, useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Cloud, Hash, Search, Smile, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import { MOODS, WEATHERS, moodOf, weatherOf } from '../lib/constants'
import type { Diary } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
type Draft = { content: string; mood: string; weather: string; tags: string[] }
const EMPTY: Draft = { content: '', mood: '', weather: '', tags: [] }

export default function DiaryPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [selected, setSelected] = useState(todayStr)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [entries, setEntries] = useState<Diary[]>([])
  const [query, setQuery] = useState('')
  const [tagInput, setTagInput] = useState('')

  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const draftRef = useRef(draft)
  draftRef.current = draft
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const timer = useRef<number | undefined>(undefined)

  const refreshList = useCallback(async (q = query) => {
    const list = await api.listDiaries(q ? { q } : undefined)
    setEntries(list)
  }, [query])

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
    loadDate(todayStr).catch(console.error)
    refreshList('').catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // 搜索
  useEffect(() => {
    const t = window.setTimeout(() => refreshList(query).catch(console.error), 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

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

  const selDate = parseISO(selected)
  const hasEntry = entries.some((e) => e.date === selected)

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
      {/* 左：历史列表 */}
      <aside className="warm-card p-4 flex flex-col max-h-[calc(100vh-8rem)] lg:sticky lg:top-8">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            className="warm-input w-full pl-9"
            placeholder="搜索日记内容或标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <button
          onClick={() => selectDate(todayStr)}
          className={`mt-3 rounded-xl px-3 py-2 text-sm text-left transition ${
            selected === todayStr ? 'bg-orange-500 text-white font-medium' : 'bg-orange-100/70 text-orange-800 hover:bg-orange-100'
          }`}
        >
          📖 今天 · {format(new Date(), 'M月d日')}
        </button>

        <div className="mt-2 flex items-center gap-2">
          <CalendarDays size={14} className="text-stone-400 shrink-0" />
          <input
            type="date"
            className="warm-input w-full text-xs"
            value={selected}
            max={todayStr}
            onChange={(e) => e.target.value && selectDate(e.target.value)}
          />
        </div>

        <div className="mt-3 flex-1 overflow-y-auto space-y-1 pr-1">
          {entries.map((e) => {
            const d = parseISO(e.date)
            return (
              <button
                key={e.date}
                onClick={() => selectDate(e.date)}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                  selected === e.date ? 'bg-orange-100 border border-orange-200' : 'hover:bg-orange-50 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">
                    {d.getMonth() + 1}月{d.getDate()}日 周{WEEKDAYS[d.getDay()]}
                  </span>
                  <span className="text-base leading-none">
                    {moodOf(e.mood)?.emoji ?? ''}{weatherOf(e.weather)?.emoji ?? ''}
                  </span>
                </div>
                {e.snippet && <p className="mt-1 text-xs text-stone-400 line-clamp-1">{e.snippet}</p>}
                {e.tags.length > 0 && (
                  <p className="mt-1 text-xs text-orange-600/70 line-clamp-1">{e.tags.map((t) => `#${t}`).join(' ')}</p>
                )}
              </button>
            )
          })}
          {entries.length === 0 && (
            <p className="py-8 text-center text-xs text-stone-400">
              {query ? '没有找到相关日记' : '还没有日记，从右边开始第一篇吧'}
            </p>
          )}
        </div>
      </aside>

      {/* 右：编辑器 */}
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
    </div>
  )
}
