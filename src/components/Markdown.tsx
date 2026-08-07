import ReactMarkdown from 'react-markdown'

/**
 * 轻量 Markdown 渲染（react-markdown 默认转义 HTML，安全）
 * 用于 AI 总结与对话内容
 */
export default function Markdown({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-orange-800">{children}</strong>,
          em: ({ children }) => <em className="text-orange-700/90">{children}</em>,
          ul: ({ children }) => <ul className="my-1.5 list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-bold text-orange-900">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-3 mb-1.5 text-base font-bold text-orange-900">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-2.5 mb-1 text-sm font-bold text-orange-900">{children}</h4>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-orange-300 pl-3 text-stone-500">{children}</blockquote>
          ),
          code: ({ children, className }) =>
            className ? (
              <code className="block my-2 rounded-lg bg-orange-950/90 px-3 py-2 text-xs text-orange-50 overflow-x-auto">{children}</code>
            ) : (
              <code className="rounded bg-orange-100 px-1 py-0.5 text-[0.9em] text-orange-800">{children}</code>
            ),
          hr: () => <hr className="my-3 border-orange-200" />,
          a: ({ children, href }) => (
            <a className="text-orange-600 underline underline-offset-2" href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
