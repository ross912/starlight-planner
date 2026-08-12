import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { LayoutDashboard, BookOpen, ListChecks, BarChart3, Download, Wallet, Library, LogOut, KeyRound, Dumbbell, UserPlus, Copy, Check, Settings, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { api } from '../lib/api'

const NAV = [
  { to: '/', label: '总览', icon: LayoutDashboard, end: true },
  { to: '/diary', label: '日记', icon: BookOpen },
  { to: '/plans', label: '计划', icon: ListChecks },
  { to: '/money', label: '记账', icon: Wallet },
  { to: '/reading', label: '阅读', icon: Library },
  { to: '/fitness', label: '健身', icon: Dumbbell },
  { to: '/summary', label: 'AI', icon: Sparkles },
  { to: '/stats', label: '统计', icon: BarChart3 },
]

function SideNav() {
  return (
    <>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all ${
              isActive
                ? 'bg-white/90 text-orange-700 font-semibold shadow-[0_2px_10px_-3px_rgba(194,120,40,0.35)]'
                : 'text-stone-600 hover:bg-white/50 hover:text-orange-700'
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </>
  )
}

export default function AppLayout() {
  const today = format(new Date(), 'yyyy年M月d日')
  const [showPwd, setShowPwd] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [username, setUsername] = useState('')

  useEffect(() => {
    api.checkAuth().then((r) => setUsername(r.username ?? '')).catch(() => {})
  }, [])

  const logout = async () => {
    await api.logout().catch(() => {})
    window.location.reload()
  }

  return (
    <div className="min-h-screen">
      {/* 桌面端侧边栏 */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col z-20 border-r border-orange-200/60 bg-gradient-to-b from-amber-100/90 via-orange-50/90 to-rose-50/90 backdrop-blur">
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">✨</span>
            <div>
              <h1 className="text-lg font-bold text-orange-900 tracking-wide">星光手帐</h1>
              <p className="text-xs text-orange-700/60 mt-0.5">记录生活 · 规划未来</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <SideNav />
        </nav>
        <div className="px-4 pb-6 space-y-1">
          {username && (
            <p className="px-4 pb-1 text-xs text-orange-800/60">✨ {username} 的手帐</p>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-2 rounded-xl px-4 py-2 text-xs text-stone-500 hover:bg-white/60 hover:text-orange-700 transition"
          >
            <Settings size={14} />
            设置
          </button>
          <p className="px-4 pt-2 text-xs text-orange-800/40">{today}</p>
        </div>
      </aside>

      {/* 移动端顶栏（仅品牌 + 操作，导航走底部标签栏） */}
      <header
        className="md:hidden sticky top-0 z-20 border-b border-orange-200/60 bg-amber-50/90 backdrop-blur px-4"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <span className="font-bold text-orange-900 text-[15px]">星光手帐</span>
            {username && <span className="text-xs text-orange-800/50">· {username}</span>}
          </div>
          <button onClick={() => setShowSettings(true)} className="p-1.5 text-stone-500 hover:text-orange-700" title="设置">
            <Settings size={17} />
          </button>
        </div>
      </header>

      {/* 移动端底部标签栏（拇指热区 + 安全区） */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-orange-200/60 bg-amber-50/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center gap-0.5 py-1.5 transition ${
                  isActive ? 'text-orange-600' : 'text-stone-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span className={`text-[10px] leading-none ${isActive ? 'font-semibold' : ''}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* 主内容（移动端为底部标签栏预留空间） */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-6xl px-3.5 pt-4 pb-24 md:px-10 md:py-10 md:pb-10">
          <Outlet />
        </div>
      </main>

      {showSettings && (
        <SettingsDialog
          username={username}
          onRenamed={setUsername}
          onOpenPwd={() => { setShowSettings(false); setShowPwd(true) }}
          onOpenInvite={() => { setShowSettings(false); setShowInvite(true) }}
          onLogout={logout}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showPwd && <PasswordDialog onClose={() => setShowPwd(false)} />}
      {showInvite && <InviteDialog onClose={() => setShowInvite(false)} />}
    </div>
  )
}

function SettingsDialog({
  username,
  onRenamed,
  onOpenPwd,
  onOpenInvite,
  onLogout,
  onClose,
}: {
  username: string
  onRenamed: (name: string) => void
  onOpenPwd: () => void
  onOpenInvite: () => void
  onLogout: () => void
  onClose: () => void
}) {
  const [name, setName] = useState(username)
  const [status, setStatus] = useState('')
  const [persona, setPersona] = useState('')
  const [personaStatus, setPersonaStatus] = useState('')
  const [defaultPersona, setDefaultPersona] = useState('')

  const loadPersona = async () => {
    try {
      const r = await api.getPersona()
      setPersona(r.persona)
      setDefaultPersona(r.defaultPersona)
    } catch { /* ignore */ }
  }
  useEffect(() => { loadPersona() }, [])

  const saveName = async () => {
    const n = name.trim()
    if (!n || n === username) return
    try {
      const r = await api.changeUsername(n)
      onRenamed(r.username)
      setStatus('已更新 ✓')
      setTimeout(() => setStatus(''), 1500)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setStatus(msg.includes('username_taken') ? '这个用户名已被占用' : '用户名需 2-20 位（中英文、数字、_、-）')
    }
  }

  const rows = [
    { icon: UserPlus, label: '邀请朋友', desc: '生成邀请码，最多 10 人使用', action: onOpenInvite, cls: 'hover:text-orange-700' },
    { icon: KeyRound, label: '修改密码', desc: '修改后其他设备需重新登录', action: onOpenPwd, cls: 'hover:text-orange-700' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="warm-card relative w-full max-w-sm p-6 shadow-xl">
        <h4 className="font-semibold text-orange-950 flex items-center gap-2">
          <Settings size={16} className="text-orange-500" /> 设置
        </h4>

        {/* 用户名 */}
        <label className="mt-4 block text-xs font-medium text-stone-500">用户名</label>
        <div className="mt-1.5 flex gap-2">
          <input
            className="warm-input flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
          />
          <button className="warm-btn !px-3.5" onClick={saveName} disabled={!name.trim() || name.trim() === username}>
            保存
          </button>
        </div>
        {status && <p className={`mt-1.5 text-xs ${status.includes('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>{status}</p>}

        {/* 系统提示词 */}
        <div className="mt-4 border-t border-orange-100 pt-3">
          <label className="block text-xs font-medium text-stone-500">系统提示词</label>
          <p className="text-[10px] text-stone-400 mt-0.5">
            自定义 AI 的身份和说话风格。清空即恢复默认。
          </p>
          <textarea
            className="warm-input mt-1.5 w-full min-h-[80px] text-xs leading-relaxed resize-y"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder={defaultPersona || '加载中...'}
            rows={3}
          />
          <div className="mt-2 flex gap-2">
            <button
              className="warm-btn !px-3 !py-1.5 text-xs"
              onClick={async () => {
                try {
                  await api.savePersona(persona)
                  setPersonaStatus('已保存 ✓')
                  setTimeout(() => setPersonaStatus(''), 1500)
                } catch { setPersonaStatus('保存失败') }
              }}
            >
              保存
            </button>
            <button
              className="warm-btn-ghost !px-3 !py-1.5 text-xs"
              onClick={async () => {
                try {
                  await api.savePersona('')
                  setPersona('')
                  setPersonaStatus('已恢复默认 ✓')
                  setTimeout(() => setPersonaStatus(''), 1500)
                } catch { setPersonaStatus('恢复失败') }
              }}
            >
              恢复默认
            </button>
            {personaStatus && (
              <span className={`text-xs self-center ${personaStatus.includes('✓') ? 'text-emerald-600' : 'text-rose-500'}`}>
                {personaStatus}
              </span>
            )}
          </div>
        </div>

        {/* 功能项 */}
        <div className="mt-4 space-y-1 border-t border-orange-100 pt-3">
          {rows.map(({ icon: Icon, label, desc, action, cls }) => (
            <button key={label} onClick={action} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-stone-600 hover:bg-orange-50 transition ${cls}`}>
              <Icon size={16} className="text-stone-400" />
              <span className="flex-1">
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-stone-400">{desc}</span>
              </span>
            </button>
          ))}
          <a
            href={api.exportUrl}
            download
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-stone-600 hover:bg-orange-50 hover:text-orange-700 transition"
          >
            <Download size={16} className="text-stone-400" />
            <span className="flex-1">
              <span className="block text-sm">导出数据备份</span>
              <span className="block text-xs text-stone-400">日记 / 计划 / 账本 / 书架 / 健身（JSON）</span>
            </span>
          </a>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-rose-500/90 hover:bg-rose-50 transition"
          >
            <LogOut size={16} />
            <span className="flex-1">
              <span className="block text-sm">退出登录</span>
              <span className="block text-xs text-rose-300">本设备将需要重新登录</span>
            </span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button className="warm-btn-ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [invites, setInvites] = useState<{ code: string; expiresAt: string; usedNames: string[]; remaining: number; createdAt: string }[]>([])
  const [copied, setCopied] = useState('')

  const load = () => api.listInvites().then(setInvites).catch(console.error)

  useEffect(() => {
    load()
  }, [])

  const generate = async () => {
    await api.createInvite()
    load()
  }

  const copy = async (code: string) => {
    let ok = false
    // 首选：现代剪贴板 API（仅 HTTPS/localhost 可用）
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code)
        ok = true
      } catch { ok = false }
    }
    // 兜底：隐藏 textarea + execCommand（HTTP 页面与安卓 WebView 均可用）
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.top = '0'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      document.body.removeChild(ta)
    }
    if (ok) {
      setCopied(code)
      setTimeout(() => setCopied(''), 1500)
    } else {
      window.prompt('请手动复制邀请码：', code)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="warm-card relative w-full max-w-sm p-6 shadow-xl">
        <h4 className="font-semibold text-orange-950 flex items-center gap-2">
          <UserPlus size={16} className="text-orange-500" /> 邀请朋友
        </h4>
        <p className="mt-1.5 text-xs text-stone-400">把邀请码发给朋友，他们注册后就有自己的手帐。每个码最多可供 10 人使用，30 天有效。</p>

        <button className="warm-btn mt-4 w-full" onClick={generate}>
          生成新邀请码
        </button>

        <div className="mt-4 max-h-52 space-y-1.5 overflow-y-auto">
          {invites.map((inv) => (
            <div key={inv.code} className="rounded-xl border border-orange-100 bg-white/70 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-stone-700">{inv.code}</span>
                {inv.remaining > 0 ? (
                  <button
                    className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800"
                    onClick={() => copy(inv.code)}
                  >
                    {copied === inv.code ? <Check size={12} /> : <Copy size={12} />}
                    {copied === inv.code ? '已复制' : '复制'}
                  </button>
                ) : (
                  <span className="text-xs text-stone-400">已满员</span>
                )}
              </div>
              <p className="mt-1 text-xs text-stone-400">
                {inv.usedNames.length > 0 ? `已加入：${inv.usedNames.join('、')} · ` : ''}剩余 {inv.remaining} 人
              </p>
            </div>
          ))}
          {invites.length === 0 && <p className="py-4 text-center text-xs text-stone-400">还没有邀请码，点上面生成一个</p>}
        </div>

        <div className="mt-4 flex justify-end">
          <button className="warm-btn-ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  const submit = async () => {
    if (next.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    if (next !== confirm) {
      setError('两次输入的新密码不一致')
      return
    }
    setError('')
    try {
      await api.changePassword(current, next)
      setOk(true)
    } catch {
      setError('当前密码不正确')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="warm-card relative w-full max-w-sm p-6 shadow-xl">
        <h4 className="font-semibold text-orange-950 flex items-center gap-2">
          <KeyRound size={16} className="text-orange-500" /> 修改访问密码
        </h4>
        {ok ? (
          <div className="py-6 text-center">
            <p className="text-3xl">🎉</p>
            <p className="mt-2 text-sm text-stone-600">密码已更新，其他设备的登录已失效</p>
            <button className="warm-btn mt-4" onClick={onClose}>完成</button>
          </div>
        ) : (
          <>
            <label className="mt-4 block text-xs font-medium text-stone-500">当前密码</label>
            <input type="password" className="warm-input mt-1.5 w-full" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
            <label className="mt-3 block text-xs font-medium text-stone-500">新密码（至少 6 位）</label>
            <input type="password" className="warm-input mt-1.5 w-full" value={next} onChange={(e) => setNext(e.target.value)} />
            <label className="mt-3 block text-xs font-medium text-stone-500">确认新密码</label>
            <input type="password" className="warm-input mt-1.5 w-full" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="warm-btn-ghost" onClick={onClose}>取消</button>
              <button className="warm-btn" onClick={submit}>保存</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
