import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  BookOpen,
  Check,
  Maximize2,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2,
  Upload,
  History,
  ArrowLeft,
} from 'lucide-react'
import { api } from '../lib/api'
import { Modal } from '../components/Modal'
import { clamp } from '../lib/utils'
import { BOOK_STATUS_DEFS, bookColor, bookStatusOf } from '../lib/constants'
import type { Book, BookStatus, ReadingEntry } from '../types'

type Filter = 'all' | BookStatus
type ManualBookFormat = 'paper' | 'ebook'


const LazyPdfReader = lazy(() => import("../components/PdfReader"))

function bookProgress(book: Book) {
  if (book.bookFormat === 'ebook') return clamp(Math.round(book.progressPercent), 0, 100)
  if (book.totalPages > 0) return clamp(Math.round((book.currentPage / book.totalPages) * 100), 0, 100)
  return clamp(Math.round(book.progressPercent), 0, 100)
}

function formatWords(words: number) {
  if (!words) return '未填写总字数'
  if (words >= 10000) {
    const value = words / 10000
    return `${Number.isInteger(value) ? value : value.toFixed(1)} 万字`
  }
  return `${words.toLocaleString()} 字`
}

function formatLabel(book: Book) {
  if (book.bookFormat === 'pdf') return 'PDF'
  return book.bookFormat === 'ebook' ? '电子书' : '纸质书'
}

