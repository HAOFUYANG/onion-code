## 1. 使用的系统与方式
- **无专用日志框架**：仓库内未引入 `pino`、`winston`、`bunyan`、`log4js` 等日志库，也未封装统一的 logger 模块。
- **以控制台输出为主**：错误与状态信息通过 `console.error` / `process.stdout.write` 输出；工具执行结果通过返回字符串承载“Error: ...”前缀，由上层 UI/CLI 渲染。
- **结构化程度低**：没有统一的日志级别策略、字段规范或 JSON 结构化输出；多为直接拼接文本或样式化字符串。

## 2. 关键文件与位置
- **CLI 入口与错误呈现**：`src/agent/cli.ts`
  - 单轮问答模式下，捕获异常后使用 `console.error(status.error(formatError(err)))` 输出友好错误。
  - 交互模式下通过 Ink 应用退出回调输出告别信息（`status.bye`）。
- **Agent 流式执行**：`src/agent/agent.ts`
  - `runAgentStream` 通过 `onToken` 回调将 token 推给调用方，本身不写日志。
  - 工具调用通过 `onToolCall` 回调通知上层，同样不落地日志。
- **Ink 运行时适配**：`src/ink/runtime/adapter.ts`
  - 将 `runAgentStream` 的错误保存到 `streamError`，最终 `throw streamError`，由上层统一处理展示，不在适配器内打印日志。
- **工具层错误封装**：
  - `src/agent/tools/exec.ts`、`src/agent/tools/run_js.ts`、`src/agent/tools/run_py.ts`
  - 通过 `try/catch` 捕获执行异常，返回带 `Error:` 前缀的字符串，作为“工具输出”而非日志。

## 3. 架构与约定
- **“错误即数据”模式**：工具层不直接写日志，而是把错误信息作为返回值返回，由 Agent/UI 决定如何呈现。这减少了分散的 `console.log`，但也导致缺乏可观测性（无法集中采集、过滤、分级）。
- **CLI 层负责最终呈现**：`cli.ts` 是少数直接使用 `console.error` 的地方，负责将内部错误转换为对用户友好的提示。
- **无持久化日志**：`.data/checkpointer.db` 仅用于 LangGraph 会话检查点，不存储运行日志或审计信息。

## 4. 开发者应遵循的规则与建议
- **当前事实规则**：
  - 不要在工具实现中随意使用 `console.log/warn/error`；如需反馈问题，优先通过返回值携带 `Error:` 前缀消息。
  - CLI 入口（`cli.ts`）是集中格式化错误的地方，新增错误类型应在 `formatError` 中补充映射。
- **推荐演进方向（若需要可观测性）**：
  - 引入轻量日志库（如 `pino`），在 `src/agent` 下创建统一 logger 实例，定义基础字段（`timestamp`、`level`、`module`、`threadId`、`toolName`）。
  - 在 `runAgentStream` 和 `createLangchainAdapter` 中记录关键事件：开始/结束、工具调用、异常堆栈。
  - 区分“用户可见消息”与“运维日志”：用户消息走 UI/CLI 渲染，运维日志走 logger，避免混用 `console`。
