/** 通用统计小卡片（首页 / 统计页共用） */
export default function StatCard({ icon, label, value, unit }: { icon: string; label: string; value: number; unit: string }) {
  return (
    <div className="warm-card px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="text-xs text-stone-500 flex items-center gap-1.5">
        <span>{icon}</span>
        {label}
      </p>
      <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold text-orange-900">
        {value}
        <span className="ml-1 text-sm font-normal text-stone-400">{unit}</span>
      </p>
    </div>
  )
}