export default function ReadingPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [editing, setEditing] = useState<Book | null>(null)
  const [detailBook, setDetailBook] = useState<Book | null>(null)
  const [reader, setReader] = useState<Book | null>(null)

  const load = useCallback(async () => {
    setBooks(await api.listBooks())
  }, [])

  useEffect(() => {
    queueMicrotask(() => { load().catch(console.error) })
  }, [load])

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: books.length, want: 0, reading: 0, done: 0 }
    for (const book of books) result[book.status] += 1
    return result
  }, [books])

  const shown = useMemo(
    () => (filter === 'all' ? books : books.filter((book) => book.status === filter)),
    [books, filter],
  )

  const applyBook = useCallback((next: Book) => {
    setBooks((current) => current.map((book) => book.id === next.id ? next : book))
    setDetailBook((current) => current?.id === next.id ? next : current)
    setReader((current) => current?.id === next.id ? next : current)
  }, [])

  const update = useCallback(async (id: number, data: Parameters<typeof api.updateBook>[1]) => {
    const next = await api.updateBook(id, data)
    applyBook(next)
    return next
  }, [applyBook])

  const remove = async (book: Book) => {
    const fileNote = book.hasPdf ? ', 上传的 PDF 文件也会一并删除' : ''
    if (!window.confirm(`把《${book.title}》从书架移除${fileNote}?`)) return
    await api.deleteBook(book.id)
    setBooks((current) => current.filter((item) => item.id !== book.id))
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-orange-950 sm:text-2xl md:text-3xl">阅读</h2>
          <p className="mt-1 text-sm text-stone-500">书山有路勤为径 · 想读 {counts.want} · 在读 {counts.reading} · 已读 {counts.done}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="warm-btn-ghost min-h-11" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> 添加书籍
          </button>
          <button className="warm-btn min-h-11" onClick={() => setShowUpload(true)}>
            <Upload size={16} /> 上传 PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-1.5" aria-label="按阅读状态筛选">
        {[{ key: 'all' as Filter, label: '全部', emoji: '📚' }, ...BOOK_STATUS_DEFS].map((status) => (
          <button
            key={status.key}
            onClick={() => setFilter(status.key as Filter)}
            className={`min-h-10 rounded-xl border px-2 py-1.5 text-xs text-center transition-all truncate ${
              filter === status.key
                ? 'border-orange-300 bg-white font-semibold text-orange-800 shadow-sm'
                : 'border-transparent bg-white/50 text-stone-500 hover:bg-white/80'
            }`}
          >
            {status.emoji} {status.label} <span className="text-[10px] text-stone-400">{counts[status.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {shown.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onClick={() => setDetailBook(book)}
            />
          ))}
        </div>
      ) : (
        <div className="warm-card py-16 text-center">
          <BookOpen size={36} className="mx-auto text-orange-200" />
          <p className="mt-3 text-sm text-stone-400">
            {filter === 'all' ? '书架还是空的，添加第一本书吧' : `没有「${bookStatusOf(filter)?.label}」的书`}
          </p>
          <button className="warm-btn mt-4 min-h-11" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> 添加书籍
          </button>
        </div>
      )}

      {showAdd && <BookDialog onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); void load() }} />}
      {editing && <BookDialog book={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
      {showUpload && (
        <PdfUploadDialog
          onClose={() => setShowUpload(false)}
          onSaved={(book) => {
            setShowUpload(false)
            setBooks((current) => [book, ...current])
            setReader(book)
          }}
        />
      )}
      {detailBook && (
        <BookDetailDialog
          book={detailBook}
          onClose={() => setDetailBook(null)}
          onEdit={() => { setEditing(detailBook); setDetailBook(null) }}
          onRemove={() => { void remove(detailBook); setDetailBook(null) }}
          onOpen={() => { setReader(detailBook); setDetailBook(null) }}
          onUpdate={update}
        />
      )}
      {reader && (
        <Suspense fallback={<div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900 text-sm text-stone-200">正在打开阅读器…</div>}>
          <LazyPdfReader book={reader} onClose={() => setReader(null)} onBookUpdated={applyBook} />
        </Suspense>
      )}
    </div>
  )
}

function BookCard({ book, onClick }: { book: Book; onClick: () => void }) {
  const pct = bookProgress(book)
  const statusDef = bookStatusOf(book.status)

  return (
    <button
      className="warm-card group flex flex-col p-2 text-left transition-shadow hover:shadow-md"
      style={{ borderTop: `3px solid ${bookColor(book.title)}` }}
      onClick={onClick}
    >
      {/* 状态标签右上 + 书名下行 */}
      <div className="flex flex-col mb-2">
        <span className="self-end warm-chip !px-1 !py-0 text-[9px]">
          {statusDef?.emoji} {statusDef?.label}
        </span>
        <h3 className="whitespace-nowrap text-xs font-bold text-stone-800 leading-snug">
          《{book.title}》
        </h3>
      </div>

      {/* 中间撑开 */}
      <div className="flex-1" />

      {/* 作者 */}
      <p className="text-[10px] text-stone-400 whitespace-nowrap overflow-hidden">
        {book.author || '佚名'}
      </p>

      {/* 进度 */}
      <div className="mt-1">
        {book.status === 'reading' && (
          <div className="flex items-center gap-1.5">
            <div className="h-1 flex-1 rounded-full bg-orange-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] font-medium text-orange-500">{pct}%</span>
          </div>
        )}
        {book.status === 'done' && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-500">
            <Check size={10} /> 已读完
          </div>
        )}
      </div>
    </button>
  )
}

