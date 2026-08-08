// API 封装
import type { Book, BookStatus, Diary, Exercise, ReadingEntry, StatsOverview, Todo, TodoStatus, Transaction, TxStats, TxType, Workout } from '../types'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...init,
  })
  if (res.status === 401) {
    // 会话失效，通知登录门
    window.dispatchEvent(new CustomEvent('auth:required'))
    throw new Error('需要重新登录')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`请求失败 ${res.status}: ${text.slice(0, 120)}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // 日记
  listDiaries: (params?: { q?: string; month?: string }) => {
    const sp = new URLSearchParams()
    if (params?.q) sp.set('q', params.q)
    if (params?.month) sp.set('month', params.month)
    const qs = sp.toString()
    return http<(Diary & { snippet: string })[]>(`/api/diaries${qs ? `?${qs}` : ''}`)
  },
  getDiary: (date: string) => http<Diary>(`/api/diaries/${date}`),
  saveDiary: (date: string, data: { content: string; mood: string; weather: string; tags: string[] }) =>
    http<Diary>(`/api/diaries/${date}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDiary: (date: string) => http<{ ok: boolean }>(`/api/diaries/${date}`, { method: 'DELETE' }),

  // 计划
  listTodos: (level: string, period: string) => http<Todo[]>(`/api/todos?level=${level}&period=${encodeURIComponent(period)}`),
  createTodo: (data: { level: string; period: string; title: string; note?: string; parentId?: number | null }) =>
    http<Todo>('/api/todos', { method: 'POST', body: JSON.stringify(data) }),
  updateTodo: (id: number, data: Partial<{ title: string; note: string; done: boolean; status: TodoStatus; parentId: number | null }>) =>
    http<Todo>(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTodo: (id: number) => http<{ ok: boolean }>(`/api/todos/${id}`, { method: 'DELETE' }),

  // 统计
  stats: () => http<StatsOverview>('/api/stats/overview'),
  exportUrl: '/api/export',

  // 记账
  listTransactions: (month: string) => http<Transaction[]>(`/api/transactions?month=${month}`),
  createTransaction: (data: { type: TxType; amount: number; category: string; note?: string; date: string }) =>
    http<Transaction>('/api/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: number, data: Partial<{ type: TxType; amount: number; category: string; note: string; date: string }>) =>
    http<Transaction>(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTransaction: (id: number) => http<{ ok: boolean }>(`/api/transactions/${id}`, { method: 'DELETE' }),
  transactionStats: (month: string) => http<TxStats>(`/api/transactions/stats?month=${month}`),
  getBudget: (month: string) => http<{ id: number; month: string; amount: number } | null>(`/api/budgets?month=${month}`),
  saveBudget: (month: string, amount: number) => http<{ ok: boolean }>('/api/budgets', { method: 'PUT', body: JSON.stringify({ month, amount }) }),

  // 阅读
  listBooks: (status?: BookStatus) => http<Book[]>(`/api/books${status ? `?status=${status}` : ''}`),
  createBook: (data: { title: string; author?: string; status?: BookStatus; kind?: 'paper' | 'ebook'; bookFormat?: 'paper' | 'ebook' | 'pdf'; totalPages?: number; totalWords?: number; progressPct?: number; progressPercent?: number; finishedAt?: string }) =>
    http<Book>('/api/books', { method: 'POST', body: JSON.stringify(data) }),
  updateBook: (id: number, data: Partial<{ title: string; author: string; status: BookStatus; kind: 'paper' | 'ebook'; bookFormat: 'paper' | 'ebook' | 'pdf'; rating: number; totalPages: number; currentPage: number; totalWords: number; progressPct: number; progressPercent: number; pdfPages: number; note: string; finishedAt: string | null }>) =>
    http<Book>(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBook: (id: number) => http<{ ok: boolean }>(`/api/books/${id}`, { method: 'DELETE' }),
  uploadPdf: async (id: number, file: File): Promise<Book> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/books/${id}/pdf`, { method: 'POST', body: fd, credentials: 'same-origin' })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text.includes('only_pdf') ? '只能上传 PDF 文件' : '上传失败，文件过大或网络异常')
    }
    return res.json()
  },
  deletePdf: (id: number) => http<{ ok: boolean }>(`/api/books/${id}/pdf`, { method: 'DELETE' }),
  listReadingEntries: (bookId: number) => http<ReadingEntry[]>(`/api/books/${bookId}/entries`),
  uploadBookPdf: async (file: File, meta: { title: string; author?: string }): Promise<Book> => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', meta.title)
    if (meta.author) fd.append('author', meta.author)
    const res = await fetch('/api/books/pdf', { method: 'POST', body: fd, credentials: 'same-origin' })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text.includes('only_pdf') ? '只能上传 PDF 文件' : '上传失败，文件过大或网络异常')
    }
    return res.json()
  },
  pdfUrl: (id: number) => `/api/books/${id}/pdf`,
  bookPdfUrl: (id: number) => `/api/books/${id}/pdf`,

  // 健身
  listExercises: () => http<Exercise[]>('/api/exercises'),
  createExercise: (name: string) => http<Exercise>('/api/exercises', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteExercise: (id: number) => http<{ ok: boolean }>(`/api/exercises/${id}`, { method: 'DELETE' }),
  listWorkouts: (date: string) => http<Workout[]>(`/api/workouts?date=${date}`),
  createWorkout: (data: Record<string, unknown>) =>
    http<Workout>('/api/workouts', { method: 'POST', body: JSON.stringify(data) }),
  deleteWorkout: (id: number) => http<{ ok: boolean }>(`/api/workouts/${id}`, { method: 'DELETE' }),

  // 认证
  login: (username: string, password: string) =>
    http<{ ok: boolean; username: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string, inviteCode: string) =>
    http<{ ok: boolean; username: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, inviteCode }) }),
  checkAuth: () => http<{ authed: boolean; username: string | null }>('/api/auth/check'),
  logout: () => http<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  changePassword: (current: string, next: string) =>
    http<{ ok: boolean }>('/api/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) }),
  changeUsername: (username: string) =>
    http<{ ok: boolean; username: string }>('/api/auth/username', { method: 'POST', body: JSON.stringify({ username }) }),
  getPersona: () =>
    http<{ persona: string; defaultPersona: string }>('/api/settings/persona'),
  savePersona: (persona: string) =>
    http<{ ok: boolean }>('/api/settings/persona', { method: 'PATCH', body: JSON.stringify({ persona }) }),
  createInvite: () => http<{ code: string; expiresAt: string }>('/api/invites', { method: 'POST' }),
  listInvites: () => http<{ code: string; expiresAt: string; usedNames: string[]; remaining: number; createdAt: string }[]>('/api/invites'),

  // AI 总结与对话
  generateSummary: (date?: string) =>
    http<{ date: string; content: string }>('/api/ai/summary', { method: 'POST', body: JSON.stringify(date ? { date } : {}) }),
  listSummaries: () => http<{ date: string; content: string; created_at: string }[]>('/api/ai/summaries'),
  aiChat: (message: string) => http<{ reply: string }>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  aiChatHistory: () => http<{ role: 'user' | 'assistant'; content: string; created_at: string }[]>('/api/ai/chat/history'),
  clearAiChat: () => http<{ ok: boolean }>('/api/ai/chat/history', { method: 'DELETE' }),
}
