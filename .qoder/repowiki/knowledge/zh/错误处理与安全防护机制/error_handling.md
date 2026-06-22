该项目采用**防御性编程与集中式安全拦截**相结合的错误处理策略。核心逻辑不依赖复杂的自定义 Error 类，而是通过 `try-catch` 捕获底层异常，并将其转化为结构化的字符串返回给 Agent 或 CLI 层进行展示。

### 1. 核心架构与模式
- **工具层（Tools）统一返回模式**：所有 LangChain 工具（如 `exec`, `run_py`, `web_fetch`）均采用 `async/await` 配合 `try-catch`。执行成功返回结果字符串，失败则返回以 `Error:` 开头的描述性字符串。这种模式避免了抛出未捕获的异常导致 Agent 崩溃。
- **CLI 层友好提示**：在入口文件 `src/agent/cli.ts` 中定义了 `formatError` 函数，负责将底层抛出的原始错误（如 API 401、超时、递归限制）映射为用户可读的中文提示。
- **安全防护前置**：在执行任何系统命令或写入文件前，通过 `security.ts` 中的正则表达式库进行静态扫描，拦截危险操作（如 `rm -rf`, `shutil.rmtree`）。

### 2. 关键错误分类与处理
- **网络与 API 错误**：
  - `web_fetch.ts`：针对 `AbortError` (超时)、`ENOTFOUND` (DNS)、`ECONNREFUSED` 等进行了细致的分支处理。
  - `cli.ts`：识别 DeepSeek/OpenAI 常见的 `insufficient_quota` (429) 和 `Incorrect API key` (401)。
- **执行环境错误**：
  - `python_env.ts`：通过 `spawnSync` 检查 Python 解释器状态及依赖包缺失情况，返回包含 `ok: boolean` 和 `error: string` 的结果对象。
  - `exec.ts` / `run_js.ts`：捕获子进程退出码非 0 的情况，并优先提取 `stderr` 作为错误信息。
- **资源管理**：
  - `sessions.ts`：在使用 SQLite 数据库时，严格遵循 `try-finally` 模式确保数据库连接在任何情况下都能被正确关闭，防止文件锁死。

### 3. 开发者约定
- **禁止静默失败**：所有 `catch` 块必须返回明确的错误描述，严禁吞掉异常而不反馈。
- **临时文件清理**：涉及临时文件的操作（如 `run_py.ts`）必须在 `finally` 块中执行清理逻辑。
- **安全优先**：新增工具若涉及文件系统或子进程，必须引入 `security.ts` 中的 `hasDangerousApi` 或 `isDangerousByCommand` 进行预检。