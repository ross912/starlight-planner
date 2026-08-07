// 星光手帐 后端服务
// Express + Node 内置 SQLite（node:sqlite，无需任何原生依赖）
// 本地开发与阿里云部署使用同一套代码：
//   - 开发：node server/index.js（PORT=8787），Vite 代理 /api
//   - 生产：npm run build 后 node server/index.js（PORT=8080），直接托管 dist/ 静态文件 + API

import express from 'express'
import cron from 'node-cron'
import multer from 'multer'
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(path.join(dataDir, 'warm-planner.db'))
db.exec(`
CREATE TABLE IF NOT EXISTS diaries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL UNIQUE,
  content    TEXT NOT NULL DEFAULT '',
  mood       TEXT NOT NULL DEFAULT '',
  weather    TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  level      TEXT NOT NULL,              -- daily / weekly / monthly / yearly / lifetime
  period     TEXT NOT NULL,              -- 2026-08-04 / 2026-W32 / 2026-08 / 2026 / all
  title      TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  parent_id  INTEGER,                    -- 关联的上层计划（逻辑关联、内容独立）
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_todos_level_period ON todos(level, period);
CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_diaries_date ON diaries(date);
CREATE TABLE IF NOT EXISTS transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,              -- expense / income
  amount     INTEGER NOT NULL,           -- 金额，单位：分
  category   TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  date       TEXT NOT NULL,              -- yyyy-MM-dd
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
CREATE TABLE IF NOT EXISTS books (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  author       TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'want',  -- want 想读 / reading 在读 / done 已读
  rating       INTEGER NOT NULL DEFAULT 0,    -- 0-5 星
  total_pages  INTEGER NOT NULL DEFAULT 0,
  current_page INTEGER NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',      -- 读后感 / 摘抄
  finished_at  TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exercises (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,       -- 力量项目名称（预设 + 用户自增）
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workouts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL,            -- yyyy-MM-dd，健身记录按天归属
  type         TEXT NOT NULL,            -- strength / run / badminton
  exercise     TEXT,                     -- 力量：项目名称
  weight_kg    REAL,                     -- 力量：重量（0 = 自重）
  sets         INTEGER,                  -- 力量：组数
  duration_min INTEGER,                  -- 跑步/羽毛球：时长（分钟）
  distance_km  REAL,                     -- 跑步：公里数
  weather      TEXT,                     -- 跑步：天气
  match_type   TEXT,                     -- 羽毛球：ms 男单 / md 男双 / xd 混双
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
`)

// 为现有数据库补充列（幂等）
try {
  db.exec('ALTER TABLE users ADD COLUMN ai_persona TEXT')  // 自定义 AI 系统提示词
} catch { /* column already exists */ }

// workouts 表迁移：补充 reps（每组个数）字段
if (!db.prepare('PRAGMA table_info(workouts)').all().some((c) => c.name === 'reps')) {
  db.exec('ALTER TABLE workouts ADD COLUMN reps INTEGER')
}

const LEVELS = new Set(['daily', 'weekly', 'monthly', 'yearly', 'lifetime'])
const now = () => new Date().toISOString()
const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ISO 周计算（与前端 period.ts 同算法）
function isoWeekInfo(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3) // 本周周四
  const isoYear = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const isoWeek = Math.floor((d - week1Monday) / 6048e5) + 1
  return { year: isoYear, week: isoWeek }
}

// 各层级当前周期：本日 / 本周 / 本月 / 今年 / 长期
function currentPeriodOf(level) {
  const d = new Date()
  switch (level) {
    case 'daily': return fmtDate(d)
    case 'weekly': {
      const { year, week } = isoWeekInfo(d)
      return `${year}-W${String(week).padStart(2, '0')}`
    }
    case 'monthly': return fmtDate(d).slice(0, 7)
    case 'yearly': return fmtDate(d).slice(0, 4)
    case 'lifetime': return 'all'
  }
}

// ---------------- 多用户体系：建表 + 迁移 ----------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'scrypt',  -- scrypt；sha256 为旧单密码迁移过渡
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  created_by INTEGER NOT NULL,
  used_by INTEGER,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, date)
);
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,               -- user / assistant
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id, id);
`)

const tableCols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name)

// 邀请码迁移：单次使用 → 最多 10 人使用
const INVITE_MAX_USES = 10
if (!tableCols('invites').includes('used_count')) {
  db.exec(`ALTER TABLE invites ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0`)
  db.exec(`ALTER TABLE invites ADD COLUMN used_names TEXT NOT NULL DEFAULT '[]'`)
  db.exec(`UPDATE invites SET used_count = 1, used_names = (SELECT json_array(username) FROM users WHERE users.id = invites.used_by) WHERE used_by IS NOT NULL`)
}

// 书籍迁移：支持纸质书（页数）/ 电子书（字数 + 百分比进度 + PDF 附件）
for (const [col, ddl] of [
  ['kind', "ALTER TABLE books ADD COLUMN kind TEXT NOT NULL DEFAULT 'paper'"],
  ['total_words', 'ALTER TABLE books ADD COLUMN total_words INTEGER NOT NULL DEFAULT 0'],
  ['progress_pct', 'ALTER TABLE books ADD COLUMN progress_pct REAL NOT NULL DEFAULT 0'],
  ['pdf_path', 'ALTER TABLE books ADD COLUMN pdf_path TEXT'],
  ['pdf_pages', 'ALTER TABLE books ADD COLUMN pdf_pages INTEGER NOT NULL DEFAULT 0'],
  ['pdf_name', "ALTER TABLE books ADD COLUMN pdf_name TEXT NOT NULL DEFAULT ''"],
]) {
  if (!tableCols('books').includes(col)) db.exec(ddl)
}

// 阅读进度记录表：每次更新阅读进度时记录
db.exec(`
CREATE TABLE IF NOT EXISTS reading_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id         INTEGER NOT NULL,
  user_id         INTEGER NOT NULL,
  date            TEXT NOT NULL,
  current_page    INTEGER NOT NULL DEFAULT 0,
  progress_percent  REAL NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reading_entries_book ON reading_entries(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_entries_user ON reading_entries(user_id, date);
`)

// 业务表补充 user_id（用户数据隔离）
for (const t of ['todos', 'transactions', 'books', 'workouts', 'sessions']) {
  if (!tableCols(t).includes('user_id')) db.exec(`ALTER TABLE ${t} ADD COLUMN user_id INTEGER`)
}
// diaries：唯一键 date → (user_id, date)，需重建表
if (!tableCols('diaries').includes('user_id')) {
  db.exec(`
    CREATE TABLE diaries_m (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      mood TEXT NOT NULL DEFAULT '',
      weather TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, date)
    );
    INSERT INTO diaries_m (id, user_id, date, content, mood, weather, tags, created_at, updated_at)
      SELECT id, NULL, date, content, mood, weather, tags, created_at, updated_at FROM diaries;
    DROP TABLE diaries;
    ALTER TABLE diaries_m RENAME TO diaries;
    CREATE INDEX IF NOT EXISTS idx_diaries_user_date ON diaries(user_id, date);
  `)
}
// exercises：唯一键 name → (user_id, name)，需重建表
if (!tableCols('exercises').includes('user_id')) {
  db.exec(`
    CREATE TABLE exercises_m (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, name)
    );
    INSERT INTO exercises_m (id, user_id, name, created_at)
      SELECT id, NULL, name, created_at FROM exercises;
    DROP TABLE exercises;
    ALTER TABLE exercises_m RENAME TO exercises;
  `)
}

// 力量训练预设项目（每个用户一份，注册时写入）
const PRESET_EXERCISES = ['卧推', '深蹲', '哑铃飞鸟', '上斜卧推', '高位下拉', '引体向上', '站姿推肩', '坐姿推肩', '蝴蝶机反向飞鸟', '哑铃反向飞鸟']
function seedExercisesFor(userId) {
  const t0 = now()
  for (const name of PRESET_EXERCISES) {
    db.prepare('INSERT OR IGNORE INTO exercises (user_id, name, created_at) VALUES (?, ?, ?)').run(userId, name, t0)
  }
}

// 密码哈希：新用户 scrypt；sha256 仅用于从单密码时代迁移的所有者账号
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
const hashScrypt = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex')

// 所有者引导：users 为空时创建首个账号；存在旧 auth.json 则继承其密码（用户无感迁移）
const AUTH_FILE = path.join(dataDir, 'auth.json')
if ((db.prepare('SELECT COUNT(*) AS c FROM users').get()).c === 0) {
  const ownerName = process.env.ADMIN_USER || 'admin'
  let salt, hash, algo
  try {
    const legacy = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
    salt = legacy.salt
    hash = legacy.hash
    algo = 'sha256'
    console.log(`[星光手帐] 多用户迁移：已将现有数据归属到账号「${ownerName}」，密码沿用你当前使用的密码`)
  } catch {
    salt = crypto.randomBytes(16).toString('hex')
    hash = hashScrypt('starlight2026', salt)
    algo = 'scrypt'
    console.log(`[星光手帐] 已创建初始账号「${ownerName}」，默认密码 starlight2026，请登录后立即修改`)
  }
  const uid = Number(db.prepare('INSERT INTO users (username, password_hash, password_algo, salt, created_at) VALUES (?,?,?,?,?)')
    .run(ownerName, hash, algo, salt, now()).lastInsertRowid)
  for (const t of ['diaries', 'todos', 'transactions', 'books', 'exercises', 'workouts', 'sessions']) {
    db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id IS NULL`).run(uid)
  }
}

