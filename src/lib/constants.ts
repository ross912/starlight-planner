// 共享常量：心情、天气、计划层级

export const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

export interface MoodDef { key: string; label: string; emoji: string; color: string }
export const MOODS: MoodDef[] = [
  { key: 'happy', label: '开心', emoji: '😄', color: '#f59e0b' },
  { key: 'calm', label: '平静', emoji: '😌', color: '#84cc16' },
  { key: 'excited', label: '期待', emoji: '🤩', color: '#f97316' },
  { key: 'grateful', label: '感恩', emoji: '🥰', color: '#ec4899' },
  { key: 'tired', label: '疲惫', emoji: '😴', color: '#94a3b8' },
  { key: 'anxious', label: '焦虑', emoji: '😟', color: '#a78bfa' },
  { key: 'sad', label: '难过', emoji: '😢', color: '#60a5fa' },
  { key: 'angry', label: '生气', emoji: '😠', color: '#ef4444' },
]

export interface WeatherDef { key: string; label: string; emoji: string }
export const WEATHERS: WeatherDef[] = [
  { key: 'sunny', label: '晴', emoji: '☀️' },
  { key: 'cloudy', label: '多云', emoji: '⛅' },
  { key: 'overcast', label: '阴', emoji: '☁️' },
  { key: 'rain', label: '雨', emoji: '🌧️' },
  { key: 'storm', label: '雷雨', emoji: '⛈️' },
  { key: 'snow', label: '雪', emoji: '❄️' },
  { key: 'wind', label: '大风', emoji: '🍃' },
]

export const moodOf = (key: string) => MOODS.find((m) => m.key === key)
export const weatherOf = (key: string) => WEATHERS.find((w) => w.key === key)

export const LEVEL_DEFS: { key: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime'; label: string; icon: string; hint: string }[] = [
  { key: 'daily', label: '日计划', icon: '🌞', hint: '今天要做的事' },
  { key: 'weekly', label: '周计划', icon: '🗓️', hint: '这一周的目标' },
  { key: 'monthly', label: '月计划', icon: '🌙', hint: '这个月的安排' },
  { key: 'yearly', label: '年计划', icon: '🎯', hint: '今年的大方向' },
  { key: 'lifetime', label: '总计划', icon: '🌟', hint: '人生长期清单' },
]

// 记账分类
export interface TxCatDef { key: string; label: string; emoji: string; color: string }
export const EXPENSE_CATS: TxCatDef[] = [
  { key: 'food', label: '餐饮', emoji: '🍜', color: '#f97316' },
  { key: 'transport', label: '交通', emoji: '🚗', color: '#eab308' },
  { key: 'shopping', label: '购物', emoji: '🛍️', color: '#ec4899' },
  { key: 'housing', label: '住房', emoji: '🏠', color: '#a78bfa' },
  { key: 'fun', label: '娱乐', emoji: '🎮', color: '#60a5fa' },
  { key: 'medical', label: '医疗', emoji: '💊', color: '#34d399' },
  { key: 'education', label: '学习', emoji: '📚', color: '#f472b6' },
  { key: 'travel', label: '旅行', emoji: '✈️', color: '#38bdf8' },
  { key: 'social', label: '人情', emoji: '🎁', color: '#fb7185' },
  { key: 'other', label: '其他', emoji: '📦', color: '#a8a29e' },
]
export const INCOME_CATS: TxCatDef[] = [
  { key: 'salary', label: '工资', emoji: '💰', color: '#22c55e' },
  { key: 'parttime', label: '兼职', emoji: '🧑‍💻', color: '#84cc16' },
  { key: 'invest', label: '理财', emoji: '📈', color: '#10b981' },
  { key: 'redpacket', label: '红包', emoji: '🧧', color: '#ef4444' },
  { key: 'other', label: '其他', emoji: '✨', color: '#a8a29e' },
]
export const txCatOf = (type: 'expense' | 'income', key: string) =>
  (type === 'expense' ? EXPENSE_CATS : INCOME_CATS).find((c) => c.key === key)

// 阅读状态
export const BOOK_STATUS_DEFS: { key: 'want' | 'reading' | 'done'; label: string; emoji: string }[] = [
  { key: 'want', label: '想读', emoji: '🔖' },
  { key: 'reading', label: '在读', emoji: '📖' },
  { key: 'done', label: '已读', emoji: '✅' },
]
export const bookStatusOf = (key: string) => BOOK_STATUS_DEFS.find((s) => s.key === key)

// 羽毛球类型
export const BADMINTON_TYPES: { key: 'ms' | 'md' | 'xd'; label: string }[] = [
  { key: 'ms', label: '男单' },
  { key: 'md', label: '男双' },
  { key: 'xd', label: '混双' },
]
export const badmintonTypeOf = (key: string) => BADMINTON_TYPES.find((t) => t.key === key)

/** 分钟 → 友好时长 */
export const fmtDuration = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}小时${min % 60 ? `${min % 60}分` : ''}` : `${min}分钟`

/** 书名 → 稳定的书脊配色（暖色系） */
const BOOK_COLORS = ['#f97316', '#f59e0b', '#fb7185', '#e879a0', '#d97706', '#ea8a3c', '#f472b6', '#fbbf24']
export const bookColor = (title: string) => {
  let h = 0
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0
  return BOOK_COLORS[h % BOOK_COLORS.length]
}

/** 分 → 显示用金额字符串 */
export const fenToYuan = (fen: number) =>
  (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
