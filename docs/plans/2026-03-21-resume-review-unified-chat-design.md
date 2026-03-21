# Resume Review Unified Chat Design

## 目标
- 把 `resume review` 结果页从“首轮分析 + 后续占位追问”重构成统一的聊天工作区。
- 保留 `workspace` 页的文档入库和请求准备职责，不在提交页直接发起模型生成。
- 支持“无本地模型配置时先免费试用，超额后再要求 BYOK”，并且结果页支持流式继续追问。

## 当前问题
- 后端把首轮分析和后续对话拆成不同链路，接口职责不统一。
- 前端结果页只有 `initial_analysis` 的自动流式逻辑，输入框和发送按钮仍是占位状态。
- 免费额度扣减绑定在旧的 `analysis` 代理路由上，后续如果补聊天接口会出现重复控制逻辑。
- IndexedDB 里的消息模型带有 `initial_analysis` / `follow_up` 特殊类型，不利于统一消息流。

## 设计结论
- 采用“单一 chat 流”架构，统一承载首轮分析与后续追问。
- `workspace` 页只负责准备 review 所需文档 ID 和结果页跳转，不直接触发模型调用。
- `results` 页首次加载时自动插入一条固定的首轮用户消息，并调用统一的 chat 代理路由。
- 免费额度只在“未配置本地模型且 chat 请求成功发往上游”时扣减。

## 后端架构

### 统一 chat 路由
- 新增 `POST /api/resume-reviews/chat/stream`。
- 请求体包含：
  - `review_id`
  - `request_id`
  - `resume_document_id`
  - `job_description_document_id`
  - `suggestion_count`
  - `target_role`
  - `messages`
  - `runtime_model_config`
- `messages` 使用统一聊天消息结构，至少包含 `role` 和 `content`。
- 结果页首次进入时，前端自动发送一条固定的用户消息作为首轮分析触发器；后续追问复用同一路由。

### SSE 事件
- 统一为一组 chat 事件：
  - `start`
  - `context`
  - `citation`
  - `delta`
  - `done`
  - `error`
- `context` 负责返回本轮检索摘要，例如 resume/JD chunk 数和 focus points。
- `citation` 和 `delta` 继续用于边生成边展示 assistant 消息。
- `done` 表示本轮 assistant 消息结束，不再区分“初始分析 done”和“追问 done”。

### Prompt 与检索
- 后端使用一个统一 chat prompt builder，根据 `messages` 和当前模式组织 prompt。
- 首轮自动消息走 `initial_review` 语义，要求输出整体匹配度、主要问题和修改建议。
- 后续追问走 `follow_up` 语义，优先回答当前问题并延续已有上下文，不重复整份报告。
- 检索仍然同时查询 `resume` 与 `job_description` 两类文档。
- 本轮先不引入复杂的 query rewrite，只用“当前用户消息 + targetRole”组织检索查询，保持实现收敛。

## 前端架构

### 结果页工作流
- `ResultsWorkspace` 继续负责从 session storage 和 IndexedDB 恢复 review。
- 如果当前 review 还没有任何 assistant 消息，则自动：
  - 写入首轮 user 消息
  - 创建空的 assistant streaming 消息
  - 调用 `/api/resume-reviews/chat`
- 如果 review 已有消息，则直接渲染现有对话，不再触发额外的“首轮分析专属”逻辑。

### 消息模型
- Dexie 层保留 `user` / `assistant` / `system` 三种 `role`。
- `kind` 收缩为更通用的语义，不再依赖 `initial_analysis` 作为特殊分支。
- 消息状态仍使用 `streaming` / `done` / `error`。
- 一个 `review` 在本轮 MVP 中只对应一条连续消息流，不引入 `conversationId`。

### 交互规则
- 输入框和发送按钮改为真实可用。
- 用户发送时，先持久化 user 消息，再创建 assistant streaming 消息接收 SSE。
- 同一 `review` 有流式请求进行中时禁用再次发送，避免并发消息竞争。
- 错误状态写回 IndexedDB，并在结果页顶部继续展示明确错误反馈。

## 免费额度与 BYOK
- `create` 路由不消耗免费次数，因为它只负责文档入库。
- 统一 chat 代理路由读取 access cookie：
  - 有本地模型配置时，不扣免费额度。
  - 无本地模型配置且额度耗尽时，直接返回 `403`。
  - 无本地模型配置且本次上游请求成功时，扣减一次免费额度。
- 旧的 `analysis` 代理路由和对应前端调用可以移除；如果保留一轮兼容，也不再作为主链路。

## 保留项
- 不改 `workspace` 表单字段名、校验规则和提交流程。
- 不把会话持久化迁移到服务端，仍然使用 IndexedDB 保存 review 与消息。
- 不在本轮引入多线程 conversation、消息编辑、消息删除、流式取消等扩展能力。

## 非目标
- 不重做整体视觉语言，只补齐结果页真实聊天交互。
- 不重构文档入库、向量检索和 provider 配置体系。
- 不在本轮支持跨设备同步和服务端聊天历史。

## 验收标准
- 用户从 `workspace` 提交后跳到结果页，会自动收到首轮流式分析消息。
- 用户在结果页输入追问并发送后，能看到新的 user/assistant 消息并流式更新。
- 未配置本地模型时，免费试用次数只在真实 chat 请求成功时扣减。
- 已配置本地模型时，结果页首轮分析和后续追问都不消耗免费额度。
- 后端和前端测试覆盖统一 chat 路由、结果页自动首轮消息、后续追问和额度拦截。