function rowToDiary(r) {
  let tags = []
  try { tags = JSON.parse(r.tags || '[]') } catch { tags = [] }
  return { id: r.id, date: r.date, content: r.content, mood: r.mood, weather: r.weather, tags, createdAt: r.created_at, updatedAt: r.updated_at }
}

function rowToTodo(r, extras = {}) {
  const status = r.done === 2 ? 'failed' : r.done ? 'done' : 'pending'
  return {
    id: r.id, level: r.level, period: r.period, title: r.title, note: r.note,
    done: r.done === 1, status,
    parentId: r.parent_id ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at, ...extras,
  }
}

const app = express()
app.use(express.json({ limit: '2mb' }))

// ---------------- 账号认证（多用户） ----------------

const COOKIE_NAME = 'sl_token'
const SESSION_DAYS = 30

function verifyUser(user, pw) {
  if (user.password_algo === 'sha256') {
    // 迁移过渡期：兼容旧单密码哈希
    return sha256(user.salt + String(pw ?? '')) === user.password_hash
  }
  const h = crypto.scryptSync(String(pw ?? ''), user.salt, 64)
  const expect = Buffer.from(user.password_hash, 'hex')
  return h.length === expect.length && crypto.timingSafeEqual(h, expect)
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, now())
  // 顺手清理过期会话
  db.prepare('DELETE FROM sessions WHERE created_at < ?').run(new Date(Date.now() - SESSION_DAYS * 864e5).toISOString())
  return token
}

function cookieToken(req) {
  const raw = req.headers.cookie || ''
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([a-f0-9]+)`))
  return m ? m[1] : null
}

function sessionUser(req) {
  const token = cookieToken(req)
  if (!token) return null
  return db.prepare(`SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.created_at > ?`)
    .get(token, new Date(Date.now() - SESSION_DAYS * 864e5).toISOString())
}

// 登录限流：同一 IP 连续失败 5 次锁定 5 分钟
const loginAttempts = new Map()
function loginLocked(ip) {
  const rec = loginAttempts.get(ip)
  return rec && rec.until > Date.now()
}

// 认证中间件：/api/auth/* 公开，其余 /api/* 均需登录；通过后注入 req.userId
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next()
  const u = sessionUser(req)
  if (!u) return res.status(401).json({ error: 'auth_required' })
  req.userId = u.id
  next()
})

const USERNAME_RE = /^[\w一-龥-]{2,20}$/

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'unknown'
  if (loginLocked(ip)) return res.status(429).json({ error: 'too_many_attempts' })
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(req.body?.username ?? '').trim())
  if (!user || !verifyUser(user, req.body?.password)) {
    const rec = loginAttempts.get(ip) || { count: 0, until: 0 }
    rec.count += 1
    if (rec.count >= 5) { rec.until = Date.now() + 5 * 60e3; rec.count = 0 }
    loginAttempts.set(ip, rec)
    return res.status(401).json({ error: 'wrong_credentials' })
  }
  loginAttempts.delete(ip)
  const token = createSession(user.id)
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DAYS * 86400}; SameSite=Lax`)
  res.json({ ok: true, username: user.username })
})

// 邀请码注册：只有拿到邀请码的人才能创建账号
app.post('/api/auth/register', (req, res) => {
  const { username, password, inviteCode } = req.body || {}
  const name = String(username ?? '').trim()
  if (!USERNAME_RE.test(name)) return res.status(400).json({ error: 'invalid_username' })
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'password_too_short' })
  const code = String(inviteCode ?? '').trim().toLowerCase()
  const inv = db.prepare('SELECT * FROM invites WHERE code = ?').get(code)
  if (!inv || (inv.used_count ?? 0) >= INVITE_MAX_USES || inv.expires_at < now()) return res.status(400).json({ error: 'invalid_invite' })
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(name)) return res.status(409).json({ error: 'username_taken' })
  const salt = crypto.randomBytes(16).toString('hex')
  const uid = Number(db.prepare('INSERT INTO users (username, password_hash, password_algo, salt, created_at) VALUES (?,?,?,?,?)')
    .run(name, hashScrypt(password, salt), 'scrypt', salt, now()).lastInsertRowid)
  db.prepare("UPDATE invites SET used_by = ?, used_count = used_count + 1, used_names = json_insert(used_names, '$[#]', ?) WHERE code = ?").run(uid, name, code)
  seedExercisesFor(uid)
  const token = createSession(uid)
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DAYS * 86400}; SameSite=Lax`)
  res.status(201).json({ ok: true, username: name })
})

app.get('/api/auth/check', (req, res) => {
  const u = sessionUser(req)
  res.json({ authed: !!u, username: u?.username ?? null })
})

app.post('/api/auth/logout', (req, res) => {
  const token = cookieToken(req)
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0`)
  res.json({ ok: true })
})

app.post('/api/auth/password', (req, res) => {
  const u = sessionUser(req)
  if (!u) return res.status(401).json({ error: 'auth_required' })
  const { current, next } = req.body || {}
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(u.id)
  if (!verifyUser(user, current)) return res.status(401).json({ error: 'wrong_password' })
  if (!next || String(next).length < 6) return res.status(400).json({ error: 'password_too_short' })
  const salt = crypto.randomBytes(16).toString('hex')
  db.prepare("UPDATE users SET password_hash = ?, password_algo = 'scrypt', salt = ? WHERE id = ?")
    .run(hashScrypt(next, salt), salt, u.id)
  // 改密后仅保留当前会话
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').run(u.id, cookieToken(req) || '')
  res.json({ ok: true })
})

// 修改用户名
app.post('/api/auth/username', (req, res) => {
  const u = sessionUser(req)
  if (!u) return res.status(401).json({ error: 'auth_required' })
  const name = String(req.body?.username ?? '').trim()
  if (!USERNAME_RE.test(name)) return res.status(400).json({ error: 'invalid_username' })
  if (name === u.username) return res.json({ ok: true, username: name })
  if (db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(name, u.id)) {
    return res.status(409).json({ error: 'username_taken' })
  }
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(name, u.id)
  res.json({ ok: true, username: name })
})

