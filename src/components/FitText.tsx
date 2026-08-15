import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * FitText — 自适应缩放字号，严格束缚在容器内不换行
 *
 * 用隐藏 span 在目标字号下测量文本自然宽度，与容器宽度比较：
 * 装得下用大字号，装不下按比例缩放到刚好容纳，最低不低于 minPx。
 * ResizeObserver 监听容器尺寸变化，横竖屏/窗口缩放自动重算。
 *
 * inline=true  渲染为行内 inline-block，可与文字混排（继承外层字号/字重/行高）
 * inline=false 渲染为块级元素，用于独立卡片（font-weight/line-height 由 className 控制）
 */
export default function FitText({
  children,
  maxPx = 18,
  smMaxPx,
  minPx = 10,
  className = '',
  inline = false,
}: {
  children: ReactNode
  maxPx?: number
  smMaxPx?: number
  minPx?: number
  className?: string
  inline?: boolean
}) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const hiddenRef = useRef<HTMLSpanElement>(null)
  const [fontSize, setFontSize] = useState(maxPx)

  useLayoutEffect(() => {
    const calc = () => {
      const container = containerRef.current
      const hidden = hiddenRef.current
      if (!container || !hidden) return

      const cw = container.clientWidth
      if (cw === 0) return

      if (smMaxPx) {
        hidden.style.fontSize = `${smMaxPx}px`
        if (hidden.scrollWidth <= cw) { setFontSize(smMaxPx); return }
      }

      hidden.style.fontSize = `${maxPx}px`
      const tw = hidden.scrollWidth
      if (tw <= cw) { setFontSize(maxPx); return }

      const scale = (cw - 2) / tw
      setFontSize(Math.max(minPx, Math.floor(maxPx * scale)))
    }

    calc()
    const ro = new ResizeObserver(calc)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [children, maxPx, smMaxPx, minPx])

  if (inline) {
    // 行内模式：不设 overflow（避免破坏基线对齐），字号/字重/行高全部继承外层
    return (
      <span
        ref={containerRef}
        className={className}
        style={{ display: 'inline-block', maxWidth: '100%', verticalAlign: 'baseline' }}
      >
        <span style={{ fontSize: `${fontSize}px`, whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'baseline' }}>
          {children}
        </span>
        <span
          ref={hiddenRef}
          aria-hidden="true"
          style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', left: -9999 }}
        >
          {children}
        </span>
      </span>
    )
  }

  // 块级模式：overflow:hidden 严格裁切，font-weight/line-height 由 className 控制
  return (
    <span
      ref={containerRef}
      className={className}
      style={{ display: 'block', overflow: 'hidden', maxWidth: '100%' }}
    >
      <span style={{ fontSize: `${fontSize}px`, whiteSpace: 'nowrap', display: 'inline-block' }}>
        {children}
      </span>
      <span
        ref={hiddenRef}
        aria-hidden="true"
        style={{ position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap', pointerEvents: 'none', left: -9999 }}
      >
        {children}
      </span>
    </span>
  )
}
