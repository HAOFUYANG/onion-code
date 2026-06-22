该仓库未引入专用的日志框架（如 `pino`、`winston` 或 `bunyan`），而是采用 Node.js 原生的 `console` 对象配合终端样式库（`chalk`、`ink`）进行日志与状态输出。

### 1. 核心实现方式
- **标准输出流**：主要使用 `console.log` 和 `process.stdout.write` 输出常规信息。在交互界面（TUI）中，为了精确控制光标和渲染，大量使用 `process.stdout.write` 配合 `ink` 的 React 组件。
- **错误处理**：使用 `console.error` 输出格式化后的错误提示。在 `src/agent/cli.ts` 中定义了 `formatError` 函数，将常见的 API 错误（如 401、429、超时等）转换为友好的用户提示。
- **样式化输出**：通过 `src/agent/style.ts` 定义了一系列样式前缀（如 `status.error`、`assistantPrefix`），结合 `chalk` 库实现不同颜色（红、绿、紫等）的状态标识。

### 2. 关键文件
- `src/agent/cli.ts`：入口文件，负责捕获未处理的异常并调用 `console.error` 输出。
- `src/agent/config.ts`：配置模块，使用 `console.log` 输出配置加载、保存及 Python 环境初始化的状态反馈。
- `src/agent/style.ts`：集中管理输出样式，确保日志视觉风格统一。

### 3. 开发约定
- **禁止裸奔 console**：在业务逻辑中应优先使用 `style.ts` 提供的样式函数，避免直接使用无样式的 `console.log`，以保持 TARS 风格的终端体验。
- **流式输出**：在 Agent 执行过程中，通过回调函数 `onToken` 直接将内容写入 `process.stdout`，以实现低延迟的打字机效果。
- **错误友好化**：所有抛出的 Error 对象在输出前应经过 `formatError` 处理，向用户展示可操作的解决方案而非原始堆栈。