import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ListTree, Minus, Plus, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Outline, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { api } from '../lib/api'
import type { Book } from '../types'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// ---------- touch helpers ----------

interface TouchSnapshot {
  touches: number
  startX: number
  startY: number
  startTime: number
  pinchBaseDist: number
  pinchBaseZoom: number
}

export default function PdfReader({ book, onClose, onBookUpdated }: { book: Book; onClose: () => void; onBookUpdated: (book: Book) => void }) {
  const [pageNumber, setPageNumber] = useState(Math.max(1, book.currentPage || 1))
  const [pageInput, setPageInput] = useState(String(Math.max(1, book.currentPage || 1)))
  const [numPages, setNumPages] = useState(book.totalPages || 0)
  const [zoom, setZoom] = useState(1)
  const [showOutline, setShowOutline] = useState(false)
  const [pageWidth, setPageWidth] = useState(760)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [toolbarVisible, setToolbarVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const viewportRef = useRef<HTMLElement | null>(null)
  const lastSavedRef = useRef('')
  const touchRef = useRef<TouchSnapshot | null>(null)
  const lastTapRef = useRef(0)
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- navigation ----

  const goToPage = useCallback((page: number) => {
    const next = clamp(Math.round(page || 1), 1, numPages || 1)
    setPageNumber(next)
    setPageInput(String(next))
    // 手机切页时重置缩放为自适应宽度
    if (isMobile) setZoom(1)
  }, [numPages, isMobile])

  // ---- responsive viewport ----

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const resize = () => {
      const w = viewport.clientWidth
      setIsMobile(w < 640)
      setPageWidth(Math.min(980, Math.max(280, w - (w < 640 ? 0 : 32))))
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  // ---- save progress ----

  const saveProgress = useCallback(async (page: number, total: number) => {
    if (!total) return
    const key = `${page}/${total}`
    if (lastSavedRef.current === key) return
    lastSavedRef.current = key
    setSaving(true)
    try {
      const updated = await api.updateBook(book.id, {
        status: book.status === 'want' ? 'reading' : book.status,
        totalPages: total,
        currentPage: page,
        progressPercent: (page / total) * 100,
      })
      onBookUpdated(updated)
    } catch {
      lastSavedRef.current = ''
    } finally {
      setSaving(false)
    }
  }, [book.id, book.status, onBookUpdated])

  useEffect(() => {
    if (!numPages) return
    const timer = window.setTimeout(() => { void saveProgress(pageNumber, numPages) }, 650)
    return () => window.clearTimeout(timer)
  }, [numPages, pageNumber, saveProgress])

  const closeReader = useCallback(async () => {
    await saveProgress(pageNumber, numPages)
    onClose()
  }, [numPages, onClose, pageNumber, saveProgress])

  // ---- keyboard shortcuts (desktop) ----

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowLeft') goToPage(pageNumber - 1)
      if (event.key === 'ArrowRight') goToPage(pageNumber + 1)
      if (event.key === 'Escape') void closeReader()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [goToPage, pageNumber, closeReader])

  // ---- toolbar auto-hide on mobile ----

  const toggleToolbar = useCallback(() => {
    setToolbarVisible((v) => !v)
  }, [])

  const scheduleToolbarHide = useCallback(() => {
    if (!isMobile) return
    if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current)
    toolbarTimerRef.current = setTimeout(() => setToolbarVisible(false), 3000)
  }, [isMobile])

  // show toolbar on any zoom / page change, then auto-hide
  useEffect(() => {
    setToolbarVisible(true)
    scheduleToolbarHide()
  }, [zoom, pageNumber, scheduleToolbarHide])

  // ---- touch handlers (mobile swipe + pinch + tap) ----

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches
    if (touches.length === 1) {
      touchRef.current = {
        touches: 1,
        startX: touches[0].clientX,
        startY: touches[0].clientY,
        startTime: Date.now(),
        pinchBaseDist: 0,
        pinchBaseZoom: zoom,
      }
    } else if (touches.length === 2) {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      touchRef.current = {
        touches: 2,
        startX: 0,
        startY: 0,
        startTime: Date.now(),
        pinchBaseDist: Math.hypot(dx, dy),
        pinchBaseZoom: zoom,
      }
    }
  }, [zoom])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const snap = touchRef.current
    if (!snap || snap.touches !== 2) return
    if (e.touches.length !== 2) return

    const dx = e.touches[0].clientX - e.touches[1].clientX
    const dy = e.touches[0].clientY - e.touches[1].clientY
    const currentDist = Math.hypot(dx, dy)

    if (snap.pinchBaseDist > 0) {
      const newZoom = clamp(snap.pinchBaseZoom * (currentDist / snap.pinchBaseDist), 0.6, 3)
      setZoom(Number(newZoom.toFixed(2)))
    }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const snap = touchRef.current
    if (!snap) return

    if (snap.touches === 1 && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - snap.startX
      const dy = e.changedTouches[0].clientY - snap.startY
      const dt = Date.now() - snap.startTime

      // double-tap → zoom toggle
      if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 300) {
        const sinceLast = Date.now() - lastTapRef.current
        lastTapRef.current = Date.now()
        if (sinceLast < 350) {
          // double tap: toggle between fit-width (1) and 2x
          setZoom((z) => (z < 1.5 ? 2 : 1))
          touchRef.current = null
          return
        }
        // single tap → toggle toolbar
        toggleToolbar()
        touchRef.current = null
        return
      }

      // horizontal swipe → page turn
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx > 0) goToPage(pageNumber - 1)   // swipe right → prev
        else goToPage(pageNumber + 1)           // swipe left → next
      }
    }

    touchRef.current = null
  }, [goToPage, pageNumber, toggleToolbar])

  // ---- zoom controls ----

  const zoomIn = useCallback(() => setZoom((z) => clamp(Number((z + 0.1).toFixed(1)), 0.6, 3)), [])
  const zoomOut = useCallback(() => setZoom((z) => clamp(Number((z - 0.1).toFixed(1)), 0.6, 3)), [])
  const fitWidth = useCallback(() => setZoom(1), [])

  const progress = numPages ? Math.round((pageNumber / numPages) * 100) : 0
  const zoomPct = Math.round(zoom * 100)

  // ---- render ----

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-stone-900 text-white" role="dialog" aria-modal="true" aria-label={`阅读《${book.title}》`}>
      {/* ---- header ---- */}
      <header
        className={`z-10 flex min-h-14 items-center gap-1 border-b border-white/10 bg-stone-950/95 px-2 transition-transform duration-300 sm:gap-2 sm:px-4 ${
          toolbarVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button className="reader-tool" onClick={() => setShowOutline((v) => !v)} aria-label="打开或关闭目录" aria-pressed={showOutline}>
          <ListTree size={18} />
        </button>
        <div className="min-w-0 flex-1 px-1 sm:px-2">
          <h3 className="truncate text-sm font-semibold sm:text-base">《{book.title}》</h3>
          <p className="text-[11px] text-stone-400">{saving ? '正在保存进度…' : `已读 ${progress}% · ${pageNumber}/${numPages || '—'} 页`}</p>
        </div>

        {/* 桌面缩放 */}
        <button className="reader-tool hidden sm:inline-flex" onClick={zoomOut} aria-label="缩小"><ZoomOut size={18} /></button>
        <span className="hidden w-12 text-center text-xs text-stone-300 sm:inline-block">{zoomPct}%</span>
        <button className="reader-tool hidden sm:inline-flex" onClick={zoomIn} aria-label="放大"><ZoomIn size={18} /></button>

        <button className="reader-tool" onClick={() => { void closeReader() }} aria-label="关闭阅读器"><X size={20} /></button>
      </header>

      {/* ---- document area ---- */}
      <Document
        className="pdf-reader-document min-h-0 flex-1"
        file={api.bookPdfUrl(book.id)}
        onLoadSuccess={({ numPages: loadedPages }) => {
          const resumePage = clamp(book.currentPage || 1, 1, loadedPages)
          setNumPages(loadedPages)
          setPageNumber(resumePage)
          setPageInput(String(resumePage))
          setLoadError('')
          if (isMobile) setZoom(1)
        }}
        onLoadError={() => setLoadError('PDF 加载失败，请检查文件是否完整')}
        loading={<div className="flex h-full items-center justify-center text-sm text-stone-300">正在解析 PDF…</div>}
        error={<div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-300">{loadError || 'PDF 加载失败'}</div>}
      >
        {/* outline sidebar */}
        {showOutline && (
          <aside className="absolute inset-y-14 left-0 z-20 w-[min(82vw,320px)] overflow-y-auto border-r border-stone-700 bg-stone-900 p-4 shadow-xl sm:static sm:inset-auto sm:z-auto sm:w-72 sm:shrink-0 sm:shadow-none">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">目录</h4>
              <button className="reader-tool sm:hidden" onClick={() => setShowOutline(false)} aria-label="关闭目录"><X size={18} /></button>
            </div>
            <Outline
              className="pdf-outline text-sm text-stone-200"
              onItemClick={({ pageNumber: outlinePage }) => {
                if (outlinePage) goToPage(outlinePage)
                if (window.innerWidth < 640) setShowOutline(false)
              }}
              onLoadError={() => undefined}
            />
          </aside>
        )}

        {/* main PDF viewport */}
        <main
          ref={(node) => { viewportRef.current = node }}
          className="min-w-0 flex-1 overflow-auto bg-stone-800"
          onTouchStart={isMobile ? handleTouchStart : undefined}
          onTouchMove={isMobile ? handleTouchMove : undefined}
          onTouchEnd={isMobile ? handleTouchEnd : undefined}
        >
          <div className="mx-auto w-fit py-5 shadow-2xl sm:py-5" style={{ background: 'white' }}>
            <Page
              pageNumber={pageNumber}
              width={isMobile ? pageWidth : pageWidth}
              scale={zoom}
              renderAnnotationLayer
              renderTextLayer
              loading={<div className="flex min-h-96 items-center justify-center text-sm text-stone-500">正在渲染第 {pageNumber} 页…</div>}
            />
          </div>
        </main>
      </Document>

      {/* ---- footer ---- */}
      <footer
        className={`z-10 flex min-h-16 items-center justify-center gap-2 border-t border-white/10 bg-stone-950/95 px-2 transition-transform duration-300 sm:gap-3 ${
          toolbarVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <button className="reader-tool" onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} aria-label="上一页">
          <ChevronLeft size={20} />
        </button>

        <form className="flex items-center gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); goToPage(Number(pageInput)) }}>
          <label className="sr-only" htmlFor="pdf-page-input">跳转页码</label>
          <input
            id="pdf-page-input"
            className="h-11 w-16 rounded-lg border border-stone-600 bg-stone-800 px-2 text-center text-white outline-none focus:border-orange-400"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
            onBlur={() => goToPage(Number(pageInput))}
          />
          <span className="whitespace-nowrap text-stone-400">/ {numPages || '—'} 页</span>
        </form>

        <button className="reader-tool" onClick={() => goToPage(pageNumber + 1)} disabled={!numPages || pageNumber >= numPages} aria-label="下一页">
          <ChevronRight size={20} />
        </button>

        {/* 手机端缩放按钮 */}
        <div className="ml-2 flex items-center gap-1 rounded-lg bg-stone-800 px-1.5 py-1 sm:hidden">
          <button className="reader-tool !p-1" onClick={zoomOut} aria-label="缩小"><Minus size={16} /></button>
          <button className="min-h-8 min-w-11 rounded px-1.5 text-xs font-medium text-stone-300" onClick={fitWidth}>
            {zoomPct}%
          </button>
          <button className="reader-tool !p-1" onClick={zoomIn} aria-label="放大"><Plus size={16} /></button>
        </div>
      </footer>
    </div>
  )
}