// 邀请码：登录用户生成，发给朋友注册用（一次性，30 天有效）
app.post('/api/invites', (req, res) => {
  const code = crypto.randomBytes(4).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 864e5).toISOString()
  db.prepare('INSERT INTO invites (code, created_by, expires_at, created_at) VALUES (?,?,?,?)').run(code, req.userId, expiresAt, now())
  res.status(201).json({ code, expiresAt })
})

app.get('/api/invites', (req, res) => {
  const rows = db.prepare('SELECT code, expires_at, used_count, used_names, created_at FROM invites WHERE created_by = ? ORDER BY created_at DESC').all(req.userId)
  res.json(rows.map((r) => {
    let usedNames = []
    try { usedNames = JSON.parse(r.used_names || '[]') } catch { usedNames = [] }
    return {
      code: r.code,
      expiresAt: r.expires_at,
      usedNames,
      remaining: Math.max(0, INVITE_MAX_USES - (r.used_count || 0)),
      createdAt: r.created_at,
    }
  }))
})

// ---------------- 日记 ----------------

// 列表：?q= 全文搜索（标题内容/标签） ?month=2026-08
app.get('/api/diaries', (req, res) => {
  const { q, month } = req.query
  const uid = req.userId
  let rows
  if (q && String(q).trim()) {
    const kw = `%${String(q).trim()}%`
    rows = db.prepare('SELECT * FROM diaries WHERE user_id = ? AND (content LIKE ? OR tags LIKE ?) ORDER BY date DESC').all(uid, kw, kw)
  } else if (month) {
    rows = db.prepare('SELECT * FROM diaries WHERE user_id = ? AND date LIKE ? ORDER BY date DESC').all(uid, `${month}-%`)
  } else {
    rows = db.prepare('SELECT * FROM diaries WHERE user_id = ? ORDER BY date DESC LIMIT 200').all(uid)
  }
  res.json(rows.map((r) => {
    const d = rowToDiary(r)
    return { ...d, snippet: d.content.replace(/\n/g, ' ').slice(0, 60) }
  }))
})

// 单篇
app.get('/api/diaries/:date', (req, res) => {
  const r = db.prepare('SELECT * FROM diaries WHERE user_id = ? AND date = ?').get(req.userId, req.params.date)
  if (!r) return res.status(404).json({ error: 'not_found' })
  res.json(rowToDiary(r))
})

// 创建 / 更新（按日期 upsert，当前用户范围内）
app.put('/api/diaries/:date', (req, res) => {
  const date = req.params.date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'invalid_date' })
  const { content = '', mood = '', weather = '', tags = [] } = req.body || {}
  const cleanTags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10) : []
  const t = now()
  const uid = req.userId
  const existing = db.prepare('SELECT id FROM diaries WHERE user_id = ? AND date = ?').get(uid, date)
  if (existing) {
    db.prepare('UPDATE diaries SET content=?, mood=?, weather=?, tags=?, updated_at=? WHERE user_id=? AND date=?')
      .run(String(content), String(mood), String(weather), JSON.stringify(cleanTags), t, uid, date)
  } else {
    db.prepare('INSERT INTO diaries (user_id, date, content, mood, weather, tags, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(uid, date, String(content), String(mood), String(weather), JSON.stringify(cleanTags), t, t)
  }
  const r = db.prepare('SELECT * FROM diaries WHERE user_id = ? AND date = ?').get(uid, date)
  res.json(rowToDiary(r))
})

app.delete('/api/diaries/:date', (req, res) => {
  const info = db.prepare('DELETE FROM diaries WHERE user_id = ? AND date = ?').run(req.userId, req.params.date)
  res.json({ ok: true, deleted: info.changes })
})

// ---------------- 计划（Todo） ----------------

function attachExtras(rows, uid) {
  const aggs = db.prepare('SELECT parent_id, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done FROM todos WHERE user_id = ? AND parent_id IS NOT NULL GROUP BY parent_id').all(uid)
  const aggMap = new Map(aggs.map((a) => [a.parent_id, a]))
  const parentIds = [...new Set(rows.map((r) => r.parent_id).filter(Boolean))]
  const titleMap = new Map()
  for (const pid of parentIds) {
    const p = db.prepare('SELECT id, title, level, period FROM todos WHERE id = ? AND user_id = ?').get(pid, uid)
    if (p) titleMap.set(pid, p)
  }
  return rows.map((r) => {
    const agg = aggMap.get(r.id)
    const parent = r.parent_id ? titleMap.get(r.parent_id) : null
    return rowToTodo(r, {
      parentTitle: parent ? parent.title : null,
      parentLevel: parent ? parent.level : null,
      childrenTotal: agg ? agg.total : 0,
      childrenDone: agg ? (agg.done || 0) : 0,
    })
  })
}

app.get('/api/todos', (req, res) => {
  const { level, period } = req.query
  const uid = req.userId
  let rows
  if (level && period) {
    rows = db.prepare('SELECT * FROM todos WHERE user_id = ? AND level = ? AND period = ? ORDER BY done ASC, id ASC').all(uid, String(level), String(period))
  } else if (level) {
    rows = db.prepare('SELECT * FROM todos WHERE user_id = ? AND level = ? ORDER BY period DESC, done ASC, id ASC').all(uid, String(level))
  } else {
    rows = db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY id ASC').all(uid)
  }
  res.json(attachExtras(rows, uid))
})

app.post('/api/todos', (req, res) => {
  const { level, period, title, note = '', parentId = null } = req.body || {}
  if (!LEVELS.has(level)) return res.status(400).json({ error: 'invalid_level' })
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title_required' })
  const t = now()
  const info = db.prepare('INSERT INTO todos (user_id, level, period, title, note, done, parent_id, created_at, updated_at) VALUES (?,?,?,?,?,0,?,?,?)')
    .run(req.userId, String(level), String(period || ''), String(title).trim(), String(note), parentId ? Number(parentId) : null, t, t)
  const rows = db.prepare('SELECT * FROM todos WHERE id = ?').all(Number(info.lastInsertRowid))
  res.status(201).json(attachExtras(rows, req.userId)[0])
})

app.patch('/api/todos/:id', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!row) return res.status(404).json({ error: 'not_found' })
  const { title, note, done, status, parentId } = req.body || {}
  const newTitle = title !== undefined ? String(title).trim() : row.title
  if (!newTitle) return res.status(400).json({ error: 'title_required' })
  const newParent = parentId !== undefined ? (parentId ? Number(parentId) : null) : row.parent_id
  if (newParent === id) return res.status(400).json({ error: 'invalid_parent' })
  if (newParent && !db.prepare('SELECT id FROM todos WHERE id = ? AND user_id = ?').get(newParent, req.userId)) {
    return res.status(400).json({ error: 'invalid_parent' })
  }
  // done 列三态存储：0 待办 / 1 完成✅ / 2 未完成❌
  let newDone = row.done
  if (status !== undefined) {
    if (!['pending', 'done', 'failed'].includes(status)) return res.status(400).json({ error: 'invalid_status' })
    newDone = status === 'done' ? 1 : status === 'failed' ? 2 : 0
  } else if (done !== undefined) {
    newDone = done ? 1 : 0
  }
  db.prepare('UPDATE todos SET title=?, note=?, done=?, parent_id=?, updated_at=? WHERE id=? AND user_id=?')
    .run(newTitle, note !== undefined ? String(note) : row.note, newDone, newParent, now(), id, req.userId)
  res.json(attachExtras(db.prepare('SELECT * FROM todos WHERE id = ?').all(id), req.userId)[0])
})

