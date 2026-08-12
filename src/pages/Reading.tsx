import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router'
import { BookOpen, Check, FileText, Maximize2, Pencil, Play, Plus, Star, Trash2, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { BOOK_STATUS_DEFS, bookColor, bookStatusOf } from '../lib/constants'
import type { Book, BookStatus } from '../types'

type Filter = 'all' | BookStatus

export default function ReadingPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Book | null>(null)

  const load = useCallback(async () => {
    setBooks(await api.listBooks())
  }, [])

  useEffect(() => {
    // 微任务中加载，避免在 effect 同步阶段触发 setState
    queueMicrotask(() => { load().catch(console.error) })
  }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: books.length, want: 0, reading: 0, done: 0 }
    for (const b of books) c[b.status] += 1
    return c
  }, [books])

  const shown = useMemo(
    () => (filter === 'all' ? books : books.filter((b) => b.status === filter)),
    [books, filter],
  )

  const update = async (id: number, data: Parameters<typeof api.updateBook>[1]) => {
    await api.updateBook(id, data)
    load()
  }

  const remove = async (book: Book) => {
    if (!window.confirm(`把《${book.title}》从书架移除？${book.hasPdf ? '（已上传的 PDF 会一并删除）' : ''}`)) return
    await api.deleteBook(book.id)
    load()
  }

  // 弹窗内上传/删除 PDF 后刷新列表与编辑中的书籍对象
  const refreshEditing = useCallback(async () => {
    const list = await api.listBooks()
    setBooks(list)
    setEditing((cur) => (cur ? list.find((b) => b.id === cur.id) ?? cur : cur))
  }, [])

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-950">阅读</h2>
          <p className="mt-1 text-sm text-stone-500">书山有路勤为径 · 想读 {counts.want} · 在读 {counts.reading} · 已读 {counts.done}</p>
        </div>
        <button className="warm-btn" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> 添加书籍
        </button>
      </header>

      {/* 状态筛选 */}
      <div className="flex flex-wrap gap-2">
        {[{ key: 'all' as Filter, label: '全部', emoji: '📚' }, ...BOOK_STATUS_DEFS].map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key as Filter)}
            className={`rounded-2xl px-4 py-2 text-sm transition-all border ${
              filter === s.key
                ? 'bg-white border-orange-300 shadow-sm font-semibold text-orange-800'
                : 'border-transparent bg-white/50 text-stone-500 hover:bg-white/80'
            }`}
          >
            {s.emoji} {s.label} <span className="text-xs text-stone-400">{counts[s.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* 书架 */}
      {shown.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((book) => {
            const isEbook = book.kind === 'ebook'
            const pct = isEbook
              ? Math.min(100, book.progressPct)
              : book.totalPages > 0
                ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
                : 0
            const statusDef = bookStatusOf(book.status)
            return (
              <div key={book.id} className="group warm-card overflow-hidden flex">
                {/* 书脊 */}
                <div className="w-2.5 shrink-0" style={{ background: bookColor(book.title) }} />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-stone-800 leading-snug">
                        {isEbook && <span title="电子书">📱 </span>}《{book.title}》
                      </h3>
                      {book.author && <p className="mt-0.5 text-xs text-stone-400">{book.author}</p>}
                    </div>
                    <span className="warm-chip shrink-0">
                      {statusDef?.emoji} {statusDef?.label}
                      {book.status === 'done' && book.finishedAt && (
                        <span className="opacity-70">
                          {' · '}
                          {book.finishedAt.slice(0, 4) === String(new Date().getFullYear())
                            ? `${Number(book.finishedAt.slice(5, 7))}月${Number(book.finishedAt.slice(8, 10))}日`
                            : `${book.finishedAt.slice(0, 4)}年${Number(book.finishedAt.slice(5, 7))}月${Number(book.finishedAt.slice(8, 10))}日`}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 评分 */}
                  <div className="mt-2 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => update(book.id, { rating: book.rating === n ? 0 : n })} aria-label={`评 ${n} 星`}>
                        <Star
                          size={16}
                          className={n <= book.rating ? 'fill-amber-400 text-amber-400' : 'text-orange-200 hover:text-amber-400'}
                        />
                      </button>
                    ))}
                    {book.rating > 0 && <span className="ml-1 text-xs text-stone-400">{book.rating} 星</span>}
                  </div>

                  {/* 阅读进度：纸质书按页数 */}
                  {book.status === 'reading' && !isEbook && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-stone-400">
                        <span>
                          {book.totalPages > 0 ? `读到 ${book.currentPage}/${book.totalPages} 页` : `已读 ${book.currentPage} 页`}
                        </span>
                        {book.totalPages > 0 && <span className="text-orange-700 font-semibold">{pct}%</span>}
                      </div>
                      {book.totalPages > 0 && (
                        <div className="mt-1 h-1.5 rounded-full bg-orange-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {[10, 30, 50].map((n) => (
                          <button
                            key={n}
                            className="rounded-lg bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 transition"
                            onClick={() => update(book.id, { currentPage: book.currentPage + n })}
                          >
                            +{n}页
                          </button>
                        ))}
                        <DirectInput placeholder="页码" onGo={(v) => update(book.id, { currentPage: Math.round(v) })} />
                        <button
                          className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition"
                          onClick={() => update(book.id, { status: 'done' })}
                        >
                          <Check size={11} className="inline mr-0.5" />读完
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 阅读进度：电子书按百分比 */}
                  {book.status === 'reading' && isEbook && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-stone-400">
                        <span>已读 {pct}%{book.totalWords > 0 && ` · 全书约 ${(book.totalWords / 10000).toFixed(1)} 万字`}</span>
                        <span className="text-orange-700 font-semibold">{pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-orange-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {[5, 10, 20].map((n) => (
                          <button
                            key={n}
                            className="rounded-lg bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 transition"
                            onClick={() => update(book.id, { progressPct: Math.min(100, book.progressPct + n) })}
                          >
                            +{n}%
                          </button>
                        ))}
                        <DirectInput placeholder="%" onGo={(v) => update(book.id, { progressPct: Math.min(100, Math.round(v)) })} />
                        <button
                          className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition"
                          onClick={() => update(book.id, { status: 'done', progressPct: 100 })}
                        >
                          <Check size={11} className="inline mr-0.5" />读完
                        </button>
                      </div>
                    </div>
                  )}

                  {book.status === 'want' && (
                    <button
                      className="mt-3 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs text-orange-700 hover:bg-orange-100 transition"
                      onClick={() => update(book.id, { status: 'reading' })}
                    >
                      <Play size={11} className="inline mr-0.5" />开始阅读
                    </button>
                  )}

                  {/* 电子书 PDF 阅读入口 */}
                  {isEbook && book.hasPdf && (
                    <Link
                      to={`/reading/${book.id}/reader`}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-100/80 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 transition"
                    >
                      <BookOpen size={12} /> 阅读 PDF{book.pdfPages > 0 && ` · ${book.pdfPages} 页`}
                    </Link>
                  )}

                  {book.note && (
                    <p className="mt-2.5 text-xs text-stone-500 leading-relaxed line-clamp-2 border-l-2 border-orange-200 pl-2">
                      {book.note}
                    </p>
                  )}

                  {/* 操作 */}
                  <div className="mt-3 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="warm-btn-ghost !px-2 !py-1 text-stone-400 hover:text-orange-600" onClick={() => setEditing(book)} title="编辑 / 读后感">
                      <Pencil size={13} />
                    </button>
                    <button className="warm-btn-ghost !px-2 !py-1 text-stone-400 hover:text-red-500" onClick={() => remove(book)} title="删除">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="warm-card py-16 text-center">
          <BookOpen size={36} className="mx-auto text-orange-200" />
          <p className="mt-3 text-sm text-stone-400">
            {filter === 'all' ? '书架还是空的，添加第一本书吧' : `没有「${bookStatusOf(filter)?.label}」的书`}
          </p>
          <button className="warm-btn mt-4" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> 添加书籍
          </button>
        </div>
      )}

      {showAdd && <BookDialog onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {editing && (
        <BookDialog
          book={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
          onChanged={refreshEditing}
        />
      )}
    </div>
  )
}

