#!/bin/bash
# 星光手帐 启动器：优先用 Chrome 独立窗口模式（无地址栏，像原生 App）
URL="http://116.62.118.251/"

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args "--app=$URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args "--app=$URL"
else
  open "$URL"
fi
