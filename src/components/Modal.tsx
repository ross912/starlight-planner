import { X } from 'lucide-react'

export function Modal({
  title,
  onClose,
  children,
  maxWidth = 'max-w-md',
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 cursor-default bg-stone-900/30 backdrop-blur-sm" onClick={onClose} aria-label="关闭弹窗" />
      <div className={`warm-card relative max-h-[90vh] w-full ${maxWidth} overflow-y-auto p-6 shadow-xl`}>
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold text-orange-950">{title}</h4>
          <button className="warm-btn-ghost min-h-11 min-w-11 !px-2" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  )
}