app.delete('/api/todos/:id', (req, res) => {
  const id = Number(req.params.id)
  // 子项脱离关联，不级联删除（内容独立存在）
  db.prepare('UPDATE todos SET parent_id = NULL WHERE parent_id = ? AND user_id = ?').run(id, req.userId)
  const info = db.prepare('DELETE FROM todos WHERE id = ? AND user_id = ?').run(id, req.userId)
  res.json({ ok: true, deleted: info.changes })
})

// ---------------- 记账 ----------------

function rowToTx(r) {
  return { id: r.id, type: r.type, amount: r.amount, category: r.category, note: r.note, date: r.date, createdAt: r.created_at, updatedAt: r.updated_at }
}

function validTx(body) {
  const { type, amount, category, date } = body || {}
  if (!['expense', 'income'].includes(type)) return 'invalid_type'
  const fen = Math.round(Number(amount) * 100)
  if (!Number.isFinite(fen) || fen <= 0 || fen > 100000000000) return 'invalid_amount'
  if (!category || !String(category).trim()) return 'category_required'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return 'invalid_date'
  return { fen }
}

app.get('/api/transactions', (req, res) => {
  const { month } = req.query
  const uid = req.userId
  const rows = month
    ? db.prepare('SELECT * FROM transactions WHERE user_id = ? AND date LIKE ? ORDER BY date DESC, id DESC').all(uid, `${month}-%`)
    : db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 300').all(uid)
  res.json(rows.map(rowToTx))
})

app.post('/api/transactions', (req, res) => {
  const v = validTx(req.body)
  if (typeof v === 'string') return res.status(400).json({ error: v })
  const { type, category, note = '', date } = req.body
  const t = now()
  const info = db.prepare('INSERT INTO transactions (user_id, type, amount, category, note, date, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.userId, type, v.fen, String(category).trim(), String(note).slice(0, 200), String(date), t, t)
  res.status(201).json(rowToTx(db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(info.lastInsertRowid))))
})

app.patch('/api/transactions/:id', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!row) return res.status(404).json({ error: 'not_found' })
  const merged = { type: row.type, amount: row.amount / 100, category: row.category, note: row.note, date: row.date, ...req.body }
  const v = validTx(merged)
  if (typeof v === 'string') return res.status(400).json({ error: v })
  db.prepare('UPDATE transactions SET type=?, amount=?, category=?, note=?, date=?, updated_at=? WHERE id=? AND user_id=?')
    .run(merged.type, v.fen, String(merged.category).trim(), String(merged.note ?? '').slice(0, 200), String(merged.date), now(), id, req.userId)
  res.json(rowToTx(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)))
})

app.delete('/api/transactions/:id', (req, res) => {
  const info = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true, deleted: info.changes })
})

// 月度汇总：收支合计、分类占比、每日趋势
app.get('/api/transactions/stats', (req, res) => {
  const month = req.query.month || fmtDate(new Date()).slice(0, 7)
  const like = `${month}-%`
  const uid = req.userId
  const sum = (type) =>
    db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id = ? AND type = ? AND date LIKE ?').get(uid, type, like).s || 0
  const byCategory = db.prepare(
    "SELECT category, type, SUM(amount) AS total FROM transactions WHERE user_id = ? AND date LIKE ? GROUP BY category, type ORDER BY total DESC",
  ).all(uid, like)
  const daily = db.prepare(
    "SELECT date, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense, SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income FROM transactions WHERE user_id = ? AND date LIKE ? GROUP BY date ORDER BY date",
  ).all(uid, like)
  res.json({ month, expense: sum('expense'), income: sum('income'), byCategory, daily })
})

// ---------------- 阅读 ----------------

const BOOK_STATUS = new Set(['want', 'reading', 'done'])

function rowToBook(r) {
  return {
    id: r.id, title: r.title, author: r.author, status: r.status,
    kind: r.kind || 'paper',
    bookFormat: r.book_format || (r.pdf_path ? 'pdf' : (r.kind || 'paper')),
    rating: r.rating, totalPages: r.total_pages, currentPage: r.current_page,
    totalWords: r.total_words ?? 0, progressPct: r.progress_pct ?? 0,
    progressPercent: r.progress_percent ?? r.progress_pct ?? 0,
    hasPdf: !!r.pdf_path, pdfPages: r.pdf_pages ?? 0, pdfName: r.pdf_name ?? '',
    note: r.note, finishedAt: r.finished_at, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

const BOOK_KINDS = new Set(['paper', 'ebook'])
const validBookKind = (k) => (BOOK_KINDS.has(k) ? k : null)
const clampPct = (v) => Math.min(100, Math.max(0, Math.round(Number(v) * 10) / 10 || 0))

app.get('/api/books', (req, res) => {
  const { status } = req.query
  const uid = req.userId
  const rows = status && BOOK_STATUS.has(String(status))
    ? db.prepare('SELECT * FROM books WHERE user_id = ? AND status = ? ORDER BY updated_at DESC, id DESC').all(uid, String(status))
    : db.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(uid)
  res.json(rows.map(rowToBook))
})

app.post('/api/books', (req, res) => {
  const { title, author = '', status = 'want', totalPages = 0, finishedAt, kind, bookFormat, totalWords = 0, progressPct, progressPercent } = req.body || {}
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title_required' })
  if (!BOOK_STATUS.has(status)) return res.status(400).json({ error: 'invalid_status' })
  const bf = bookFormat !== undefined ? String(bookFormat) : null
  if (bf !== null && !['paper', 'ebook', 'pdf'].includes(bf)) return res.status(400).json({ error: 'invalid_kind' })
  const k = validBookKind(kind ?? (bf === 'ebook' ? 'ebook' : 'paper'))
  if (!k) return res.status(400).json({ error: 'invalid_kind' })
  const bookFmt = bf || (k === 'ebook' ? 'ebook' : 'paper')
  const pct = progressPercent !== undefined ? clampPct(progressPercent) : clampPct(progressPct ?? 0)
  if (finishedAt !== undefined && finishedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(finishedAt))) {
    return res.status(400).json({ error: 'invalid_date' })
  }
  const t = now()
  const pages = Math.max(0, Math.round(Number(totalPages) || 0))
  const done = status === 'done'
  const info = db.prepare('INSERT INTO books (user_id, title, author, status, kind, book_format, total_pages, current_page, total_words, progress_pct, progress_percent, finished_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.userId, String(title).trim(), String(author).trim(), status, k, bookFmt, pages, done && k !== 'ebook' ? pages : 0,
      Math.max(0, Math.round(Number(totalWords) || 0)), done && k === 'ebook' ? 100 : pct,
      done && k === 'ebook' ? 100 : pct,
      done ? (finishedAt || t) : null, t, t)
  res.status(201).json(rowToBook(db.prepare('SELECT * FROM books WHERE id = ?').get(Number(info.lastInsertRowid))))
})

app.patch('/api/books/:id', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM books WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!row) return res.status(404).json({ error: 'not_found' })
  const b = { ...req.body }
  const title = b.title !== undefined ? String(b.title).trim() : row.title
  if (!title) return res.status(400).json({ error: 'title_required' })
  const status = b.status !== undefined ? String(b.status) : row.status
  if (!BOOK_STATUS.has(status)) return res.status(400).json({ error: 'invalid_status' })
  const totalPages = b.totalPages !== undefined ? Math.max(0, Math.round(Number(b.totalPages) || 0)) : row.total_pages
  const currentPage = b.currentPage !== undefined
    ? Math.min(Math.max(0, Math.round(Number(b.currentPage) || 0)), totalPages || Number.MAX_SAFE_INTEGER)
    : row.current_page
  const rating = b.rating !== undefined ? Math.min(5, Math.max(0, Math.round(Number(b.rating) || 0))) : row.rating
  // 类型与电子书字段（兼容新旧字段名：bookFormat 优先）
  let kind = b.kind !== undefined ? validBookKind(b.kind) : row.kind
  if (kind === null) return res.status(400).json({ error: 'invalid_kind' })
  let bookFmt = row.book_format || row.kind || 'paper'
  if (b.bookFormat !== undefined) {
    if (!['paper', 'ebook', 'pdf'].includes(String(b.bookFormat))) return res.status(400).json({ error: 'invalid_kind' })
    bookFmt = String(b.bookFormat)
    kind = bookFmt === 'ebook' ? 'ebook' : 'paper'
  }
  const totalWords = b.totalWords !== undefined ? Math.max(0, Math.round(Number(b.totalWords) || 0)) : row.total_words
  const pdfPages = b.pdfPages !== undefined ? Math.max(0, Math.round(Number(b.pdfPages) || 0)) : row.pdf_pages
  let progressPct = b.progressPercent !== undefined ? clampPct(b.progressPercent)
    : b.progressPct !== undefined ? clampPct(b.progressPct) : (row.progress_percent ?? row.progress_pct)
  // 完成日期：可自选（默认保留原值或当天）；状态变为已读时页数/百分比自动补满
  if (b.finishedAt !== undefined && b.finishedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.finishedAt))) {
    return res.status(400).json({ error: 'invalid_date' })
  }
  const finishedAt = status === 'done' ? (b.finishedAt || row.finished_at || now()) : null
  const finalPage = status === 'done' && totalPages > 0 ? totalPages : currentPage
  if (status === 'done' && kind === 'ebook') progressPct = 100
  db.prepare('UPDATE books SET title=?, author=?, status=?, rating=?, total_pages=?, current_page=?, note=?, finished_at=?, kind=?, book_format=?, total_words=?, progress_pct=?, progress_percent=?, pdf_pages=?, updated_at=? WHERE id=?')
    .run(
      title,
      b.author !== undefined ? String(b.author).trim() : row.author,
      status, rating, totalPages, finalPage,
      b.note !== undefined ? String(b.note).slice(0, 5000) : row.note,
      finishedAt, kind, bookFmt, totalWords, progressPct, progressPct, pdfPages, now(), id,
    )

  // 记录本次阅读进度变化
  const oldPage = Number(row.current_page || 0)
  const oldPct = Number(row.progress_pct || 0)
  if (finalPage !== oldPage || progressPct !== oldPct) {
    const pNow = now()
    db.prepare('INSERT INTO reading_entries (book_id, user_id, date, current_page, progress_percent, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, req.userId, pNow.slice(0, 10), finalPage, progressPct, pNow)
  }

  res.json(rowToBook(db.prepare('SELECT * FROM books WHERE id = ?').get(id)))
})

