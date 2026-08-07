#!/usr/bin/env bash
# 星光手帐 · 服务器端初始化（由 deploy.sh 上传执行，也可单独在服务器上运行）
# 支持 Ubuntu / Debian / Alibaba Cloud Linux / CentOS
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/starlight-planner}"
APP_PORT="${APP_PORT:-8080}"

echo "==> 应用目录: $APP_DIR"

# ---------- 1. Node.js 24 ----------
need_node=1
if command -v node >/dev/null 2>&1; then
  major="$(node -v | sed 's/v//; s/\..*//')"
  if [ "$major" -ge 22 ]; then need_node=0; fi
fi

if [ "$need_node" -eq 1 ]; then
  echo "==> 安装 Node.js 24（使用 npmmirror 二进制镜像，国内更快）"
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  NARCH="x64" ;;
    aarch64) NARCH="arm64" ;;
    *) echo "不支持的架构: $ARCH"; exit 1 ;;
  esac
  cd /tmp
  curl -fsSL "https://registry.npmmirror.com/-/binary/node/v24.5.0/node-v24.5.0-linux-$NARCH.tar.xz" -o node.tar.xz
  tar -xJf node.tar.xz -C /usr/local --strip-components=1
  rm -f node.tar.xz
fi
echo "==> Node 版本: $(node -v) / npm: $(npm -v)"

# ---------- 2. 依赖与构建 ----------
cd "$APP_DIR"
echo "==> 配置 npm 国内镜像并安装依赖"
npm config set registry https://registry.npmmirror.com
npm install --no-audit --no-fund

echo "==> 构建前端"
npm run build

# ---------- 3. pm2 守护 ----------
if ! command -v pm2 >/dev/null 2>&1; then
  echo "==> 安装 pm2"
  npm install -g pm2
fi

echo "==> 启动 / 重启应用"
# 幂等：先删除旧注册（避免同名进程残留导致端口冲突），再启动
pm2 delete starlight-planner >/dev/null 2>&1 || true
PORT="$APP_PORT" pm2 start "npm start" --name starlight-planner
pm2 save
# 开机自启（root 可直接成功；普通用户会打印一条需要手动执行的命令）
pm2 startup || true

echo ""
echo "=========================================="
echo "  部署完成 ✅"
echo "  进程管理: pm2 status / pm2 logs starlight-planner"
echo "  数据文件: $APP_DIR/server/data/warm-planner.db（定期备份）"
echo ""
echo "  还差最后一步（在阿里云控制台操作）:"
echo "  → 安全组 / 防火墙放行 TCP $APP_PORT 端口"
echo "  然后访问 http://服务器公网IP:$APP_PORT/"
echo "=========================================="
