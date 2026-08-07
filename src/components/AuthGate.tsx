import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Lock, Sparkles, User } from 'lucide-react'
import { api } from '../lib/api'

type Phase = 'loading' | 'login' | 'authed'
type Mode = 'login' | 'register'

/**
 * 登录门：进入星光手帐前需要登录；每人独立账号，数据互相隔离。
 * 会话通过 HttpOnly Cookie 保持（30 天），API 返回 401 时自动回到登录页。
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.checkAuth()
      .then((r) => setPhase(r.authed ? 'authed' : 'login'))
      .catch(() => setPhase('login'))
    const onRequired = () => setPhase('login')
    window.addEventListener('auth:required', onRequired)
    return () => window.removeEventListener('auth:required', onRequired)
  }, [])

  const mapError = (e: unknown): string => {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('429')) return '尝试次数过多，请 5 分钟后再试'
    if (msg.includes('wrong_credentials')) return '用户名或密码不正确'
    if (msg.includes('invalid_invite')) return '邀请码无效、已被使用或已过期'
    if (msg.includes('username_taken')) return '这个用户名已被占用'
    if (msg.includes('invalid_username')) return '用户名需 2-20 位（中英文、数字、_、-）'
    if (msg.includes('password_too_short')) return '密码至少 6 位'
    return '网络异常，请稍后重试'
  }

  const submit = useCallback(async () => {
    if (!username.trim() || !password || busy) return
    if (mode === 'register' && !inviteCode.trim()) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') {
        await api.login(username.trim(), password)
      } else {
        await api.register(username.trim(), password, inviteCode.trim())
      }
      setPassword('')
      setPhase('authed')
      window.location.reload()
    } catch (e) {
      setError(mapError(e))
    } finally {
      setBusy(false)
    }
  }, [username, password, inviteCode, mode, busy])

  if (phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-stone-400">星光手帐加载中…</p>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="warm-card w-full max-w-sm p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 to-orange-300 text-3xl shadow-[0_4px_16px_-4px_rgba(234,88,12,0.4)]">
            ✨
          </div>
          <h1 className="mt-4 text-2xl font-bold text-orange-950">星光手帐</h1>
          <p className="mt-1 text-sm text-stone-400">记录生活 · 规划未来 · 这里属于你</p>

          {/* 登录 / 注册切换 */}
          <div className="mt-5 flex rounded-xl bg-orange-100/70 p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 rounded-lg py-1.5 text-sm transition ${
                  mode === m ? 'bg-white text-orange-700 font-semibold shadow-sm' : 'text-stone-500'
                }`}
              >
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3 text-left">
            <div>
              <label className="text-xs font-medium text-stone-500 flex items-center gap-1">
                <User size={12} /> 用户名
              </label>
              <input
                className="warm-input mt-1.5 w-full"
                placeholder="你的用户名"
                value={username}
                autoFocus
                autoCapitalize="none"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-stone-500 flex items-center gap-1">
                <Lock size={12} /> 密码
              </label>
              <input
                type="password"
                className="warm-input mt-1.5 w-full"
                placeholder={mode === 'register' ? '设置密码（至少 6 位）' : '请输入密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            {mode === 'register' && (
              <div>
                <label className="text-xs font-medium text-stone-500 flex items-center gap-1">
                  <KeyRound size={12} /> 邀请码
                </label>
                <input
                  className="warm-input mt-1.5 w-full"
                  placeholder="找手帐主人索取"
                  value={inviteCode}
                  autoCapitalize="none"
                  onChange={(e) => setInviteCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
            )}
            {error && <p className="text-xs text-rose-500">{error}</p>}
          </div>

          <button
            className="warm-btn mt-4 w-full"
            onClick={submit}
            disabled={busy || !username.trim() || !password || (mode === 'register' && !inviteCode.trim())}
          >
            <Sparkles size={15} />
            {busy ? '请稍候…' : mode === 'login' ? '进入手帐' : '注册并进入'}
          </button>

          <p className="mt-4 text-xs text-stone-300">登录后 30 天内免密进入 · 每人一本独立手帐</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
