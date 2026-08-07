import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Document, Page, pdfjs } from 'react-pdf'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { api } from '../lib/api'
import type { Book } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** PDF 阅读器：页码即进度，自动同步到书籍进度（百分比） */
export default function PdfReaderPage() {
  const { bookId } = useParams()
  const id = Number(bookId)
  const [book, setBook] = useState<Book | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [loadError, setLoadError] = useState('')
  const [containerW, setContainerW] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<number | undefined>(undefined)

  // 载入书籍信息，恢复上次页码
  useEffect(() => {
    queueMicrotask(() => {
      api.listBooks().then((books) => {
        const b = books.find((x) => x.id === id)
        if (b) {
          setBook(b)
          setPage(Math.max(1, b.currentPage || 1))
        }
      }).catch(console.error)
    })
  }, [id])

  // 文档加载后：回填总页数到书籍（供卡片展示与进度计算），并钳制页码
  const onDocLoad = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      setPage((p) => Math.min(p, n))
      setBook((b) => {
        if (b && b.pdfPages !== n) {
          api.updateBook(id, { pdfPages: n }).catch(() => {})
          return { ...b, pdfPages: n }
        }
        return b
      })
    },
    [id],
  )

  // 容器宽度自适应
  useEffect(() => {
    const measure = () => setContainerW(Math.min(stageRef.current?.clientWidth ?? 0, 900))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // 进度自动保存（防抖）：页码 → 百分比
  useEffect(() => {
    if (!numPages || !book) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      const pct = Math.min(100, Math.round((page / numPages) * 1000) / 10)
      api.updateBook(id, {
        currentPage: page,
        progressPct: pct,
        ...(book.status === 'want' ? { status: 'reading' } : {}),
      }).catch(() => {})
    }, 600)
    return () => window.clearTimeout(saveTimer.current)
  }, [page, numPages, id, book])

  const markDone = useCallback(async () => {
    await api.updateBook(id, { status: 'done', progressPct: 100 })
    setBook((b) => (b ? { ...b, status: 'done', progressPct: 100 } : b))
  }, [id])

  const pct = useMemo(() => (numPages ? Math.round((page / numPages) * 100) : 0), [page, numPages])

  if (!book) {
    return <p className="py-20 text-center text-sm text-stone-400">正在打开书籍…</p>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-7rem)]">
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/reading" className="warm-btn-ghost !px-2 -ml-2 shrink-0">
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-orange-950 truncate">《{book.title}》</h2>
            <p className="text-xs text-stone-400 truncate">{book.pdfName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button className="warm-btn-ghost !px-2" onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.2) * 10) / 10))} title="缩小">
            <ZoomOut size={15} />
          </button>
          <span className="w-11 text-center text-xs text-stone-500">{Math.round(zoom * 100)}%</span>
          <button className="warm-btn-ghost !px-2" onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.2) * 10) / 10))} title="放大">
            <ZoomIn size={15} />
          </button>
          {book.status !== 'done' && numPages > 0 && (
            <button className="warm-btn-ghost !px-2 text-xs text-emerald-700" onClick={markDone} title="标记读完">
              <Check size={14} />
            </button>
          )}
        </div>
      </header>

      {/* 阅读区 */}
      <div ref={stageRef} className="flex-1 overflow-auto rounded-2xl border border-orange-100 bg-stone-800/90 flex justify-center py-4">
        <Document
          file={{ url: api.pdfUrl(id) }}
          onLoadSuccess={onDocLoad}
          onLoadError={() => setLoadError('PDF 打开失败，文件可能已损坏')}
          loading={<p className="self-center text-sm text-stone-300">正在解析 PDF…</p>}
          error={<p className="self-center text-sm text-stone-300">{loadError || '加载失败'}</p>}
        >
          {containerW > 0 && (
            <Page
              pageNumber={page}
              width={Math.floor(containerW * 0.96 * zoom)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          )}
        </Document>
      </div>

      {/* 底部页码栏 */}
      <footer className="flex items-center gap-3 pt-3">
        <button className="warm-btn-ghost !px-2" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          <ChevronLeft size={16} />
        </button>
        <input
          type="range"
          min={1}
          max={Math.max(numPages, 1)}
          value={page}
          onChange={(e) => setPage(Number(e.target.value))}
          className="flex-1 accent-orange-500"
          disabled={!numPages}
        />
        <button className="warm-btn-ghost !px-2" onClick={() => setPage((p) => Math.min(numPages || p, p + 1))} disabled={!numPages || page >= numPages}>
          <ChevronRight size={16} />
        </button>
        <span className="shrink-0 text-xs text-stone-500 w-24 text-right">
          {numPages ? `${page} / ${numPages} 页 · ${pct}%` : '…'}
        </span>
      </footer>
    </div>
  )
}
