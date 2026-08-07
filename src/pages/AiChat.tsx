import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Send, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../lib/api'
import Markdown from '../components/Markdown'

type Msg = { role: 'user' | 'assistant'; content: string; created_at?: string }

export default function AiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queueMicrotask(() => {
      api.aiChatHistory().then(setMessages).catch(console.error)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setSending(true)
    try {
      const { reply } = await api.aiChat(text)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(msg.includes('no_api_key') ? 'AI 服务未配置密钥' : 'AI 暂时繁忙，这条没发出去，再试一次')
      // 发送失败时把用户消息标回输入框
      setInput(text)
      setMessages((m) => m.slice(0, -1))
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, sending])

  const clear = async () => {
    if (!window.confirm('清空全部对话记录？（手帐数据不受影响）')) return
    await api.clearAiChat()
    setMessages([])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] md:h-[calc(100vh-7rem)]">
      {/* 头部 */}
      <header className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Link to="/summary" className="warm-btn-ghost !px-2 -ml-2">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 className="text-lg font-bold text-orange-950 flex items-center gap-1.5">
              <Sparkles size={16} className="text-orange-500" /> AI 对话
            </h2>
            <p className="text-xs text-stone-400">它读过你从第一天至今的全部手帐</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clear} className="warm-btn-ghost !px-2 text-stone-400 hover:text-rose-500" title="清空对话">
            <Trash2 size={15} />
          </button>
        )}
      </header>

      {/* 消息区 */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
        {messages.length === 0 && !sending && (
          <div className="py-10 text-center">
            <p className="text-3xl">✨</p>
            <p className="mt-3 text-sm text-stone-500">问点什么吧，比如：</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {['我最近坚持得怎么样', '这周比上周进步了吗', '帮我看看钱花在哪了', '我的训练量够吗'].map((q) => (
                <button
                  key={q}
                  className="rounded-full bg-white/80 border border-orange-200 px-3.5 py-1.5 text-xs text-orange-700 hover:bg-orange-50 transition"
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'assistant' ? (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-xs text-white shadow-sm">✨</span>
              <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-white/90 border border-orange-100 px-3.5 py-2.5 text-sm leading-relaxed text-stone-700">
                <Markdown text={m.content} />
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="max-w-[82%] rounded-2xl rounded-tr-md bg-gradient-to-br from-orange-500 to-orange-600 px-3.5 py-2.5 text-sm leading-relaxed text-white whitespace-pre-wrap shadow-[0_2px_10px_-3px_rgba(234,88,12,0.4)]">
                {m.content}
              </div>
            </div>
          ),
        )}

        {sending && (
          <div className="flex items-start gap-2.5">
            <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-400 text-xs text-white">✨</span>
            <div className="rounded-2xl rounded-tl-md bg-white/90 border border-orange-100 px-4 py-3">
              <span className="inline-flex gap-1">
                <i className="h-1.5 w-1.5 rounded-full bg-orange-300 animate-bounce" />
                <i className="h-1.5 w-1.5 rounded-full bg-orange-300 animate-bounce [animation-delay:0.15s]" />
                <i className="h-1.5 w-1.5 rounded-full bg-orange-300 animate-bounce [animation-delay:0.3s]" />
              </span>
            </div>
          </div>
        )}
        {error && <p className="text-center text-xs text-rose-500">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* 输入条 */}
      <div className="flex items-center gap-2 border-t border-orange-100 pt-3">
        <input
          ref={inputRef}
          className="warm-input flex-1"
          placeholder="和 AI 聊聊…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={sending}
        />
        <button className="warm-btn !px-3.5" onClick={send} disabled={sending || !input.trim()}>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
