该仓库未建立统一的日志系统（如 Winston、Pino 或 Bunyan），而是采用 Node.js 原生的 `console` 对象进行分散式的日志输出和错误报告。

### 1. 核心实现方式
- **原生 Console**：所有日志均通过 `console.log`（信息/状态）、`console.error`（错误/异常）直接输出到标准流。
- **CLI 交互层**：在 `src/ui/main.ts` 中，利用 `process.stdout.write` 实现流式对话的实时渲染，仅在捕获全局异常时使用 `console.error` 打印错误堆栈或消息。
- **配置与初始化**：在 `src/agent/config.ts` 等模块中，使用 `chalk` 库对 `console.log` 的输出进行着色（如绿色表示成功、红色表示失败），以增强终端可读性。

### 2. 架构特征
- **无结构化日志**：日志内容多为纯文本字符串，缺乏统一的 JSON 结构化字段（如 timestamp, level, module 等），不利于外部日志采集工具的分析。
- **无等级管理**：没有定义 `DEBUG`, `INFO`, `WARN`, `ERROR` 等日志等级的过滤机制，所有输出默认都会显示在终端。
- **安全工具反馈**：在 `exec.ts`、`run_py.ts` 等工具模块中，执行错误或安全拦截信息通过返回字符串的形式传递给 Agent，而非通过日志框架记录。

### 3. 开发者约定
- **错误处理**：在异步流程的顶层（如 `askCommand`）统一捕获错误并使用 `console.error` 输出，随后调用 `process.exit(1)` 终止进程。
- **流式输出**：对于 Agent 的回复，严禁使用 `console.log`，必须通过回调函数配合 `process.stdout.write` 逐字输出以避免换行符干扰。
- **临时调试**：目前代码中存在少量用于调试的 `console.log`（如在测试文件或环境检测逻辑中），在生产环境下应保持克制。