// 周期（period）工具：日 / ISO 周 / 月 / 年 / 长期
import { addDays, addMonths, addYears, format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import type { Level } from '../types'

const pad2 = (n: number) => String(n).padStart(2, '0')

/** ISO 周 → 该周周一的日期 */
export function isoWeekToDate(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7 // 周一=0
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - jan4Day + (week - 1) * 7)
  return monday
}

/** 某天在某层级下的周期标识 */
export function periodOf(level: Level, d: Date): string {
  switch (level) {
    case 'daily': return format(d, 'yyyy-MM-dd')
    case 'weekly': return `${getISOWeekYear(d)}-W${pad2(getISOWeek(d))}`
    case 'monthly': return format(d, 'yyyy-MM')
    case 'yearly': return format(d, 'yyyy')
    case 'lifetime': return 'all'
  }
}

/** 周期标识 → 代表日期（用于前后导航） */
export function periodToDate(level: Level, period: string): Date {
  switch (level) {
    case 'daily': return parseISO(period)
    case 'weekly': {
      const m = period.match(/^(\d{4})-W(\d{2})$/)
      return m ? isoWeekToDate(Number(m[1]), Number(m[2])) : new Date()
    }
    case 'monthly': return parseISO(`${period}-01`)
    case 'yearly': return parseISO(`${period}-01-01`)
    case 'lifetime': return new Date()
  }
}

export function shiftPeriod(level: Level, period: string, delta: number): string {
  const d = periodToDate(level, period)
  switch (level) {
    case 'daily': return periodOf(level, addDays(d, delta))
    case 'weekly': return periodOf(level, addDays(d, delta * 7))
    case 'monthly': return periodOf(level, addMonths(d, delta))
    case 'yearly': return periodOf(level, addYears(d, delta))
    case 'lifetime': return 'all'
  }
}

export function isCurrentPeriod(level: Level, period: string): boolean {
  return period === periodOf(level, new Date())
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function periodLabel(level: Level, period: string): string {
  switch (level) {
    case 'daily': {
      const d = parseISO(period)
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${WEEKDAYS[d.getDay()]}`
    }
    case 'weekly': {
      const m = period.match(/^(\d{4})-W(\d{2})$/)
      if (!m) return period
      const start = isoWeekToDate(Number(m[1]), Number(m[2]))
      const end = addDays(start, 6)
      return `${m[1]}年第${Number(m[2])}周（${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}）`
    }
    case 'monthly': {
      const [y, mo] = period.split('-')
      return `${y}年${Number(mo)}月`
    }
    case 'yearly': return `${period}年`
    case 'lifetime': return '长期 · 不设期限'
  }
}

export function currentLabel(level: Level): string {
  switch (level) {
    case 'daily': return '今天'
    case 'weekly': return '本周'
    case 'monthly': return '本月'
    case 'yearly': return '今年'
    case 'lifetime': return '长期'
  }
}

/** 上层周期：日→周→月→年→总（逻辑关联用） */
export function parentPeriodOf(level: Level, period: string): { level: Level; period: string } | null {
  switch (level) {
    case 'daily': return { level: 'weekly', period: periodOf('weekly', periodToDate('daily', period)) }
    case 'weekly': return { level: 'monthly', period: periodOf('monthly', periodToDate('weekly', period)) }
    case 'monthly': return { level: 'yearly', period: period.slice(0, 4) }
    case 'yearly': return { level: 'lifetime', period: 'all' }
    case 'lifetime': return null
  }
}