/** 卡片上的直接填写进度小输入框 */
function DirectInput({ placeholder, onGo }: { placeholder: string; onGo: (v: number) => void }) {
  const [v, setV] = useState('')
  const go = () => {
    const n = Number(v)
    if (v.trim() && Number.isFinite(n) && n >= 0) onGo(n)
    setV('')
  }
  return (
    <span className="flex items-center gap-1">
      <input
        className="warm-input !w-16 !px-2 !py-1 text-xs"
        inputMode="decimal"
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && go()}
      />
      <button className="rounded-lg bg-orange-50 px-2 py-1 text-xs text-orange-700 hover:bg-orange-100 transition" onClick={go}>
        定位
      </button>
    </span>
  )
}

function BookDialog({ book, onClose, onSaved, onChanged }: { book?: Book; onClose: () => void; onSaved: () => void; onChanged?: () => void }) {
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [status, setStatus] = useState<BookStatus>(book?.status ?? 'want')
  const [kind, setKind] = useState<'paper' | 'ebook'>(book?.kind ?? 'paper')
  const [totalPages, setTotalPages] = useState(book?.totalPages ? String(book.totalPages) : '')
  const [currentPage, setCurrentPage] = useState(book?.currentPage ? String(book.currentPage) : '')
  const [totalWords, setTotalWords] = useState(book?.totalWords ? String(book.totalWords) : '')
  const [progressPct, setProgressPct] = useState(book?.progressPct ? String(book.progressPct) : '')
  const [note, setNote] = useState(book?.note ?? '')
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [finishedAt, setFinishedAt] = useState(() => book?.finishedAt?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'))
  const [uploading, setUploading] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    const done = status === 'done'
    const base = {
      title: title.trim(),
      author: author.trim(),
      status,
      kind,
      totalPages: kind === 'paper' ? Number(totalPages) || 0 : 0,
      totalWords: kind === 'ebook' ? Number(totalWords) || 0 : 0,
      ...(done ? { finishedAt } : {}),
    }
    if (book) {
      await api.updateBook(book.id, {
        ...base,
        currentPage: kind === 'paper' ? Number(currentPage) || 0 : 0,
        progressPct: kind === 'ebook' ? Math.min(100, Math.max(0, Number(progressPct) || 0)) : 0,
        note,
      })
    } else {
      await api.createBook({
        ...base,
        progressPct: kind === 'ebook' ? Math.min(100, Math.max(0, Number(progressPct) || 0)) : 0,
      })
    }
    onSaved()
  }

  const onPickPdf = async (file: File | undefined, input: HTMLInputElement) => {
    if (!file || !book) return
    setUploading(true)
    try {
      await api.uploadPdf(book.id, file)
      onChanged?.()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      input.value = ''
    }
  }

  const onDeletePdf = async () => {
    if (!book || !window.confirm('删除已上传的 PDF？')) return
    await api.deletePdf(book.id)
    onChanged?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="warm-card relative w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h4 className="font-semibold text-orange-950">{book ? '编辑书籍' : '添加书籍'}</h4>

        <label className="mt-4 block text-xs font-medium text-stone-500">书名 *</label>
        <input className="warm-input mt-1.5 w-full" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

        <label className="mt-3 block text-xs font-medium text-stone-500">作者</label>
        <input className="warm-input mt-1.5 w-full" value={author} onChange={(e) => setAuthor(e.target.value)} />

        <label className="mt-3 block text-xs font-medium text-stone-500">类型</label>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {([['paper', '📖 纸质书'], ['ebook', '📱 电子书']] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                kind === k
                  ? 'border-orange-300 bg-orange-50 font-semibold text-orange-800'
                  : 'border-stone-200 bg-white/60 text-stone-500 hover:bg-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500">状态</label>
            <select className="warm-input mt-1.5 w-full" value={status} onChange={(e) => setStatus(e.target.value as BookStatus)}>
              {BOOK_STATUS_DEFS.map((s) => (
                <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
              ))}
            </select>
          </div>
          <div>
            {kind === 'paper' ? (
              <>
                <label className="block text-xs font-medium text-stone-500">总页数</label>
                <input className="warm-input mt-1.5 w-full" inputMode="numeric" value={totalPages} onChange={(e) => setTotalPages(e.target.value.replace(/\D/g, ''))} />
              </>
            ) : (
              <>
                <label className="block text-xs font-medium text-stone-500">总字数（可选）</label>
                <input
                  className="warm-input mt-1.5 w-full"
                  inputMode="numeric"
                  placeholder="如 350000"
                  value={totalWords}
                  onChange={(e) => setTotalWords(e.target.value.replace(/\D/g, ''))}
                />
              </>
            )}
          </div>
        </div>

        {book && status === 'reading' && kind === 'paper' && (
          <>
            <label className="mt-3 block text-xs font-medium text-stone-500">当前页码</label>
            <input className="warm-input mt-1.5 w-full" inputMode="numeric" value={currentPage} onChange={(e) => setCurrentPage(e.target.value.replace(/\D/g, ''))} />
          </>
        )}

        {book && status === 'reading' && kind === 'ebook' && (
          <>
            <label className="mt-3 block text-xs font-medium text-stone-500">阅读进度（%）</label>
            <input
              className="warm-input mt-1.5 w-full"
              inputMode="decimal"
              placeholder="0-100"
              value={progressPct}
              onChange={(e) => setProgressPct(e.target.value.replace(/[^\d.]/g, ''))}
            />
          </>
        )}

        {status === 'done' && (
          <>
            <label className="mt-3 block text-xs font-medium text-stone-500">完成日期</label>
            <input
              type="date"
              className="warm-input mt-1.5 w-full"
              value={finishedAt}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => e.target.value && setFinishedAt(e.target.value)}
            />
          </>
        )}

        {/* 电子书 PDF 上传 */}
        {book && kind === 'ebook' && (
          <div className="mt-3">
            <label className="block text-xs font-medium text-stone-500">PDF 文件（上传后可在应用内阅读）</label>
            {book.hasPdf ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2.5">
                <FileText size={14} className="shrink-0 text-orange-500" />
                <span className="flex-1 truncate text-xs text-stone-600">
                  {book.pdfName || '已上传 PDF'}{book.pdfPages > 0 && ` · ${book.pdfPages} 页`}
                </span>
                <button className="warm-btn-ghost !px-1.5 !py-1 text-stone-400 hover:text-red-500" title="删除 PDF" onClick={onDeletePdf}>
                  <Trash2 size={13} />
                </button>
              </div>
            ) : (
              <label className={`mt-1.5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 px-3 py-3 text-xs text-orange-700 transition ${uploading ? 'opacity-60' : 'cursor-pointer hover:bg-orange-50'}`}>
                <Upload size={14} /> {uploading ? '上传中…' : '选择 PDF 上传（≤120MB）'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => onPickPdf(e.target.files?.[0], e.target)}
                />
              </label>
            )}
          </div>
        )}

        {book && (
          <>
            <div className="mt-3 flex items-center justify-between">
              <label className="block text-xs font-medium text-stone-500">读后感 / 摘抄</label>
              <button
                className="warm-btn-ghost !px-1.5 !py-1 text-stone-400 hover:text-orange-600"
                title="放大到全页编辑"
                onClick={() => setNoteExpanded(true)}
              >
                <Maximize2 size={13} />
              </button>
            </div>
            <textarea
              className="warm-input mt-1.5 w-full min-h-24 resize-y"
              placeholder="记录这本书带给你的想法…（点右上角可放大到全页）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className="warm-btn-ghost" onClick={onClose}>取消</button>
          <button className="warm-btn" onClick={save} disabled={!title.trim()}>保存</button>
        </div>
      </div>

      {/* 全页笔记编辑器 */}
      {noteExpanded && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#faf3e8]" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between border-b border-orange-200/60 bg-amber-50/90 px-4 py-3">
            <h4 className="font-semibold text-orange-950 truncate">《{book?.title}》的笔记</h4>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-stone-400">{note.length} 字</span>
              <button className="warm-btn !py-1.5" onClick={() => setNoteExpanded(false)}>
                <Check size={14} /> 完成
              </button>
            </div>
          </div>
          <textarea
            className="flex-1 w-full resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed text-stone-800 outline-none"
            placeholder="记录这本书带给你的想法、摘抄喜欢的段落…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
