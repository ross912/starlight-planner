// 本地开发一键启动：后端 API(8787) + Vite 前端
// 转发 CLI 参数（如 --port 7100 --host）给 Vite
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const viteBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite')

const args = process.argv.slice(2)

const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PORT: '8787' },
})

const vite = spawn(viteBin, args, { cwd: root, stdio: 'inherit' })

function shutdown(code = 0) {
  server.kill('SIGTERM')
  vite.kill('SIGTERM')
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
vite.on('exit', (code) => shutdown(code ?? 0))
server.on('exit', (code) => { vite.kill('SIGTERM'); process.exit(code ?? 0) })