// 查询一本书的阅读进度记录
app.get('/api/books/:id/entries', (req, res) => {
  const id = Number(req.params.id)
  const book = db.prepare('SELECT id FROM books WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!book) return res.status(404).json({ error: 'not_found' })
  const rows = db.prepare(
    'SELECT id, date, current_page, progress_percent, created_at FROM reading_entries WHERE book_id = ? AND user_id = ? ORDER BY date DESC, created_at DESC'
  ).all(id, req.userId)
  res.json(rows.map(r => ({
    id: r.id,
    date: r.date,
    currentPage: r.current_page,
    progressPercent: Number(r.progress_percent || 0),
    createdAt: r.created_at,
  })))
})

app.delete('/api/books/:id', (req, res) => {
  const row = db.prepare('SELECT pdf_path FROM books WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.userId)
  if (row?.pdf_path) fs.unlink(row.pdf_path, () => {})
  const info = db.prepare('DELETE FROM books WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true, deleted: info.changes })
})

// ---------------- 电子书 PDF（上传后在应用内阅读） ----------------
const filesDir = path.join(dataDir, 'files')
fs.mkdirSync(filesDir, { recursive: true })

const pdfUpload = multer({
  storage: multer.diskStorage({
    destination: filesDir,
    filename: (req, file, cb) => cb(null, `${req.userId}_${req.params.id}.pdf`),
  }),
  limits: { fileSize: 120 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')
    cb(ok ? null : new Error('only_pdf'), ok)
  },
})

// 上传 PDF 直接创建书籍
const pdfNewUpload = multer({
  storage: multer.diskStorage({
    destination: filesDir,
    filename: (req, file, cb) => cb(null, `${req.userId}_new_${Date.now()}.pdf`),
  }),
  limits: { fileSize: 120 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')
    cb(ok ? null : new Error('only_pdf'), ok)
  },
})

app.post('/api/books/pdf', (req, res) => {
  pdfNewUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message === 'only_pdf' ? 'only_pdf' : 'upload_failed' })
    if (!req.file) return res.status(400).json({ error: 'file_required' })
    const title = String(req.body?.title || req.file.originalname.replace(/\.pdf$/i, '')).trim().slice(0, 200) || '未命名 PDF'
    const author = String(req.body?.author || '').trim().slice(0, 100)
    const t = now()
    const info = db.prepare('INSERT INTO books (user_id, title, author, status, kind, book_format, total_pages, current_page, total_words, progress_pct, progress_percent, finished_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.userId, title, author, 'reading', 'ebook', 'pdf', 0, 0, 0, 0, 0, null, t, t)
    const id = Number(info.lastInsertRowid)
    const finalPath = path.join(filesDir, `${req.userId}_${id}.pdf`)
    fs.renameSync(req.file.path, finalPath)
    db.prepare('UPDATE books SET pdf_path = ?, pdf_name = ?, updated_at = ? WHERE id = ?')
      .run(finalPath, String(req.file.originalname || 'book.pdf').slice(0, 120), now(), id)
    res.json(rowToBook(db.prepare('SELECT * FROM books WHERE id = ?').get(id)))
  })
})

app.post('/api/books/:id/pdf', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM books WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.kind !== 'ebook') return res.status(400).json({ error: 'not_ebook' })
  pdfUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message === 'only_pdf' ? 'only_pdf' : 'upload_failed' })
    if (!req.file) return res.status(400).json({ error: 'file_required' })
    db.prepare('UPDATE books SET pdf_path = ?, pdf_name = ?, updated_at = ? WHERE id = ?')
      .run(req.file.path, String(req.file.originalname || 'book.pdf').slice(0, 120), now(), id)
    res.json(rowToBook(db.prepare('SELECT * FROM books WHERE id = ?').get(id)))
  })
})

