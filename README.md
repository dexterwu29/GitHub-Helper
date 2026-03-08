# GitHub Helper - 代码目录说明

> GitHub Repository Docs Translation Assistant（GitHub 仓库文档翻译助手）

本项目为开源维护者提供 Markdown 文档多语言翻译服务，通过 GitHub OAuth 登录、GitHub App 授权仓库操作，接入 OpenRouter 大模型完成翻译并自动创建 Pull Request。

---

## 目录结构

```
code/
├── backend/       ← NestJS 独立后端 API（方案 A - 分离部署）
├── frontend/      ← Next.js 独立前端 UI（方案 A - 分离部署）
├── fullstack/     ← Next.js 全栈一体化版本（方案 B - Vercel 统一部署）★ 推荐
└── README.md      ← 本文件
```

---

## 三个版本说明

### `backend/` — NestJS 独立后端

| 项 | 值 |
|---|---|
| 框架 | NestJS 10 + TypeScript |
| 数据库 | PostgreSQL（Prisma 6 ORM） |
| 运行端口 | `3800` |
| 部署方式 | Railway / Render / 自有服务器 |

主要模块：
- `src/auth/` — GitHub OAuth 登录、JWT 鉴权
- `src/repos/` — 仓库管理、文件树解析
- `src/jobs/` — 翻译任务调度与执行
- `src/translation/` — OpenRouter 翻译服务
- `src/webhooks/` — GitHub Push Webhook 处理
- `src/keys/` — 用户 API Key 管理（AES-256-GCM 加密）
- `docs/` — 人工配置文档 & 快速启动指南

### `frontend/` — Next.js 独立前端

| 项 | 值 |
|---|---|
| 框架 | Next.js 15 + React 19 |
| 样式 | Tailwind CSS |
| 运行端口 | `3000` |
| 部署方式 | Vercel |

> 需要配合 `backend/` 运行，通过 `NEXT_PUBLIC_API_URL` 环境变量连接后端 API。

### `fullstack/` — Next.js 全栈一体化 ★ 推荐

| 项 | 值 |
|---|---|
| 框架 | Next.js 15 + React 19 |
| 后端 | Next.js API Routes（`/api/v1/*`） |
| 数据库 | PostgreSQL（Prisma 6 ORM） |
| 定时任务 | Vercel Cron Jobs（`/api/cron/process-jobs`） |
| 部署方式 | **Vercel 一键部署** |

合并了 `backend` 和 `frontend` 的所有功能到一个 Next.js 应用中：
- `src/app/api/` — 所有 REST API 路由
- `src/app/dashboard/` — 前端页面
- `src/lib/server/` — 服务端工具（GitHub 客户端、翻译引擎、加密、鉴权）
- `prisma/schema.prisma` — 数据库 Schema

---

## 快速开始（fullstack 版本）

```bash
# 1. 进入目录
cd code/fullstack

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填写：GitHub App 配置、数据库连接、JWT 密钥等

# 4. 初始化数据库
npx prisma generate
npx prisma db push

# 5. 启动开发服务器
npm run dev
```

访问 `http://localhost:3000` 即可使用。

---

## 技术栈总览

| 技术 | 版本 | 用途 |
|---|---|---|
| Next.js | 15 | 前端框架 + API 路由 |
| React | 19 | UI 组件 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4 | 样式 |
| Prisma | 6 | ORM |
| PostgreSQL | 16+ | 数据库（推荐 Neon） |
| Octokit | latest | GitHub API 客户端 |
| OpenRouter API | — | LLM 翻译引擎 |

---

## 部署方案对比

| | 方案 A（分离部署） | 方案 B（统一部署）★ |
|---|---|---|
| 代码 | `backend/` + `frontend/` | `fullstack/` |
| 后端部署 | Railway / Render | Vercel API Routes |
| 前端部署 | Vercel | Vercel |
| 定时任务 | NestJS Cron（进程内） | Vercel Cron Jobs |
| 复杂度 | 需管理两个服务 | 一个项目、一次部署 |
| 成本 | 后端需单独付费 | Vercel Hobby 计划可免费起步 |