function BookDetailDialog({
  book,
  onClose,
  onEdit,
  onRemove,
  onOpen,
  onUpdate,
}: {
  book: Book
  onClose: () => void
  onEdit: () => void
  onRemove: () => void
  onOpen: () => void
  onUpdate: (id: number, data: Parameters<typeof api.updateBook>[1]) => Promise<Book>
}) {
  const [entries, setEntries] = useState<ReadingEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const pct = bookProgress(book)
  const statusDef = bookStatusOf(book.status)

  useEffect(() => {
    if (book.status === 'want') return
    setEntriesLoading(true)
    api.listReadingEntries(book.id)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setEntriesLoading(false))
  }, [book.id, book.status])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#faf3e8]" role="dialog" aria-modal="true" aria-label={`《${book.title}》详情`}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between border-b border-orange-200/60 bg-amber-50/90 px-4 py-3 shrink-0">
        <button className="warm-btn-ghost min-h-11 !px-2 flex items-center gap-1" onClick={onClose}>
          <ArrowLeft size={18} />
          <span className="text-sm">返回</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            className="warm-btn-ghost min-h-9 min-w-9 !px-1.5 text-stone-500 hover:text-orange-700"
            onClick={onEdit}
            aria-label={`编辑《${book.title}》`}
          >
            <Pencil size={15} />
          </button>
          <button
            className="warm-btn-ghost min-h-9 min-w-9 !px-1.5 text-stone-500 hover:text-red-600"
            onClick={onRemove}
            aria-label={`删除《${book.title}》`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* 书名 + 状态 + 作者 */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold text-stone-800">《{book.title}》</h2>
            <span className="warm-chip shrink-0 text-xs">{statusDef?.emoji} {statusDef?.label}</span>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            {book.author || '佚名'}
            {book.bookFormat && (
              <span className="ml-2 text-xs text-stone-400">
                · {formatLabel(book)}
                {book.bookFormat !== 'pdf' && book.bookFormat !== 'ebook' && book.totalPages > 0 && ` · ${book.totalPages} 页`}
                {book.bookFormat === 'ebook' && book.totalWords > 0 && ` · ${formatWords(book.totalWords)}`}
              </span>
            )}
          </p>
        </div>

        {/* 进度条 */}
        {book.status === 'reading' && (
          <div className="warm-card !p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-stone-700">阅读进度</span>
              <span className="text-lg font-bold text-orange-600">{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-orange-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-[width] duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-3">
              {book.hasPdf ? (
                <button className="warm-btn min-h-11 w-full justify-center" onClick={onOpen}>
                  <BookOpen size={16} /> {book.currentPage > 1 ? `继续阅读 · 第 ${book.currentPage} 页` : '打开阅读器'}
                </button>
              ) : (
                <ProgressEditor book={book} onUpdate={onUpdate} />
              )}
            </div>
          </div>
        )}

        {book.status === 'done' && (
          <div className="warm-card !p-4 flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100 shrink-0">
              <Check size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-700">已读完</p>
              {book.finishedAt && <p className="text-xs text-stone-400">{book.finishedAt.slice(0, 10)} 完成</p>}
            </div>
            {book.hasPdf && (
              <button className="warm-btn-ghost min-h-9 ml-auto text-xs" onClick={onOpen}>
                <BookOpen size={14} /> 再次打开
              </button>
            )}
          </div>
        )}

        {book.status === 'want' && (
          <button
            className="warm-card !p-4 w-full flex items-center justify-center gap-2 text-orange-700 hover:bg-orange-50 transition"
            onClick={() => { void onUpdate(book.id, { status: 'reading' }) }}
          >
            <Play size={16} />
            <span className="text-sm font-medium">开始阅读</span>
          </button>
        )}

        {/* 评分 */}
        <div className="warm-card !p-4">
          <p className="text-sm font-medium text-stone-700 mb-2">评分</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                className="flex min-h-10 min-w-10 items-center justify-center rounded-lg hover:bg-orange-50 transition"
                onClick={() => { void onUpdate(book.id, { rating: book.rating === rating ? 0 : rating }) }}
                aria-label={`评 ${rating} 星`}
              >
                <Star size={22} className={rating <= book.rating ? 'fill-amber-400 text-amber-400' : 'text-orange-200'} />
              </button>
            ))}
          </div>
        </div>

        {/* 笔记 */}
        {book.note ? (
          <div className="warm-card !p-4">
            <p className="text-sm font-medium text-stone-700 mb-2">读书笔记</p>
            <p className="text-sm leading-relaxed text-stone-600 whitespace-pre-wrap">{book.note}</p>
          </div>
        ) : (
          book.status !== 'want' && (
            <div className="warm-card !p-4">
              <p className="text-sm font-medium text-stone-700 mb-1">读书笔记</p>
              <p className="text-xs text-stone-400">暂无笔记，编辑书籍时可添加</p>
            </div>
          )
        )}

        {/* 阅读记录 */}
        {book.status !== 'want' && (
          <div className="warm-card !p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <History size={14} className="text-stone-500" />
              <span className="text-sm font-medium text-stone-700">阅读记录</span>
            </div>
            {entriesLoading ? (
              <p className="text-xs text-stone-400">加载中…</p>
            ) : entries.length > 0 ? (
              <div className="space-y-1.5">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm text-stone-600">
                    <span className="text-stone-400">{e.date.slice(5)}</span>
                    <span>
                      {book.bookFormat !== 'ebook'
                        ? `读到第 ${e.currentPage} 页`
                        : `进度 ${Math.round(e.progressPercent)}%`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400">暂无记录，更新进度后将自动记录</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgressEditor({
  book,
  onUpdate,
}: {
  book: Book
  onUpdate: (id: number, data: Parameters<typeof api.updateBook>[1]) => Promise<Book>
}) {
  const isEbook = book.bookFormat === 'ebook'
  const sourceValue = isEbook ? Math.round(book.progressPercent) : book.currentPage
  const [value, setValue] = useState(String(sourceValue))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setValue(String(sourceValue)), [sourceValue])

  const save = async (nextValue = Number(value)) => {
    const max = isEbook ? 100 : (book.totalPages || Number.MAX_SAFE_INTEGER)
    const safe = clamp(Math.round(Number(nextValue) || 0), 0, max)
    setSaving(true)
    setError('')
    try {
      const next = await onUpdate(book.id, isEbook ? { progressPercent: safe } : { currentPage: safe })
      setValue(String(isEbook ? Math.round(next.progressPercent) : next.currentPage))
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const increments = isEbook ? [1, 5, 10] : [10, 30, 50]

  return (
    <div className="rounded-lg bg-orange-50/50 p-2">
      <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <label className="min-w-0 flex-1 text-xs font-medium text-stone-600">
          {isEbook ? '当前进度（%）' : '目前读到（页）'}
          <input
            className="warm-input mt-1 min-h-9 w-full text-sm"
            inputMode="numeric"
            value={value}
            onChange={(event) => setValue(event.target.value.replace(/\\D/g, ''))}
            aria-label={isEbook ? '当前阅读百分比' : '当前已读总页数'}
          />
        </label>
        <button className="warm-btn min-h-9 text-sm !px-3" type="submit" disabled={saving}>{saving ? '保存中' : '保存'}</button>
      </form>
      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        {increments.map((amount) => (
          <button
            key={amount}
            className="min-h-8 rounded-md bg-white px-2 text-xs font-medium text-orange-700 transition hover:bg-orange-100"
            onClick={() => { void save(sourceValue + amount) }}
            disabled={saving}
          >
            +{amount}{isEbook ? '%' : '页'}
          </button>
        ))}
        <button
          className="min-h-8 rounded-md bg-emerald-50 px-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
          onClick={() => { void onUpdate(book.id, { status: 'done' }) }}
          disabled={saving}
        >
          <Check size={11} className="mr-0.5 inline" />读完
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  )
}

function PdfUploadDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (book: Book) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const chooseFile = (next: File | null) => {
    setError('')
    if (!next) return setFile(null)
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('请选择 PDF 文件')
      return
    }
    if (next.size > 100 * 1024 * 1024) {
      setError('PDF 不能超过 100 MB')
      return
    }
    setFile(next)
    if (!title) setTitle(next.name.replace(/\\.pdf$/i, ''))
  }

  const upload = async () => {
    if (!file || !title.trim()) return
    setUploading(true)
    setError('')
    try {
      onSaved(await api.uploadBookPdf(file, { title: title.trim(), author: author.trim() }))
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : ''
      setError(message.includes('413') ? 'PDF 不能超过 100 MB' : '上传失败，请检查文件后重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal title="上传 PDF 电子书" onClose={onClose}>
      <label className="block text-xs font-medium text-stone-600" htmlFor="pdf-file">PDF 文件 *</label>
      <label htmlFor="pdf-file" className="mt-1.5 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-orange-300 bg-orange-50/60 px-4 text-center transition hover:bg-orange-50">
        <Upload size={24} className="text-orange-500" />
        <span className="mt-2 text-sm font-medium text-stone-700">{file ? file.name : '选择一个 PDF 文件'}</span>
        <span className="mt-1 text-xs text-stone-500">最大 100 MB，上传后立即加入书架</span>
      </label>
      <input id="pdf-file" className="sr-only" type="file" accept="application/pdf,.pdf" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />

      <label className="mt-4 block text-xs font-medium text-stone-600" htmlFor="pdf-title">书名 *</label>
      <input id="pdf-title" className="warm-input mt-1.5 min-h-11 w-full" value={title} onChange={(event) => setTitle(event.target.value)} />

      <label className="mt-3 block text-xs font-medium text-stone-600" htmlFor="pdf-author">作者</label>
      <input id="pdf-author" className="warm-input mt-1.5 min-h-11 w-full" value={author} onChange={(event) => setAuthor(event.target.value)} />

      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="warm-btn-ghost min-h-11" onClick={onClose} disabled={uploading}>取消</button>
        <button className="warm-btn min-h-11" onClick={() => { void upload() }} disabled={!file || !title.trim() || uploading}>
          {uploading ? '上传中…' : '上传并阅读'}
        </button>
      </div>
    </Modal>
  )
}

function BookDialog({ book, onClose, onSaved }: { book?: Book; onClose: () => void; onSaved: () => void }) {
  const isPdf = book?.bookFormat === 'pdf'
  const [title, setTitle] = useState(book?.title ?? '')
  const [author, setAuthor] = useState(book?.author ?? '')
  const [status, setStatus] = useState<BookStatus>(book?.status ?? 'want')
  const [bookFormat, setBookFormat] = useState<ManualBookFormat>(book?.bookFormat === 'ebook' ? 'ebook' : 'paper')
  const [totalPages, setTotalPages] = useState(book?.totalPages ? String(book.totalPages) : '')
  const [totalWords, setTotalWords] = useState(book?.totalWords ? String(book.totalWords) : '')
  const [note, setNote] = useState(book?.note ?? '')
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [finishedAt, setFinishedAt] = useState(() => book?.finishedAt?.slice(0, 10) ?? format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    setError('')
    const done = status === 'done'
    try {
      if (book) {
        await api.updateBook(book.id, {
          title: title.trim(),
          author: author.trim(),
          status,
          ...(!isPdf ? {
            bookFormat,
            totalPages: bookFormat === 'paper' ? Number(totalPages) || 0 : 0,
            totalWords: bookFormat === 'ebook' ? Number(totalWords) || 0 : 0,
          } : {}),
          note,
          ...(done ? { finishedAt } : {}),
        })
      } else {
        await api.createBook({
          title: title.trim(),
          author: author.trim(),
          status,
          bookFormat,
          totalPages: bookFormat === 'paper' ? Number(totalPages) || 0 : 0,
          totalWords: bookFormat === 'ebook' ? Number(totalWords) || 0 : 0,
          ...(done ? { finishedAt } : {}),
        })
      }
      onSaved()
    } catch {
      setError('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={book ? '编辑书籍' : '添加书籍'} onClose={onClose}>
      {!isPdf && (
        <fieldset>
          <legend className="text-xs font-medium text-stone-600">阅读类型</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {([
              { key: 'paper' as const, label: '纸质书', detail: '按页数记录' },
              { key: 'ebook' as const, label: '电子书', detail: '按百分比记录' },
            ]).map((option) => (
              <button
                key={option.key}
                type="button"
                className={`min-h-16 rounded-xl border px-3 text-left transition ${bookFormat === option.key ? 'border-orange-400 bg-orange-50' : 'border-stone-200 bg-white hover:border-orange-200'}`}
                onClick={() => setBookFormat(option.key)}
                aria-pressed={bookFormat === option.key}
              >
                <span className="block text-sm font-semibold text-stone-700">{option.label}</span>
                <span className="text-xs text-stone-500">{option.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <label className="mt-4 block text-xs font-medium text-stone-600" htmlFor="book-title">书名 *</label>
      <input id="book-title" className="warm-input mt-1.5 min-h-11 w-full" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />

      <label className="mt-3 block text-xs font-medium text-stone-600" htmlFor="book-author">作者</label>
      <input id="book-author" className="warm-input mt-1.5 min-h-11 w-full" value={author} onChange={(event) => setAuthor(event.target.value)} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs font-medium text-stone-600">
          状态
          <select className="warm-input mt-1.5 min-h-11 w-full" value={status} onChange={(event) => setStatus(event.target.value as BookStatus)}>
            {BOOK_STATUS_DEFS.map((item) => <option key={item.key} value={item.key}>{item.emoji} {item.label}</option>)}
          </select>
        </label>
        {!isPdf && bookFormat === 'paper' && (
          <label className="text-xs font-medium text-stone-600">
            总页数
            <input className="warm-input mt-1.5 min-h-11 w-full" inputMode="numeric" value={totalPages} onChange={(event) => setTotalPages(event.target.value.replace(/\\D/g, ''))} />
          </label>
        )}
        {!isPdf && bookFormat === 'ebook' && (
          <label className="text-xs font-medium text-stone-600">
            总字数
            <input className="warm-input mt-1.5 min-h-11 w-full" inputMode="numeric" value={totalWords} onChange={(event) => setTotalWords(event.target.value.replace(/\\D/g, ''))} />
          </label>
        )}
      </div>

      {status === 'done' && (
        <label className="mt-3 block text-xs font-medium text-stone-600">
          完成日期
          <input type="date" className="warm-input mt-1.5 min-h-11 w-full" value={finishedAt} max={format(new Date(), 'yyyy-MM-dd')} onChange={(event) => event.target.value && setFinishedAt(event.target.value)} />
        </label>
      )}

      {book && (
        <>
          <div className="mt-3 flex items-center justify-between">
            <label className="text-xs font-medium text-stone-600" htmlFor="book-note">读后感 / 摘抄</label>
            <button className="warm-btn-ghost min-h-11 min-w-11 !px-2" title="全页编辑" onClick={() => setNoteExpanded(true)} aria-label="全页编辑读书笔记">
              <Maximize2 size={14} />
            </button>
          </div>
          <textarea id="book-note" className="warm-input mt-1.5 min-h-24 w-full resize-y" placeholder="记录这本书带给你的想法…" value={note} onChange={(event) => setNote(event.target.value)} />
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="warm-btn-ghost min-h-11" onClick={onClose} disabled={saving}>取消</button>
        <button className="warm-btn min-h-11" onClick={() => { void save() }} disabled={!title.trim() || saving}>{saving ? '保存中…' : '保存'}</button>
      </div>

      {noteExpanded && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#faf3e8]" role="dialog" aria-modal="true" aria-label="全页读书笔记编辑器">
          <div className="flex items-center justify-between border-b border-orange-200/60 bg-amber-50/90 px-4 py-3">
            <h4 className="truncate font-semibold text-orange-950">《{book?.title}》的笔记</h4>
            <button className="warm-btn min-h-11" onClick={() => setNoteExpanded(false)}><Check size={14} /> 完成</button>
          </div>
          <textarea className="w-full flex-1 resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed text-stone-800 outline-none" value={note} onChange={(event) => setNote(event.target.value)} autoFocus />
        </div>
      )}
    </Modal>
  )
}

