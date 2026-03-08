# GitHub Helper 前端 - 快速启动指南

## 环境要求

- **Node.js** >= 18.x
- **npm** >= 9.x（或等价的 pnpm / yarn）
- 后端服务运行在 `http://localhost:3800`（默认）

## 1. 安装依赖

```bash
cd code/frontend
npm install
```

## 2. 配置环境变量

复制示例文件并按需修改：

```bash
cp .env.local.example .env.local
```

`.env.local` 内容：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3800
```

- 本地开发时指向后端开发服务地址
- 部署到 Vercel 时修改为后端生产地址

## 3. 启动开发服务器

```bash
npm run dev
```

前端默认运行在 **http://localhost:3000**。

## 4. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── page.tsx            # 落地页（未登录展示）
│   ├── layout.tsx          # 根布局
│   ├── globals.css         # 全局样式 + Tailwind 自定义组件
│   ├── auth/callback/      # GitHub OAuth 回调页
│   └── dashboard/          # 登录后的仪表盘
│       ├── page.tsx        # 仓库列表 + 导入
│       ├── layout.tsx      # 仪表盘公共布局（含 Navbar）
│       ├── settings/       # API Key 管理
│       └── repos/[repoId]/ # 仓库详情
│           ├── page.tsx    # 翻译配置 + 文件选择 + 触发翻译
│           └── jobs/       # 任务历史 + PR 列表
├── components/             # 可复用组件
│   ├── Navbar.tsx          # 顶部导航栏
│   ├── FileTree.tsx        # Markdown 文件树选择器
│   ├── JobProgress.tsx     # 任务进度展示
│   ├── EmptyState.tsx      # 空状态占位
│   └── LoadingSpinner.tsx  # 加载动画
├── hooks/                  # 自定义 Hooks
│   ├── useAuth.ts          # 用户认证状态
│   └── usePolling.ts       # 轮询 Hook
└── lib/                    # 工具库
    ├── api.ts              # 后端 API 客户端（类型 + 请求）
    └── constants.ts        # 常量（语言列表、状态映射等）
```

## 页面路由说明

| 路由 | 说明 |
|------|------|
| `/` | 落地页，未登录时展示产品介绍；已登录自动跳转仪表盘 |
| `/auth/callback` | GitHub OAuth 回调处理 |
| `/dashboard` | 仓库列表，支持导入新仓库、检测 GitHub App 安装状态 |
| `/dashboard/repos/[id]` | 仓库详情：配置翻译语言、选择文档、触发翻译 |
| `/dashboard/repos/[id]/jobs` | 翻译任务历史 + PR 列表，支持实时轮询 |
| `/dashboard/settings` | OpenRouter API Key 管理 |

## 技术栈

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript 5.7**
- **Tailwind CSS 3.4** (Chinese Red 主题色)
- **Lucide React** (图标库)

## 与后端对接

前端通过 `next.config.ts` 配置的 rewrite 规则将 `/api/*` 请求代理到后端：

```
浏览器 → localhost:3000/api/v1/... → localhost:3800/api/v1/...
```

所有 API 请求使用 `credentials: 'include'` 携带 Cookie，认证由后端 Session 管理。

## 注意事项

1. 首次使用需通过 GitHub OAuth 登录
2. 登录后需安装 GitHub App 到目标仓库所在的组织/账户
3. 导入仓库后需配置翻译语言和选择待翻译文档
4. 翻译任务为异步执行，页面自动轮询更新进度
