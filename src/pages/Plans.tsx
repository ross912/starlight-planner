import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import { LEVEL_DEFS } from '../lib/constants'
import { currentLabel, isCurrentPeriod, parentPeriodOf, periodLabel, periodOf, shiftPeriod } from '../lib/period'
import type { Level, Todo, TodoStatus } from '../types'

const levelOf = (key: string): Level => key as Level

/** 状态循环：待办 ☐ → 完成 ✅ → 未完成 ❌ → 待办 */
const NEXT_STATUS: Record<TodoStatus, TodoStatus> = { pending: 'done', done: 'failed', failed: 'pending' }

export default function PlansPage() {
  const [level, setLevel] = useState<Level>('daily')
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-950">计划</h2>
        <p className="mt-1 text-sm text-stone-500">路虽远，行则将至。</p>
      </header>

      {/* 层级切换 */}
      <div className="flex flex-wrap gap-2">
        {LEVEL_DEFS.map((def) => (
          <button
            key={def.key}
            onClick={() => setLevel(levelOf(def.key))}
            className={`rounded-xl px-3 py-2 text-xs sm:text-sm sm:px-4 sm:py-2.5 transition-all border ${
              level === def.key
                ? 'bg-white border-orange-300 shadow-[0_3px_12px_-4px_rgba(194,120,40,0.4)] font-semibold text-orange-800 scale-[1.03]'
                : 'border-transparent bg-white/50 text-stone-500 hover:bg-white/80'
            }`}
          >
            <span className="mr-1.5">{def.icon}</span>
            {def.label}
          </button>
        ))}
      </div>

      <PlanBoard key={level} level={level} />
    </div>
  )
}

