import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { format, parseISO } from 'date-fns'
import { ChevronRight, MessageCircle, RefreshCw, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import Markdown from '../components/Markdown'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

type Summary = { date: string; content: string; created_at: string }

export default function SummaryPage() {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setSummaries(await api.listSummaries())
    setLoading(false)
  }, [])

  useEffect(() => {
    queueMicrotask(() => { load().catch(console.error) })
  }, [load])

  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      await api.generateSummary(todayStr)
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg.includes('no_api_key') ? 'AI 服务未配置密钥，请联系管理员' : 'AI 暂时繁忙，稍后再试一次')
    } finally {
      setGenerating(false)
    }
  }

  const todaySummary = summaries.find((s) => s.date === todayStr)
  const past = summaries.filter((s) => s.date !== todayStr)

  return (
    <div className="flex flex-col min-h-[calc(100vh-12rem)] md:min-h-0">
      <header>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-950">AI 总结</h2>
        <p className="mt-1 text-sm text-stone-500">读懂你的全部记录，每天为你写一封信。</p>
      </header>

      {/* 今日总结 */}
      <section className="warm-card mt-4 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-orange-950 flex items-center gap-2">
            <Sparkles size={16} className="text-orange-500" />
            今日总结 · {format(new Date(), 'M月d日')}
          </h3>
          {todaySummary && (
            <button
              className="warm-btn-ghost !py-1 text-xs"
              onClick={generate}
              disabled={generating}
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
              重新生成
            </button>
          )}
        </div>

        {generating ? (
          <div className="py-8 text-center">
            <p className="text-sm text-stone-400 animate-pulse">AI 正在通读你所有的记录，写今天的总结…</p>
            <p className="mt-1 text-xs text-stone-300">数据多的话需要十几秒</p>
          </div>
        ) : todaySummary ? (
          <Markdown text={todaySummary.content} className="mt-3 text-[15px] leading-relaxed text-stone-700" />
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-stone-400">今天的总结还没生成</p>
            <button className="warm-btn mt-3" onClick={generate}>
              <Sparkles size={15} /> 生成本日总结
            </button>
            <p className="mt-2 text-xs text-stone-300">建议晚上记录完再生成；每晚 22:00 也会自动生成</p>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
      </section>

      {/* 历史总结 */}
      <section className="mt-4 flex-1">
        <h3 className="text-sm font-medium text-stone-500">往日总结</h3>
        {loading ? (
          <p className="mt-3 text-sm text-stone-400">加载中…</p>
        ) : past.length > 0 ? (
          <div className="mt-2 space-y-3">
            {past.map((s) => {
              const d = parseISO(s.date)
              return (
                <article key={s.date} className="warm-card p-4">
                  <p className="text-xs font-medium text-orange-800/70">
                    {d.getMonth() + 1}月{d.getDate()}日 周{WEEKDAYS[d.getDay()]}
                  </p>
                  <Markdown text={s.content} className="mt-1.5 text-sm leading-relaxed text-stone-600" />
                </article>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-400">还没有历史总结，从第一篇开始吧 ✨</p>
        )}
      </section>

      {/* 底部对话条（点击进入对话空间） */}
      <Link
        to="/summary/chat"
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 mt-4 flex items-center gap-3 rounded-2xl border border-orange-200 bg-white/90 backdrop-blur px-4 py-3.5 shadow-[0_4px_20px_-6px_rgba(194,120,40,0.35)] transition hover:border-orange-300 hover:shadow-[0_6px_24px_-6px_rgba(194,120,40,0.5)]"
      >
        <MessageCircle size={18} className="text-orange-500 shrink-0" />
        <span className="flex-1 text-sm text-stone-400">和 AI 聊聊你的记录、习惯和目标…</span>
        <ChevronRight size={16} className="text-stone-400" />
      </Link>
    </div>
  )
}
