#!/usr/bin/env bash
# 星光手帐 · 一键部署到阿里云服务器
# 用法：
#   ./scripts/deploy.sh <用户@服务器IP> [SSH端口] [SSH私钥路径]
# 示例：
#   ./scripts/deploy.sh root@47.100.1.1
#   ./scripts/deploy.sh ubuntu@47.100.1.1 22 ~/.ssh/my_key
set -euo pipefail

REMOTE="${1:-}"
PORT="${2:-22}"
KEY="${3:-}"

if [ -z "$REMOTE" ]; then
  echo "用法: ./scripts/deploy.sh <用户@服务器IP> [SSH端口] [SSH私钥路径]"
  exit 1
fi

SSH_OPTS=(-p "$PORT" -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh -p $PORT -o StrictHostKeyChecking=accept-new"
if [ -n "$KEY" ]; then
  SSH_OPTS+=(-i "$KEY")
  RSYNC_SSH="$RSYNC_SSH -i $KEY"
fi

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="/opt/starlight-planner"

echo "==> 1/3 同步代码到 $REMOTE:$APP_DIR"
ssh "${SSH_OPTS[@]}" "$REMOTE" "mkdir -p $APP_DIR"
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'server/data' \
  --exclude '.git' \
  -e "$RSYNC_SSH" \
  "$PROJECT_DIR/" "$REMOTE:$APP_DIR/"

echo "==> 2/3 服务器端安装与构建"
scp -P "$PORT" ${KEY:+-i "$KEY"} "$PROJECT_DIR/scripts/server-setup.sh" "$REMOTE:/tmp/starlight-setup.sh"
ssh "${SSH_OPTS[@]}" "$REMOTE" "APP_DIR=$APP_DIR bash /tmp/starlight-setup.sh"

echo "==> 3/3 完成"
echo "    应用已在服务器上以 pm2 守护运行（端口 8080）"
echo "    请确认阿里云安全组已放行 8080 端口，然后访问："
echo "    http://${REMOTE#*@}:8080/"