function PlanBoard({ level }: { level: Level }) {
  const def = LEVEL_DEFS.find((d) => d.key === level)!
  const [period, setPeriod] = useState(() => periodOf(level, new Date()))
  const [items, setItems] = useState<Todo[]>([])
  const [parentOptions, setParentOptions] = useState<Todo[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [editing, setEditing] = useState<Todo | null>(null)

  const parentRef = useMemo(() => (level === 'lifetime' ? null : parentPeriodOf(level, period)), [level, period])

  const load = useCallback(async () => {
    const [list, parents] = await Promise.all([
      api.listTodos(level, period),
      parentRef ? api.listTodos(parentRef.level, parentRef.period) : Promise.resolve([]),
    ])
    setItems(list)
    setParentOptions(parents)
  }, [level, period, parentRef])

  useEffect(() => {
    // 微任务中加载，避免在 effect 同步阶段触发 setState
    queueMicrotask(() => { load().catch(console.error) })
  }, [load])

  const doneCount = items.filter((i) => i.status === 'done').length
  const failedCount = items.filter((i) => i.status === 'failed').length
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0
  const childrenDone = items.reduce((s, i) => s + i.childrenDone, 0)
  const childrenTotal = items.reduce((s, i) => s + i.childrenTotal, 0)

  const add = async () => {
    const title = newTitle.trim()
    if (!title) return
    await api.createTodo({ level, period, title })
    setNewTitle('')
    load()
  }

  const cycle = async (todo: Todo) => {
    await api.updateTodo(todo.id, { status: NEXT_STATUS[todo.status] })
    load()
  }

  const remove = async (todo: Todo) => {
    if (!window.confirm(`删除「${todo.title}」？关联到它的下层计划会保留，仅解除关联。`)) return
    await api.deleteTodo(todo.id)
    load()
  }

  return (
    <section className="warm-card p-4 sm:p-6">
      {/* 周期导航 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{def.icon}</span>
          <div>
            <h3 className="font-semibold text-orange-950">{def.label}</h3>
            <p className="text-xs text-stone-400">{def.hint}</p>
          </div>
        </div>
        {level !== 'lifetime' ? (
          <div className="flex items-center gap-1">
            <button className="warm-btn-ghost !px-2" onClick={() => setPeriod(shiftPeriod(level, period, -1))}>
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-36 sm:min-w-44 text-center text-sm font-medium text-stone-700">{periodLabel(level, period)}</span>
            <button className="warm-btn-ghost !px-2" onClick={() => setPeriod(shiftPeriod(level, period, 1))}>
              <ChevronRight size={16} />
            </button>
            {!isCurrentPeriod(level, period) && (
              <button className="warm-btn-ghost text-xs" onClick={() => setPeriod(periodOf(level, new Date()))}>
                回{currentLabel(level)}
              </button>
            )}
          </div>
        ) : (
          <span className="text-sm text-stone-400">{periodLabel(level, period)}</span>
        )}
      </div>

      {/* 进度 */}
      <div className="mt-4 flex items-center gap-4">
        <div className="h-2.5 flex-1 rounded-full bg-orange-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm text-stone-500 shrink-0">
          ✅ {doneCount}{failedCount > 0 && <span className="text-rose-400"> · ❌ {failedCount}</span>}
          <span className="text-stone-400"> / {items.length}</span>
          {childrenTotal > 0 && <span className="text-orange-600"> · 下层 {childrenDone}/{childrenTotal}</span>}
        </span>
      </div>

      {/* 逐行列表：一条计划一行 */}
      <div className="mt-4">
        {/* 添加行：输入框 + 加号 */}
        <div className="flex items-center gap-3 border-b border-orange-200/70 pb-3">
          <button
            onClick={add}
            aria-label="添加计划"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-[0_2px_8px_-2px_rgba(234,88,12,0.5)] transition hover:brightness-110 active:scale-95"
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
            placeholder={`点左侧加号或回车，添加一条${def.label}`}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>

        {/* 计划行 */}
        <ul>
          {items.map((todo) => (
            <li
              key={todo.id}
              className="group flex items-center gap-3 border-b border-orange-100/80 py-3 last:border-0"
            >
              {/* 计划内容 */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-relaxed ${
                    todo.status === 'done'
                      ? 'line-through text-stone-400'
                      : todo.status === 'failed'
                        ? 'text-stone-400 line-through decoration-rose-300'
                        : 'text-stone-800'
                  }`}
                >
                  {todo.title}
                </p>
                {todo.note && <p className="mt-0.5 text-xs text-stone-400 leading-relaxed">{todo.note}</p>}
                {(todo.parentTitle || todo.childrenTotal > 0) && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {todo.parentTitle && (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-600/80">
                        <Link2 size={10} />
                        {LEVEL_DEFS.find((d) => d.key === todo.parentLevel)?.label} · {todo.parentTitle}
                      </span>
                    )}
                    {todo.childrenTotal > 0 && (
                      <span className="text-xs text-amber-600/90">下层进度 {todo.childrenDone}/{todo.childrenTotal}</span>
                    )}
                  </div>
                )}
              </div>

              {/* 行内操作（悬停显示） */}
              <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="warm-btn-ghost !px-1.5 !py-1 text-stone-400 hover:text-orange-600" onClick={() => setEditing(todo)} title="编辑 / 关联">
                  <Pencil size={13} />
                </button>
                <button className="warm-btn-ghost !px-1.5 !py-1 text-stone-400 hover:text-red-500" onClick={() => remove(todo)} title="删除">
                  <Trash2 size={13} />
                </button>
              </div>

              {/* 状态方框：点选 ✅ / ❌ */}
              <button
                onClick={() => cycle(todo)}
                title={todo.status === 'done' ? '已完成，点击标为未完成' : todo.status === 'failed' ? '未完成，点击重置为待办' : '待办，点击标为完成'}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 text-sm transition-all active:scale-90 ${
                  todo.status === 'done'
                    ? 'border-emerald-400 bg-emerald-50'
                    : todo.status === 'failed'
                      ? 'border-rose-300 bg-rose-50'
                      : 'border-orange-300 bg-white hover:border-orange-500 hover:bg-orange-50'
                }`}
              >
                {todo.status === 'done' ? '✅' : todo.status === 'failed' ? '❌' : ''}
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-10 text-center text-sm text-stone-400">
              还没有计划，点上面的加号添加第一条吧 {def.icon}
            </li>
          )}
        </ul>
      </div>

      {/* 编辑对话框 */}
      {editing && (
        <EditDialog
          todo={editing}
          parentOptions={parentOptions}
          parentRefLabel={parentRef ? `${LEVEL_DEFS.find((d) => d.key === parentRef.level)?.label} · ${periodLabel(parentRef.level, parentRef.period)}` : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </section>
  )
}

function EditDialog({
  todo,
  parentOptions,
  parentRefLabel,
  onClose,
  onSaved,
}: {
  todo: Todo
  parentOptions: Todo[]
  parentRefLabel: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(todo.title)
  const [note, setNote] = useState(todo.note)
  const [parentId, setParentId] = useState<number | ''>(todo.parentId ?? '')

  const save = async () => {
    if (!title.trim()) return
    await api.updateTodo(todo.id, { title: title.trim(), note, parentId: parentId === '' ? null : Number(parentId) })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="warm-card relative w-full max-w-md p-6 shadow-xl">
        <h4 className="font-semibold text-orange-950">编辑事项</h4>

        <label className="mt-4 block text-xs font-medium text-stone-500">标题</label>
        <input className="warm-input mt-1.5 w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label className="mt-4 block text-xs font-medium text-stone-500">备注（可选）</label>
        <textarea
          className="warm-input mt-1.5 w-full min-h-20 resize-y"
          placeholder="补充细节、验收标准、相关链接…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        {parentRefLabel && (
          <>
            <label className="mt-4 block text-xs font-medium text-stone-500">
              关联到上层计划（{parentRefLabel}）
            </label>
            <select
              className="warm-input mt-1.5 w-full"
              value={parentId}
              onChange={(e) => setParentId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">不关联</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {parentOptions.length === 0 && (
              <p className="mt-1 text-xs text-stone-400">该周期上层还没有计划，可先到上层添加。</p>
            )}
          </>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button className="warm-btn-ghost" onClick={onClose}>取消</button>
          <button className="warm-btn" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  )
}