app.get('/api/books/:id/pdf', (req, res) => {
  const row = db.prepare('SELECT pdf_path, pdf_name FROM books WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.userId)
  if (!row?.pdf_path || !fs.existsSync(row.pdf_path)) return res.status(404).json({ error: 'not_found' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Cache-Control', 'private, max-age=3600')
  fs.createReadStream(row.pdf_path).pipe(res)
})

app.delete('/api/books/:id/pdf', (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM books WHERE id = ? AND user_id = ?').get(id, req.userId)
  if (!row?.pdf_path) return res.status(404).json({ error: 'not_found' })
  fs.unlink(row.pdf_path, () => {})
  db.prepare("UPDATE books SET pdf_path = NULL, pdf_pages = 0, pdf_name = '', updated_at = ? WHERE id = ?").run(now(), id)
  res.json({ ok: true })
})

// ---------------- 健身 ----------------

const WORKOUT_TYPES = new Set(['strength', 'run', 'badminton'])
const MATCH_TYPES = new Set(['ms', 'md', 'xd'])

function rowToWorkout(r) {
  return {
    id: r.id, date: r.date, type: r.type,
    exercise: r.exercise, weightKg: r.weight_kg, sets: r.sets, reps: r.reps ?? null,
    durationMin: r.duration_min, distanceKm: r.distance_km, weather: r.weather,
    matchType: r.match_type, note: r.note, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

// 力量项目库（预设 + 自增，按用户隔离）
app.get('/api/exercises', (req, res) => {
  res.json(db.prepare('SELECT * FROM exercises WHERE user_id = ? ORDER BY id ASC').all(req.userId).map((r) => ({ id: r.id, name: r.name })))
})
app.post('/api/exercises', (req, res) => {
  const name = String(req.body?.name ?? '').trim()
  if (!name) return res.status(400).json({ error: 'name_required' })
  if (name.length > 20) return res.status(400).json({ error: 'name_too_long' })
  const t = now()
  db.prepare('INSERT OR IGNORE INTO exercises (user_id, name, created_at) VALUES (?, ?, ?)').run(req.userId, name, t)
  const row = db.prepare('SELECT * FROM exercises WHERE user_id = ? AND name = ?').get(req.userId, name)
  res.status(201).json({ id: row.id, name: row.name })
})
app.delete('/api/exercises/:id', (req, res) => {
  const info = db.prepare('DELETE FROM exercises WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true, deleted: info.changes })
})

// 校验并整理一条健身记录
function validWorkout(body) {
  const { type, date } = body || {}
  if (!WORKOUT_TYPES.has(type)) return 'invalid_type'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return 'invalid_date'
  const out = { type, date: String(date), note: String(body.note ?? '').slice(0, 200) }
  if (type === 'strength') {
    const exercise = String(body.exercise ?? '').trim()
    if (!exercise) return 'exercise_required'
    const weight = Number(body.weightKg)
    const sets = Math.round(Number(body.sets))
    const reps = Math.round(Number(body.reps))
    if (!Number.isFinite(weight) || weight < 0 || weight > 500) return 'invalid_weight'
    if (!Number.isFinite(sets) || sets < 1 || sets > 100) return 'invalid_sets'
    if (!Number.isFinite(reps) || reps < 1 || reps > 1000) return 'invalid_reps'
    return { ...out, exercise, weightKg: weight, sets, reps, durationMin: null, distanceKm: null, weather: null, matchType: null }
  }
  if (type === 'run') {
    const dur = Math.round(Number(body.durationMin) || 0)
    const dist = Number(body.distanceKm) || 0
    if (dur < 0 || dur > 1440) return 'invalid_duration'
    if (!Number.isFinite(dist) || dist < 0 || dist > 500) return 'invalid_distance'
    if (dur === 0 && dist === 0) return 'empty_record'
    const weather = String(body.weather ?? '')
    return { ...out, exercise: null, weightKg: null, sets: null, reps: null, durationMin: dur, distanceKm: dist, weather, matchType: null }
  }
  // badminton
  if (!MATCH_TYPES.has(body.matchType)) return 'invalid_match_type'
  const dur2 = Math.round(Number(body.durationMin))
  if (!Number.isFinite(dur2) || dur2 < 1 || dur2 > 1440) return 'invalid_duration'
  return { ...out, exercise: null, weightKg: null, sets: null, reps: null, durationMin: dur2, distanceKm: null, weather: null, matchType: body.matchType }
}

app.get('/api/workouts', (req, res) => {
  const { date } = req.query
  const uid = req.userId
  const rows = date
    ? db.prepare('SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY id ASC').all(uid, String(date))
    : db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 500').all(uid)
  res.json(rows.map(rowToWorkout))
})

app.post('/api/workouts', (req, res) => {
  const v = validWorkout(req.body)
  if (typeof v === 'string') return res.status(400).json({ error: v })
  const t = now()
  const info = db.prepare(`INSERT INTO workouts (user_id, date, type, exercise, weight_kg, sets, reps, duration_min, distance_km, weather, match_type, note, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.userId, v.date, v.type, v.exercise, v.weightKg, v.sets, v.reps, v.durationMin, v.distanceKm, v.weather, v.matchType, v.note, t, t)
  res.status(201).json(rowToWorkout(db.prepare('SELECT * FROM workouts WHERE id = ?').get(Number(info.lastInsertRowid))))
})

app.delete('/api/workouts/:id', (req, res) => {
  const info = db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.userId)
  res.json({ ok: true, deleted: info.changes })
})

// ---------------- AI 总结与对话（DeepSeek） ----------------

// 配置：server/data/config.json（不入库）或环境变量
function aiConfig() {
  const key = process.env.DEEPSEEK_API_KEY
  if (key) return { key, model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash' }
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'), 'utf8'))
    return { key: cfg.deepseekKey, model: cfg.deepseekModel || 'deepseek-v4-flash' }
  } catch {
    return { key: null, model: 'deepseek-v4-flash' }
  }
}

// 把用户的全部手帐数据按时间顺序串成时间线（全量时序上下文）
function buildTimeline(uid) {
  const blocks = new Map() // date -> lines[]
  const push = (date, line) => {
    if (!date) return
    if (!blocks.has(date)) blocks.set(date, [])
    blocks.get(date).push(line)
  }

  for (const r of db.prepare('SELECT * FROM diaries WHERE user_id = ? ORDER BY date').all(uid)) {
    const meta = [r.mood && `心情:${r.mood}`, r.weather && `天气:${r.weather}`].filter(Boolean).join(' ')
    push(r.date, `日记${meta ? `（${meta}）` : ''}：${r.content.replace(/\n+/g, ' ')}`)
  }
  const LEVEL_NAMES = { daily: '日计划', weekly: '周计划', monthly: '月计划', yearly: '年计划', lifetime: '总计划' }
  for (const r of db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY period, id').all(uid)) {
    const st = r.done === 1 ? '✅' : r.done === 2 ? '❌' : '☐'
    push(r.level === 'daily' ? r.period : null, `${LEVEL_NAMES[r.level]}${st} ${r.title}`)
  }
  for (const r of db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date, id').all(uid)) {
    push(r.date, `记账：${r.type === 'expense' ? '支出' : '收入'} ${(r.amount / 100).toFixed(2)}元（${r.category}${r.note ? `，${r.note}` : ''}）`)
  }
  for (const r of db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date, id').all(uid)) {
    if (r.type === 'strength') push(r.date, `健身：${r.exercise} ${r.weight_kg > 0 ? `${r.weight_kg}kg` : '自重'}×${r.sets}组${r.reps ? `×${r.reps}个` : ''}`)
    else if (r.type === 'run') push(r.date, `跑步：${r.distance_km ? `${r.distance_km}km ` : ''}${r.duration_min ? `${r.duration_min}分钟` : ''}`)
    else push(r.date, `羽毛球：${{ ms: '男单', md: '男双', xd: '混双' }[r.match_type] || ''} ${r.duration_min}分钟`)
  }
  // 阅读进度按更新时间记录
  for (const r of db.prepare("SELECT * FROM books WHERE user_id = ? AND status != 'want' ORDER BY updated_at").all(uid)) {
    const day = (r.updated_at || '').slice(0, 10)
    const fmt = r.book_format || r.kind
    const pct = r.progress_percent ?? r.progress_pct ?? 0
    const st = r.status === 'done'
      ? '读完'
      : fmt === 'ebook'
        ? `读到${Math.round(pct)}%`
        : `读到${r.current_page}/${r.total_pages || '?'}页`
    push(day, `阅读：《${r.title}》${st}${r.rating ? `，评分${r.rating}星` : ''}${r.note ? `\n  笔记：${r.note.replace(/\n+/g, ' ')}` : ''}`)
  }

  // 阅读进度明细（每次记录的日期和进度）
  for (const r of db.prepare("SELECT re.date, re.current_page, re.progress_percent, b.title FROM reading_entries re JOIN books b ON b.id = re.book_id WHERE re.user_id = ? AND b.status != 'want' ORDER BY re.date").all(uid)) {
    push(r.date, `阅读记录：《${r.title}》第${r.current_page}页（${Math.round(r.progress_percent)}%）`)
  }

  const dates = [...blocks.keys()].sort()
  let text = dates.map((d) => `【${d}】\n${blocks.get(d).join('\n')}`).join('\n\n')
  // 安全阀：超长时从最早处截断（数据量极大时才触发）
  const MAX = 800000
  if (text.length > MAX) text = `（注：更早的记录已省略）\n\n` + text.slice(-MAX)
  return text || '（用户还没有任何记录）'
}

async function callDeepSeek(messages) {
  const { key, model } = aiConfig()
  if (!key) {
    const err = new Error('no_api_key')
    err.code = 'no_api_key'
    throw err
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 120000)
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        // 不设 max_tokens：让模型写完整，不被截断
        body: JSON.stringify({ model, messages, stream: false }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      if (!res.ok) throw new Error(`deepseek_http_${res.status}: ${(await res.text()).slice(0, 200)}`)
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim() || ''
      // DeepSeek 偶发空完成时重试一次
      if (!text && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      return text
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      throw e
    }
  }
  return ''
}

// ── 系统提示词（用户可自定义）──
app.get('/api/settings/persona', (req, res) => {
  const u = sessionUser(req)
  if (!u) return res.status(401).json({ error: 'auth_required' })
  const row = db.prepare('SELECT ai_persona FROM users WHERE id = ?').get(u.id)
  res.json({ persona: row?.ai_persona || '', defaultPersona: AI_PERSONA_DEFAULT })
})

app.patch('/api/settings/persona', (req, res) => {
  const u = sessionUser(req)
  if (!u) return res.status(401).json({ error: 'auth_required' })
  const p = String(req.body?.persona ?? '').trim()
  if (p.length > 5000) return res.status(400).json({ error: 'persona_too_long' })
  db.prepare('UPDATE users SET ai_persona = ? WHERE id = ?').run(p || null, u.id)
  res.json({ ok: true })
})

const AI_PERSONA =
  '你是「星光手帐」里的 AI 伙伴，温暖、真诚、不说教。你会拿到用户从开始记录至今、按时间顺序排列的完整手帐数据（日记、计划、收支、健身、阅读）。请基于全部历史来理解这个真实的人：ta 的习惯、趋势、坚持与波动。'

const AI_PERSONA_DEFAULT = AI_PERSONA

// 获取用户自定义系统提示词，未设置则返回默认值
function getPersona(uid) {
  const row = db.prepare('SELECT ai_persona FROM users WHERE id = ?').get(uid)
  return (row?.ai_persona?.trim()) || AI_PERSONA_DEFAULT
}

// 生成某一天的总结（全量时序上下文；不设输出上限，保证完整）
async function generateSummaryFor(uid, date) {
  const timeline = buildTimeline(uid)
  const content = await callDeepSeek([
    { role: 'system', content: getPersona(uid) },
    {
      role: 'user',
      content: `${timeline}\n\n———\n请为【${date}】这一天写一篇总结（250-350字，第二人称）：\n1. 先概括这一天做了什么、完成得怎么样\n2. 结合全部历史，指出 1-2 个值得注意的亮点、进步或趋势（坚持、变化、对比）\n3. 最后给一句温暖而具体的小建议\n语气像一位了解 ta 的老朋友，不要列表式生硬罗列，直接成文。`,
    },
  ])
  if (!content) return null
  db.prepare('INSERT INTO summaries (user_id, date, content, created_at) VALUES (?,?,?,?) ON CONFLICT(user_id, date) DO UPDATE SET content=excluded.content, created_at=excluded.created_at')
    .run(uid, date, content, now())
  return content
}

app.post('/api/ai/summary', async (req, res) => {
  const uid = req.userId
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.date)) ? String(req.body.date) : fmtDate(new Date())
  try {
    const content = await generateSummaryFor(uid, date)
    if (!content) return res.status(502).json({ error: 'ai_empty' })
    res.json({ date, content })
  } catch (e) {
    if (e.code === 'no_api_key') return res.status(503).json({ error: 'no_api_key' })
    console.error('[AI] summary error:', e.message)
    res.status(502).json({ error: 'ai_unavailable' })
  }
})

// 历史总结列表
app.get('/api/ai/summaries', (req, res) => {
  const rows = db.prepare('SELECT date, content, created_at FROM summaries WHERE user_id = ? ORDER BY date DESC LIMIT 60').all(req.userId)
  res.json(rows)
})

// 对话（全量时序上下文 + 近期对话记录）
app.post('/api/ai/chat', async (req, res) => {
  const uid = req.userId
  const message = String(req.body?.message ?? '').trim()
  if (!message) return res.status(400).json({ error: 'message_required' })
  if (message.length > 2000) return res.status(400).json({ error: 'message_too_long' })
  const timeline = buildTimeline(uid)
  const history = db.prepare('SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(uid).reverse()
  try {
    const reply = await callDeepSeek([
      { role: 'system', content: `${getPersona(uid)}\n以下是 ta 的完整手帐记录：\n\n${timeline}` },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ])
    if (!reply) return res.status(502).json({ error: 'ai_empty' })
    const t = now()
    db.prepare('INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?,?,?,?)').run(uid, 'user', message, t)
    db.prepare('INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?,?,?,?)').run(uid, 'assistant', reply, t)
    res.json({ reply })
  } catch (e) {
    if (e.code === 'no_api_key') return res.status(503).json({ error: 'no_api_key' })
    console.error('[AI] chat error:', e.message)
    res.status(502).json({ error: 'ai_unavailable' })
  }
})

// 对话历史
app.get('/api/ai/chat/history', (req, res) => {
  const rows = db.prepare('SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.userId)
  res.json(rows.reverse())
})

// 清空对话
app.delete('/api/ai/chat/history', (req, res) => {
  const info = db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(req.userId)
  res.json({ ok: true, deleted: info.changes })
})

// ---------------- 统计（按当前用户隔离） ----------------

app.get('/api/stats/overview', (req, res) => {
  const uid = req.userId
  // 日记
  const diaryDates = db.prepare('SELECT date FROM diaries WHERE user_id = ? ORDER BY date DESC').all(uid).map((r) => r.date)
  const dateSet = new Set(diaryDates)
  const cursor = new Date()
  if (!dateSet.has(fmtDate(cursor))) cursor.setDate(cursor.getDate() - 1) // 今天还没写不算断
  let diaryStreak = 0
  while (dateSet.has(fmtDate(cursor))) { diaryStreak++; cursor.setDate(cursor.getDate() - 1) }

  const moodRows = db.prepare("SELECT mood, COUNT(*) AS count FROM diaries WHERE user_id = ? AND mood != '' GROUP BY mood").all(uid)

  // 近 84 天日记打卡（热力图）
  const heat = []
  const d = new Date()
  for (let i = 83; i >= 0; i--) {
    const dd = new Date(d)
    dd.setDate(d.getDate() - i)
    heat.push({ date: fmtDate(dd), has: dateSet.has(fmtDate(dd)) })
  }

  // 任务：各层级当前周期统计（本日/本周/本月/今年/长期；done=1 为完成✅）
  const levelStats = {}
  for (const lv of LEVELS) {
    const r = db.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done FROM todos WHERE user_id = ? AND level = ? AND period = ?').get(uid, lv, currentPeriodOf(lv))
    levelStats[lv] = { total: r.total || 0, done: r.done || 0 }
  }

  // 近 14 天日计划完成情况
  const trend = []
  for (let i = 13; i >= 0; i--) {
    const dd = new Date()
    dd.setDate(dd.getDate() - i)
    const key = fmtDate(dd)
    const r = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done FROM todos WHERE user_id = ? AND level = 'daily' AND period = ?").get(uid, key)
    trend.push({ date: key, total: r.total || 0, done: r.done || 0 })
  }

  // 连续打卡：日计划有天数 ≥1 且全部完成（无待办、无失败）
  const allDaily = db.prepare("SELECT period, COUNT(*) AS total, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS done FROM todos WHERE user_id = ? AND level='daily' GROUP BY period").all(uid)
  const perfectDays = new Set(allDaily.filter((r) => r.total > 0 && r.done === r.total).map((r) => r.period))
  const hasTodayTasks = allDaily.some((r) => r.period === fmtDate(new Date()))
  const c2 = new Date()
  if (!hasTodayTasks || !perfectDays.has(fmtDate(c2))) c2.setDate(c2.getDate() - 1)
  let taskStreak = 0
  while (perfectDays.has(fmtDate(c2))) { taskStreak++; c2.setDate(c2.getDate() - 1) }

  // 记账：本月汇总 + 全年趋势
  const thisMonth = fmtDate(new Date()).slice(0, 7)
  const thisYear = fmtDate(new Date()).slice(0, 4)
  const sumTx = (type, like) =>
    db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE user_id = ? AND type = ? AND date LIKE ?').get(uid, type, like).s || 0
  const yearRows = db.prepare(
    "SELECT substr(date,1,7) AS m, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense, SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income FROM transactions WHERE user_id = ? AND date LIKE ? GROUP BY m",
  ).all(uid, `${thisYear}-%`)
  const yearMap = new Map(yearRows.map((r) => [r.m, r]))
  const yearTrend = []
  for (let m = 1; m <= 12; m++) {
    const key = `${thisYear}-${String(m).padStart(2, '0')}`
    const r = yearMap.get(key)
    yearTrend.push({ month: key, expense: r?.expense || 0, income: r?.income || 0 })
  }
  const yearByCategory = db.prepare(
    "SELECT category, SUM(amount) AS total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? GROUP BY category ORDER BY total DESC",
  ).all(uid, `${thisYear}-%`)

  res.json({
    diary: { total: diaryDates.length, streak: diaryStreak, moodDistribution: moodRows, heatmap: heat },
    todos: { levelStats, trend, taskStreak },
    books: {
      total: db.prepare('SELECT COUNT(*) AS c FROM books WHERE user_id = ?').get(uid).c || 0,
      reading: db.prepare("SELECT COUNT(*) AS c FROM books WHERE user_id = ? AND status='reading'").get(uid).c || 0,
      doneThisYear: db.prepare("SELECT COUNT(*) AS c FROM books WHERE user_id = ? AND status='done' AND finished_at LIKE ?").get(uid, `${thisYear}-%`).c || 0,
    },
    fitness: {
      todayCount: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date = ?').get(uid, fmtDate(new Date())).c || 0,
      weekDays: db.prepare('SELECT COUNT(DISTINCT date) AS c FROM workouts WHERE user_id = ? AND date > ?').get(uid, fmtDate(new Date(Date.now() - 7 * 864e5))).c || 0,
      monthSessions: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date LIKE ?').get(uid, `${thisMonth}-%`).c || 0,
      totalSessions: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ?').get(uid).c || 0,
      trend: (() => {
        const arr = []
        for (let i = 13; i >= 0; i--) {
          const dd = new Date()
          dd.setDate(dd.getDate() - i)
          const key = fmtDate(dd)
          arr.push({ date: key, count: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date = ?').get(uid, key).c || 0 })
        }
        return arr
      })(),
      month: {
        days: db.prepare('SELECT COUNT(DISTINCT date) AS c FROM workouts WHERE user_id = ? AND date LIKE ?').get(uid, `${thisMonth}-%`).c || 0,
        runKm: db.prepare("SELECT COALESCE(SUM(distance_km), 0) AS v FROM workouts WHERE user_id = ? AND type='run' AND date LIKE ?").get(uid, `${thisMonth}-%`).v || 0,
        runMin: db.prepare("SELECT COALESCE(SUM(duration_min), 0) AS v FROM workouts WHERE user_id = ? AND type='run' AND date LIKE ?").get(uid, `${thisMonth}-%`).v || 0,
        badmintonMin: db.prepare("SELECT COALESCE(SUM(duration_min), 0) AS v FROM workouts WHERE user_id = ? AND type='badminton' AND date LIKE ?").get(uid, `${thisMonth}-%`).v || 0,
      },
      prs: db.prepare("SELECT exercise, MAX(weight_kg) AS weightKg FROM workouts WHERE user_id = ? AND type='strength' AND weight_kg > 0 GROUP BY exercise ORDER BY weightKg DESC LIMIT 8").all(uid),
    },
    money: {
      month: thisMonth,
      expense: sumTx('expense', `${thisMonth}-%`),
      income: sumTx('income', `${thisMonth}-%`),
      year: thisYear,
      yearExpense: sumTx('expense', `${thisYear}-%`),
      yearIncome: sumTx('income', `${thisYear}-%`),
      yearTrend,
      yearByCategory,
    },
  })
})

// 数据导出（备份，按当前用户隔离）
app.get('/api/export', (req, res) => {
  const uid = req.userId
  const diaries = db.prepare('SELECT * FROM diaries WHERE user_id = ? ORDER BY date').all(uid).map(rowToDiary)
  const todos = db.prepare('SELECT * FROM todos WHERE user_id = ? ORDER BY id').all(uid).map((r) => rowToTodo(r))
  const transactions = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY date, id').all(uid).map(rowToTx)
  const books = db.prepare('SELECT * FROM books WHERE user_id = ? ORDER BY id').all(uid).map(rowToBook)
  const workouts = db.prepare('SELECT * FROM workouts WHERE user_id = ? ORDER BY date, id').all(uid).map(rowToWorkout)
  res.setHeader('Content-Disposition', `attachment; filename="warm-planner-backup-${fmtDate(new Date())}.json"`)
  res.json({ exportedAt: now(), diaries, todos, transactions, books, workouts })
})

// ---------------- 生产模式：托管前端构建产物 ----------------
const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, {
    setHeaders: (res, filePath) => {
      // HTML 每次校验更新（App 壳/WebView 场景保证新版即时生效）；带 hash 的静态资源保持可缓存
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }))
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

const port = Number(process.env.PORT || 8080)
app.listen(port, () => {
  console.log(`[星光手帐] 服务已启动: http://localhost:${port}`)
  console.log(`[星光手帐] 数据文件: ${path.join(dataDir, 'warm-planner.db')}`)
})

// ---------------- 每晚自动总结（北京时间 22:00，当天有记录才生成） ----------------
async function dailyAutoSummary() {
  // 以北京时间为准取日期（服务器时区可能不同）
  const today = fmtDate(new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60000))
  const users = db.prepare('SELECT id FROM users').all()
  for (const { id: uid } of users) {
    try {
      const hasData = db.prepare(
        `SELECT (SELECT COUNT(*) FROM diaries WHERE user_id=? AND date=?)
              + (SELECT COUNT(*) FROM todos WHERE user_id=? AND level='daily' AND period=?)
              + (SELECT COUNT(*) FROM transactions WHERE user_id=? AND date=?)
              + (SELECT COUNT(*) FROM workouts WHERE user_id=? AND date=?) AS c`,
      ).get(uid, today, uid, today, uid, today, uid, today).c > 0
      if (!hasData) continue
      const content = await generateSummaryFor(uid, today)
      console.log(`[AI] 自动总结完成 user=${uid} date=${today}${content ? '' : '（空结果）'}`)
    } catch (e) {
      console.error(`[AI] 自动总结失败 user=${uid}:`, e.message)
    }
  }
}

const SUMMARY_CRON = process.env.SUMMARY_CRON || '0 22 * * *'
cron.schedule(SUMMARY_CRON, () => { dailyAutoSummary() }, { timezone: 'Asia/Shanghai' })
console.log(`[星光手帐] 自动总结任务已注册: ${SUMMARY_CRON}（Asia/Shanghai）`)
