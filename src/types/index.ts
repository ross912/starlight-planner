// 数据类型定义（与后端 API 对应）

export type Level = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime'

export interface Diary {
  id: number
  date: string // yyyy-MM-dd
  content: string
  mood: string
  weather: string
  tags: string[]
  createdAt: string
  updatedAt: string
  snippet?: string
}

export type TodoStatus = 'pending' | 'done' | 'failed'

export interface Todo {
  id: number
  level: Level
  period: string
  title: string
  note: string
  done: boolean
  status: TodoStatus
  parentId: number | null
  parentTitle: string | null
  parentLevel: Level | null
  childrenTotal: number
  childrenDone: number
  createdAt: string
  updatedAt: string
}

export interface StatsOverview {
  diary: {
    total: number
    streak: number
    moodDistribution: { mood: string; count: number }[]
    heatmap: { date: string; has: boolean }[]
  }
  todos: {
    levelStats: Record<Level, { total: number; done: number }>
    trend: { date: string; total: number; done: number }[]
    taskStreak: number
  }
  money: {
    month: string
    expense: number
    income: number
    year: string
    yearExpense: number
    yearIncome: number
    yearTrend: { month: string; expense: number; income: number }[]
    yearByCategory: { category: string; total: number }[]
  }
  books: { total: number; reading: number; doneThisYear: number }
  fitness: {
    todayCount: number
    weekDays: number
    monthSessions: number
    totalSessions: number
    trend: { date: string; count: number }[]
    month: {
      days: number
      runKm: number
      runMin: number
      badmintonMin: number
    }
    prs: { exercise: string; weightKg: number }[]
  }
}

export type WorkoutType = 'strength' | 'run' | 'badminton'
export type MatchType = 'ms' | 'md' | 'xd'

export interface Exercise {
  id: number
  name: string
}

export interface Workout {
  id: number
  date: string
  type: WorkoutType
  exercise: string | null
  weightKg: number | null
  sets: number | null
  reps: number | null
  durationMin: number | null
  distanceKm: number | null
  weather: string | null
  matchType: MatchType | null
  note: string
  createdAt: string
  updatedAt: string
}

export type BookStatus = 'want' | 'reading' | 'done'

export interface Book {
  id: number
  title: string
  author: string
  status: BookStatus
  kind: 'paper' | 'ebook'
  rating: number // 0-5
  totalPages: number
  currentPage: number
  totalWords: number
  progressPct: number
  hasPdf: boolean
  pdfPages: number
  pdfName: string
  note: string
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type TxType = 'expense' | 'income'

export interface Transaction {
  id: number
  type: TxType
  amount: number // 单位：分
  category: string
  note: string
  date: string
  createdAt: string
  updatedAt: string
}

export interface TxStats {
  month: string
  expense: number
  income: number
  byCategory: { category: string; type: TxType; total: number }[]
  daily: { date: string; expense: number; income: number }[]
}
