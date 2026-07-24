# InkOS Cloudflare

> InkOS 的 Cloudflare 原生版本 — 24/7 AI 小说创作系统，完全运行在 Cloudflare 边缘网络

## 关于本项目

本项目是 [InkOS](https://github.com/Narcooo/inkos)（Story Creation AI Agent）的 **Cloudflare 原生移植版**。

### 与原始 InkOS 的区别

| 特性 | 原始 InkOS | 本版本 |
|------|-----------|--------|
| 运行环境 | 需要 VPS/服务器 | **Cloudflare Workers**（零服务器） |
| 存储 | `node:fs` 文件系统 | **Durable Objects SQLite**（持久化） |
| 调度 | `inkos daemon` 守护进程 | **Cron Triggers** + Agents SDK Schedule |
| 写作管线 | PipelineRunner | **Workflow** 多步骤持久化执行 |
| 前端 | React + Hono 服务器 | **Cloudflare Pages** + Vite |
| 部署 | npm 包 + 手动部署 | **wrangler deploy** 一键部署 |
| 成本 | VPS ¥30-100/月 | Cloudflare 免费套餐 |

### 架构

```
┌──────────────────────────────────────────────────────────────┐
│  Cloudflare Workers (Agents SDK + Durable Objects)           │
│                                                              │
│  ┌────────────────────────────────────────────────┐          │
│  │  InkOS Agent                                    │          │
│  │  ├─ SQLite 持久化存储 (books, chapters, docs)    │          │
│  │  ├─ scheduleEvery(15min) 自动写作调度            │          │
│  │  ├─ plan → write → audit → revise 写作管线       │          │
│  │  └─ RPC / HTTP API 接口                        │          │
│  └────────────────────────────────────────────────┘          │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────┐     │
│  │  Studio 前端      │  │  Cron Triggers (每15分钟)    │     │
│  │  (React + Vite)  │  │  自动触发写作周期             │     │
│  └──────────────────┘  └──────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 部署到 Cloudflare

```bash
# 安装依赖
npm install
cd studio && npm install && npm run build && cd ..

# 设置 LLM API Key（必选）
npx wrangler secret put LLM_API_KEY
npx wrangler secret put LLM_BASE_URL   # 可选，默认 https://api.openai.com/v1
npx wrangler secret put LLM_MODEL      # 可选，默认 gpt-4o

# 部署
npm run deploy
```

### 2. 创建第一本书

```bash
curl -X POST https://your-worker.workers.dev/api/create-book \
  -H "Content-Type: application/json" \
  -d '{"id":"my-novel","title":"吞天魔帝","genre":"玄幻","language":"zh"}'
```

### 3. 查看状态

```bash
curl https://your-worker.workers.dev/api/status
```

## API 文档

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/status` | GET | 系统状态（写作统计、书籍列表） |
| `/api/books` | GET | 书籍列表 |
| `/api/chapters?bookId=<id>` | GET | 章节列表 |
| `/api/create-book` | POST | 创建新书 |
| `/api/trigger-write` | POST | 手动触发写作 |
| `/agents/inkos-agent/default` | WebSocket | Agent 实时连接 |

## 支持的 LLM 提供商

通过设置 `LLM_BASE_URL` 和 `LLM_API_KEY`，可以使用任意 OpenAI 兼容的 API：

| 提供商 | Base URL |
|--------|----------|
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| 硅基流动 | `https://api.siliconflow.cn/v1` |
| 百炼 (阿里云) | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 自定义 | 任意 OpenAI 兼容端点 |

## 项目结构

```
inkos-cloudflare/
├── src/
│   ├── index.ts              # 入口文件
│   ├── agent/
│   │   └── inkos-agent.ts    # 核心 Agent（Durable Object）
│   ├── storage/              # 持久化存储层（SQLite）
│   │   ├── schema.ts         # 数据库表结构
│   │   ├── book-store.ts     # 书籍 CRUD
│   │   ├── chapter-store.ts  # 章节 CRUD
│   │   └── story-store.ts    # 故事文档/角色/会话
│   ├── pipeline/             # AI 写作管线
│   │   ├── planner.ts        # 章节规划
│   │   ├── writer.ts         # 内容写作
│   │   ├── auditor.ts        # 连续性审计
│   │   ├── reviser.ts        # 修订
│   │   └── index.ts          # 管线编排
│   └── llm/
│       └── client.ts         # OpenAI 兼容 API 客户端
├── studio/                   # React 前端
├── wrangler.jsonc            # Cloudflare Workers 配置
└── package.json
```

## License

AGPL-3.0-only

## 致谢

- [InkOS](https://github.com/Narcooo/inkos) — 原始项目，Story Creation AI Agent
- [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) — Agent 框架
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) — 持久化存储