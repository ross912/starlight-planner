# 🌤️ 星光手帐

日记 + 五层计划（日 / 周 / 月 / 年 / 总）的中文暖色系全栈应用。

## 功能

- **日记**：按日期记录，支持心情 😄、天气 ☀️、标签 #、全文搜索历史日记，自动保存
- **计划**：日计划、周计划、月计划、年计划、总计划五层清单，均可勾选完成 / 未完成
- **层级关联**：各层内容独立存在；可把下层待办关联到上层计划，完成进度自动向上汇总
- **记账**：收支记录（金额、10 种支出分类 + 5 种收入分类、备注、日期），按月浏览，月度支出/收入/结余汇总、支出分类占比、每日收支图表
- **统计**：连续记录天数、连续完成天数、各层完成率、近 14 天日计划趋势、心情分布、12 周日记热力图
- **数据持久化**：SQLite 数据库（`server/data/warm-planner.db`），支持一键导出 JSON 备份

## 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Recharts
- 后端：Express + Node 内置 SQLite（`node:sqlite`，零原生依赖）
- 要求：Node.js 22.5+（推荐 24）

## 本地运行

```bash
npm install
npm run dev        # 同时启动后端 API(8787) 与前端开发服务器
# 打开终端提示的地址，默认 http://localhost:3000/
```

## 生产运行（本地模拟云端）

```bash
npm run build      # 构建前端到 dist/
npm start          # 单进程托管 前端 + API，默认 8080 端口
# 打开 http://localhost:8080/
```

## 部署到阿里云（ECS / 轻量应用服务器）

### 方式一：一键部署（推荐）

在本机执行，自动完成上传代码、服务器装 Node 24、构建、pm2 守护：

```bash
./scripts/deploy.sh root@服务器公网IP                # 密码登录
./scripts/deploy.sh ubuntu@服务器公网IP 22 ~/.ssh/私钥   # 密钥登录
```

然后在阿里云控制台「安全组」放行 TCP 8080 端口，访问 `http://服务器公网IP:8080/`。

### 方式二：手动部署

1. 上传 `starlight-planner-release.tar.gz` 到服务器并解压（如 `/opt/starlight-planner`）
2. 服务器上执行：
   ```bash
   cd /opt/starlight-planner
   APP_DIR=/opt/starlight-planner bash scripts/server-setup.sh
   ```
3. 安全组放行 8080 端口后访问

> 数据保存在云端服务器的 `server/data/warm-planner.db`，多设备访问同一地址即可共享数据。
> 建议定期备份该文件（或配置阿里云自动快照）；应用内也提供「导出数据备份」按钮。
> 有域名时可在服务器上加 Nginx 反代到 80/443 并申请免费 HTTPS 证书。

## 目录结构

```
warm-planner/
├── server/index.js      # 后端：Express + SQLite，API + 静态托管
├── scripts/dev.mjs      # 本地一键启动（前端 + 后端）
├── src/
│   ├── pages/           # 总览 / 日记 / 计划 / 统计
│   ├── components/      # 布局
│   └── lib/             # API 封装、周期工具、常量
└── dist/                # 前端构建产物（npm run build 生成）
```
