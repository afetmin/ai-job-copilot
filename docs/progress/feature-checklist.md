# 功能点进度记录

状态说明：
- `pending`：未开始
- `in_progress`：进行中
- `awaiting_review`：已完成，等待你审核
- `approved`：你已审核通过
- `blocked`：阻塞中

## 当前执行规则
- 只允许同时推进一个功能点。
- 每次完成后，必须先更新本文件，再等待审核意见。
- 未经你明确批准，不进入下一项。

## 功能点列表
| 功能点 | 名称 | 状态 | 说明 |
| --- | --- | --- | --- |
| F0 | 项目骨架与执行机制 | approved | 目录结构和拆分顺序已确认 |
| F1 | 后端基础骨架 | in_progress | 正在搭建 FastAPI、配置、schema 与 provider 抽象 |
| F2 | 文档录入 Provider 框架 | pending |  |
| F3 | PDF 录入 Provider | pending |  |
| F4 | Chroma 索引与检索 | pending |  |
| F5 | 面试题生成链路 | pending |  |
| F6 | Next.js 前端骨架 | pending |  |
| F7 | 文档上传与生成界面 | pending |  |
| F8 | Vercel AI SDK 生成接口 | pending |  |
| F9 | 题目追问聊天 | pending |  |
| F10 | 验证与部署准备 | pending |  |

## 审核记录
| 功能点 | 结果 | 备注 |
| --- | --- | --- |
| F0 | approved | 你已批准继续执行，进入 F1 |
