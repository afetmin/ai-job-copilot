# AI Job Copilot

一个用于简历分析与优化建议生成的全栈项目，包含前端工作台、后端检索与模型推理能力。

## 项目结构

```text
.
├── frontend/   # Next.js 前端（工作台、结果页、API 代理路由）
├── backend/    # FastAPI 后端（文档处理、向量检索、模型调用）
├── docs/       # 设计与文档
└── dev.sh      # 一键本地联调脚本（同时启动前后端）
```

## 技术栈

- 前端：Next.js 15、React 19、TypeScript、Tailwind CSS、Dexie（本地 IndexedDB）
- 前端测试与质量：Vitest、Testing Library、ESLint
- 后端：FastAPI、Pydantic Settings
- 检索与文档处理：ChromaDB、LangChain、PyMuPDF
- 模型接入：OpenAI 兼容协议、Anthropic 兼容协议、DashScope/OpenAI 相关 SDK
- Python 工具链：uv、pytest、ruff、mypy

## 本地开发方式

### 1) 环境要求

- Node.js 20+
- Python 3.11+
- `uv`（Python 包管理工具）

### 2) 安装依赖

前端：

```bash
cd frontend
npm install
```

后端：

```bash
cd backend
uv sync --all-groups
```

### 3) 配置环境变量

后端读取 `backend/.env`（变量前缀 `AI_JOB_COPILOT_`），常用项如下：

- 可先复制模板：`cp backend/.env.example backend/.env`

- `AI_JOB_COPILOT_LLM_PROTOCOL`：`openai_compatible` 或 `anthropic_compatible`
- `AI_JOB_COPILOT_LLM_MODEL`
- `AI_JOB_COPILOT_LLM_API_KEY`
- `AI_JOB_COPILOT_LLM_BASE_URL`（可选）
- `AI_JOB_COPILOT_OPENAI_API_KEY` / `AI_JOB_COPILOT_DASHSCOPE_API_KEY`（按需）

前端常用项：

- `NEXT_PUBLIC_BACKEND_BASE_URL`（默认 `http://127.0.0.1:8000`）
- `AI_JOB_COPILOT_RESUME_REVIEW_FREE_ANALYSES`（默认 `10`）
- `AI_JOB_COPILOT_ACCESS_COOKIE_SECRET`（生产环境必须设置）

### 4) 启动方式

方式 A：一键联调（推荐）

```bash
./dev.sh
```

方式 B：分别启动

后端：

```bash
cd backend
uv run uvicorn ai_job_copilot_backend.main:app --reload
```

前端：

```bash
cd frontend
npm run dev
```

启动后默认访问：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:8000`

## 常用命令

前端：

```bash
cd frontend
npm run lint
npm run test
npm run build
```

后端：

```bash
cd backend
uv run pytest
```

## 操作演示

- 演示视频：

<video src="frontend/demo/iShot_2026-03-22_11.25.30.mp4" controls width="960">
  你的浏览器不支持内嵌视频，请直接下载查看。
</video>

- 示例素材：
  - `frontend/demo/resume.pdf`
  - `frontend/demo/jd.txt`
