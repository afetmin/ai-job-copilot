# AI 求职副驾实施计划

## 目标
构建一个单用户、可部署的 Web 产品，输入简历和 JD，输出面试问题、追问和参考回答，并支持围绕题目继续追问。

## 技术栈
- 前端：Next.js
- 模型接入：Vercel AI SDK
- 后端：Python + FastAPI
- RAG 编排：LangChain
- 向量库：Chroma
- 数据模型：Pydantic

## 执行规则
1. 功能点必须按顺序执行。
2. 每完成一个功能点后，先更新进度记录，再等待人工审核。
3. 审核通过后，才进入下一个功能点。
4. 若某个功能点存在 blocker，暂停执行并记录问题。

## 功能拆分

### F0. 项目骨架与执行机制
目标：建立项目目录、计划文件、进度文件，确定审核节奏。
交付：
- 项目根目录
- 计划文档
- 功能进度追踪文档

### F1. 后端基础骨架
目标：建立 FastAPI 项目骨架、配置结构、Pydantic 模型基础、provider 接口定义。
交付：
- FastAPI 应用入口
- settings/config 模块
- 基础 request/response schemas
- `InputProvider`、`EmbeddingProvider`、`RetrievalProvider` 抽象
- 代码注释和 docstring 规范

### F2. 文档录入 Provider 框架
目标：完成统一文档录入主流程，支持 provider 注册和调度。
交付：
- 标准化 `DocumentInput` / `ParsedDocument` 领域模型
- provider registry
- ingestion service
- 文本输入 provider

### F3. PDF 录入 Provider
目标：支持 PDF 简历和 JD 上传解析，并接入统一 ingestion 主流程。
交付：
- PDF provider
- PDF 解析失败兜底
- 文本与 PDF 统一输出结构

### F4. Chroma 索引与检索
目标：打通 chunking、embedding、Chroma 持久化和 retrieval。
交付：
- chunking service
- embedding 调用
- Chroma 存储
- retrieval context 输出

### F5. 面试题生成链路
目标：基于简历和 JD 的检索结果生成结构化面试包。
交付：
- interview pack generation service
- 题目、追问、参考回答的结构化输出
- 引用来源拼装

### F6. Next.js 前端骨架
目标：建立前端项目骨架、密码门、基础页面结构。
交付：
- 首页/登录页
- 工作台页面
- 结果页基础布局
- session 校验

### F7. 文档上传与生成界面
目标：完成简历/JD 文本粘贴、PDF 上传、生成按钮和状态展示。
交付：
- 上传表单
- 文本输入区域
- 进度和错误提示
- 调用后端 ingestion 的前端逻辑

### F8. Vercel AI SDK 生成接口
目标：用 Vercel AI SDK 串起模型调用，支持面试包流式生成。
交付：
- Next.js AI route
- 多模型 provider 配置入口
- 调用 FastAPI retrieval context
- 流式渲染

### F9. 题目追问聊天
目标：围绕单道题继续追问，保持上下文和引用来源。
交付：
- follow-up chat route
- 题目上下文传递
- 追问 UI

### F10. 验证与部署准备
目标：补齐关键验证，整理环境变量与部署说明。
交付：
- 关键流程验证
- 本地运行说明
- 部署变量清单
- 风险和后续扩展说明
