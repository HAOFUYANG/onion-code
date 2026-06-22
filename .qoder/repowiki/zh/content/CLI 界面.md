# CLI 界面

<cite>
**本文引用的文件**
- [src/agent/cli.ts](file://src/agent/cli.ts)
- [src/agent/input.ts](file://src/agent/input.ts)
- [src/agent/slash_commands.ts](file://src/agent/slash_commands.ts)
- [src/agent/agent.ts](file://src/agent/agent.ts)
- [src/agent/style.ts](file://src/agent/style.ts)
- [src/agent/sessions.ts](file://src/agent/sessions.ts)
- [src/agent/config.ts](file://src/agent/config.ts)
- [src/agent/python_env.ts](file://src/agent/python_env.ts)
- [src/agent/tools.ts](file://src/agent/tools.ts)
- [src/agent/tools/run_js.ts](file://src/agent/tools/run_js.ts)
- [src/agent/tools/run_py.ts](file://src/agent/tools/run_py.ts)
- [src/agent/tools/write_file.ts](file://src/agent/tools/write_file.ts)
- [src/agent/tools/exec.ts](file://src/agent/tools/exec.ts)
- [src/agent/tools/security.ts](file://src/agent/tools/security.ts)
- [package.json](file://package.json)
</cite>

## 更新摘要
**变更内容**
- 更新了错误消息格式化部分，移除了 DeepSeek 特定品牌标识
- 增强了工具日志功能，新增多行代码块处理能力
- 优化了导入语句格式，采用新的 ES Module 语法
- 更新了工具日志显示机制，改善了代码执行过程的可视化

## 目录
1. [简介](#简介)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能与体验特性](#性能与体验特性)
8. [故障排查指南](#故障排查指南)
9. [结论](#结论)
10. [附录：使用示例与最佳实践](#附录使用示例与最佳实践)

## 简介
本文件面向使用者与开发者，系统性阐述 CLI 界面的设计与实现，覆盖命令行交互、输入处理、流式响应显示、ESC 中断控制、斜杠命令系统（/config、/skill、/exit 等）、用户输入处理流程（文本输入、文件操作、代码执行）以及实际使用示例与最佳实践。目标是帮助用户高效、安全地使用 CLI 工具完成从日常问答到代码执行与文件管理的任务。

## 项目结构
CLI 子系统围绕"命令解析 → 输入采集 → 流式对话 → 斜杠命令处理 → 会话持久化"展开，主要文件职责如下：
- 入口与命令定义：cli.ts
- 交互式输入与补全：input.ts
- 斜杠命令与上下文：slash_commands.ts
- 对话与流式输出：agent.ts
- 视觉风格与状态提示：style.ts
- 会话查询与表格渲染：sessions.ts
- 配置中心与 Python 环境：config.ts、python_env.ts
- 工具导出与安全策略：tools.ts、tools/run_js.ts、tools/run_py.ts、tools/write_file.ts、tools/exec.ts、tools/security.ts
- 包与二进制入口：package.json

```mermaid
graph TB
CLI["cli.ts<br/>命令入口与交互循环"] --> INPUT["input.ts<br/>TTY 输入与补全"]
CLI --> SLASH["slash_commands.ts<br/>斜杠命令定义与匹配"]
CLI --> AGENT["agent.ts<br/>流式对话与模型调用"]
CLI --> STYLE["style.ts<br/>品牌与状态样式"]
CLI --> SESSIONS["sessions.ts<br/>会话查询与表格"]
CLI --> CONFIG["config.ts<br/>配置中心"]
CLI --> PYENV["python_env.ts<br/>Python 环境与包检测"]
AGENT --> TOOLS["tools.ts<br/>工具集合"]
TOOLS --> RUNJS["run_js.ts<br/>JS 执行"]
TOOLS --> RUNPY["run_py.ts<br/>Python 执行"]
TOOLS --> WRITEFILE["write_file.ts<br/>文件写入"]
TOOLS --> EXEC["exec.ts<br/>系统命令执行"]
TOOLS --> SECURITY["security.ts<br/>危险 API 检测"]
```

**图表来源**
- [src/agent/cli.ts:1-245](file://src/agent/cli.ts#L1-L245)
- [src/agent/input.ts:138-261](file://src/agent/input.ts#L138-L261)
- [src/agent/slash_commands.ts:21-92](file://src/agent/slash_commands.ts#L21-L92)
- [src/agent/agent.ts:69-95](file://src/agent/agent.ts#L69-L95)
- [src/agent/style.ts:85-134](file://src/agent/style.ts#L85-L134)
- [src/agent/sessions.ts:59-178](file://src/agent/sessions.ts#L59-L178)
- [src/agent/config.ts:71-146](file://src/agent/config.ts#L71-L146)
- [src/agent/python_env.ts:161-223](file://src/agent/python_env.ts#L161-L223)
- [src/agent/tools.ts:1-10](file://src/agent/tools.ts#L1-L10)

**章节来源**
- [src/agent/cli.ts:1-245](file://src/agent/cli.ts#L1-L245)
- [src/agent/input.ts:138-261](file://src/agent/input.ts#L138-L261)
- [src/agent/slash_commands.ts:21-92](file://src/agent/slash_commands.ts#L21-L92)
- [src/agent/agent.ts:69-95](file://src/agent/agent.ts#L69-L95)
- [src/agent/style.ts:85-134](file://src/agent/style.ts#L85-L134)
- [src/agent/sessions.ts:59-178](file://src/agent/sessions.ts#L59-L178)
- [src/agent/config.ts:71-146](file://src/agent/config.ts#L71-L146)
- [src/agent/python_env.ts:161-223](file://src/agent/python_env.ts#L161-L223)
- [src/agent/tools.ts:1-10](file://src/agent/tools.ts#L1-L10)

## 核心组件
- 命令入口与交互循环：负责解析命令、启动交互式聊天、处理 ESC 中断、展示错误与状态。
- 输入采集与补全：在 TTY 模式下提供键盘事件监听、斜杠命令面板、上下键选择、Tab 补全、Ctrl+C 退出等能力。
- 斜杠命令系统：统一的命令注册表与匹配逻辑，支持别名、帮助、会话管理、配置中心等。
- 流式对话引擎：基于 LangGraph 的流式输出，支持中断、历史续接与工具调用。
- 会话与持久化：SQLite 检查点存储，查询最近会话、渲染表格、按 thread_id 恢复。
- 配置中心与 Python 环境：交互式配置 Python 运行环境、镜像源、自动安装策略，并按需初始化虚拟环境与依赖。
- 工具集与安全：文件读写、代码执行（JS/Python）、系统命令、网络检索等；内置安全扫描与危险 API 阻断。

**章节来源**
- [src/agent/cli.ts:53-245](file://src/agent/cli.ts#L53-L245)
- [src/agent/input.ts:138-261](file://src/agent/input.ts#L138-L261)
- [src/agent/slash_commands.ts:21-92](file://src/agent/slash_commands.ts#L21-L92)
- [src/agent/agent.ts:69-95](file://src/agent/agent.ts#L69-L95)
- [src/agent/sessions.ts:59-178](file://src/agent/sessions.ts#L59-L178)
- [src/agent/config.ts:71-146](file://src/agent/config.ts#L71-L146)
- [src/agent/python_env.ts:161-223](file://src/agent/python_env.ts#L161-L223)
- [src/agent/tools.ts:1-10](file://src/agent/tools.ts#L1-L10)

## 架构总览
CLI 采用"命令层 → 输入层 → 对话层 → 工具层"的分层设计，通过 AbortSignal 实现 ESC 中断，通过 checkpointer 实现会话历史续接，通过 inquirer 提供交互式配置。

```mermaid
sequenceDiagram
participant U as "用户"
participant CLI as "cli.ts"
participant RL as "input.ts"
participant AG as "agent.ts"
participant TK as "tools.ts"
participant PY as "python_env.ts"
U->>CLI : 启动命令或直接进入交互
CLI->>RL : 读取用户输入TTY/回退
RL-->>CLI : 返回输入类型消息/命令/退出
alt 输入为斜杠命令
CLI->>CLI : 解析命令与参数
CLI->>CLI : 执行命令处理器/config,/sessions,/new,/exit 等
else 输入为普通消息
CLI->>AG : runAgentStream(消息, 回调, threadId, abortSignal)
AG->>TK : 调用工具读写/执行/搜索
TK->>PY : 按需准备 Python 环境
AG-->>CLI : 流式 token 输出
CLI-->>U : 实时显示回复
end
note over CLI : ESC 设置 AbortSignal 中断流式输出
```

**图表来源**
- [src/agent/cli.ts:79-245](file://src/agent/cli.ts#L79-L245)
- [src/agent/input.ts:138-261](file://src/agent/input.ts#L138-L261)
- [src/agent/agent.ts:69-95](file://src/agent/agent.ts#L69-L95)
- [src/agent/tools.ts:1-10](file://src/agent/tools.ts#L1-L10)
- [src/agent/python_env.ts:161-223](file://src/agent/python_env.ts#L161-L223)

## 详细组件分析

### 命令入口与交互循环（cli.ts）
- 支持子命令 ask 与默认交互模式；交互模式下维护 threadId 并持续读取输入。
- ESC 中断：设置 raw 模式监听数据，遇到 ASCII 27（ESC）触发 AbortController.abort，输出"已停止"提示。
- **错误消息格式化**：改进了错误消息格式化，移除了 DeepSeek 特定品牌标识，改为更通用的错误提示格式，针对不同异常（内容安全、认证、配额、递归限制、超时）给出友好提示。
- **工具日志增强**：新增工具调用日志功能，支持多行代码块的行数统计显示，提供更丰富的执行过程可视化。
- **导入语句优化**：采用新的 ES Module 语法导入 package.json，使用 `import pkg from "..." with { type: "json" }` 格式。

**章节来源**
- [src/agent/cli.ts:27-63](file://src/agent/cli.ts#L27-L63)
- [src/agent/cli.ts:167-184](file://src/agent/cli.ts#L167-L184)
- [src/agent/cli.ts:20-21](file://src/agent/cli.ts#L20-L21)

### 输入处理与补全（input.ts）
- TTY 模式：启用按键事件、raw 模式，渲染斜杠命令面板，支持上下键选择、Tab 补全、Esc 关闭、Ctrl+U 清空、Backspace 删除等。
- 回退模式：在非 TTY 环境使用 readline 问答式输入，支持 exit 退出。
- 命令解析：以 "/" 开头的输入进行斜杠命令匹配，支持别名与模糊前缀匹配；解析命令后的参数部分。

**章节来源**
- [src/agent/input.ts:138-261](file://src/agent/input.ts#L138-L261)

### 斜杠命令系统（slash_commands.ts）
- 命令注册：统一的 SlashCommand 接口，支持 name、aliases、description、handler。
- 内置命令：
  - /config：打开配置中心（Python 运行环境、镜像源、自动安装策略）。
  - /rewind <thread_id>：切换到指定历史会话。
  - /sessions：查看最近 20 条会话。
  - /new：新建会话。
  - /theme：占位命令（提示暂未实现）。
  - /help：打印可用斜杠命令。
  - /exit：退出程序。
- 命令匹配：根据输入前缀与别名进行筛选，支持 Tab 补全与上下选择。

**章节来源**
- [src/agent/slash_commands.ts:21-92](file://src/agent/slash_commands.ts#L21-L92)

### 流式对话与 ESC 中断（agent.ts）
- 流式输出：基于 LangGraph 的 streamMode="messages"，逐个 token 回调 onToken。
- 中断机制：接收 AbortSignal，当 aborted 时提前结束循环，保证 ESC 及时生效。
- 历史续接：通过 configurable.thread_id 续接会话历史，recursionLimit 控制最大步数。
- 工具集成：搜索、读写文件、执行代码、系统命令、网络检索、技能加载等。

**章节来源**
- [src/agent/agent.ts:69-95](file://src/agent/agent.ts#L69-L95)

### 会话管理与持久化（sessions.ts）
- 会话查询：从 SQLite 检查点数据库中提取最近 N 条会话，按活跃度排序。
- 会话表格：渲染 thread_id、最后用户输入（截断）、相对时间。
- thread_id 校验：确认目标会话是否存在，用于 /rewind 命令。

**章节来源**
- [src/agent/sessions.ts:59-178](file://src/agent/sessions.ts#L59-L178)

### 配置中心与 Python 环境（config.ts、python_env.ts）
- 配置中心：交互式选择模块（Python/pip 镜像源、自动安装策略），保存到 .data/config.json。
- Python 环境：检测基础 Python3、创建虚拟环境、安装缺失包、缓存路径；按代码需求动态检测 pandas/numpy/openpyxl 并安装。
- 运行时选择：优先使用虚拟环境中的 Python，否则回退到系统 Python。

**章节来源**
- [src/agent/config.ts:71-146](file://src/agent/config.ts#L71-L146)
- [src/agent/python_env.ts:161-223](file://src/agent/python_env.ts#L161-L223)

### 工具与安全（tools.ts、run_js.ts、run_py.ts、write_file.ts、exec.ts、security.ts）
- 工具导出：集中导出所有工具，便于 agent.ts 注入。
- **run_js**：Node.js 可用性检查、危险 API 阻断、临时文件执行、输出捕获与清理。
- **run_py**：Python 运行时选择、危险 API 阻断、临时文件执行、输出捕获与清理。
- **write_file**：路径安全检查（防止目录外写入）、内容危险 API 阻断、UTF-8 写入与错误反馈。
- **exec**：系统命令执行工具，包含危险命令黑名单、eval 模式检测、危险 API 调用模式检测。
- **security**：危险 API 调用模式检测，提供共享的危险 API 检测功能。

**章节来源**
- [src/agent/tools.ts:1-10](file://src/agent/tools.ts#L1-L10)
- [src/agent/tools/run_js.ts:22-89](file://src/agent/tools/run_js.ts#L22-L89)
- [src/agent/tools/run_py.ts:11-94](file://src/agent/tools/run_py.ts#L11-L94)
- [src/agent/tools/write_file.ts:7-54](file://src/agent/tools/write_file.ts#L7-L54)
- [src/agent/tools/exec.ts:1-109](file://src/agent/tools/exec.ts#L1-L109)
- [src/agent/tools/security.ts:1-26](file://src/agent/tools/security.ts#L1-L26)

### 工具日志系统（style.ts）
- **工具调用日志**：生成带颜色图标和详情的工具调用日志，支持每个工具有独立图标和颜色。
- **多行代码块处理**：新增 `toolLogLines` 函数，专门处理多行代码块的行数统计和显示，提供更丰富的执行过程可视化。
- **详细信息截断**：对工具调用的详细信息进行截断处理，避免过长信息影响界面显示。

**章节来源**
- [src/agent/style.ts:85-134](file://src/agent/style.ts#L85-L134)

## 依赖关系分析
- CLI 依赖输入层、斜杠命令、对话引擎、样式、会话与配置模块。
- 对话引擎依赖工具集与 Python 环境模块。
- 工具集依赖安全扫描与 Python 环境模块。

```mermaid
graph LR
CLI["cli.ts"] --> INPUT["input.ts"]
CLI --> SLASH["slash_commands.ts"]
CLI --> AGENT["agent.ts"]
CLI --> STYLE["style.ts"]
CLI --> SESSIONS["sessions.ts"]
CLI --> CONFIG["config.ts"]
CONFIG --> PYENV["python_env.ts"]
AGENT --> TOOLS["tools.ts"]
TOOLS --> RUNJS["run_js.ts"]
TOOLS --> RUNPY["run_py.ts"]
TOOLS --> WRITEFILE["write_file.ts"]
TOOLS --> EXEC["exec.ts"]
TOOLS --> SECURITY["security.ts"]
```

**图表来源**
- [src/agent/cli.ts:1-245](file://src/agent/cli.ts#L1-L245)
- [src/agent/input.ts:1-261](file://src/agent/input.ts#L1-L261)
- [src/agent/slash_commands.ts:1-92](file://src/agent/slash_commands.ts#L1-L92)
- [src/agent/agent.ts:1-95](file://src/agent/agent.ts#L1-L95)
- [src/agent/style.ts:1-217](file://src/agent/style.ts#L1-L217)
- [src/agent/sessions.ts:1-178](file://src/agent/sessions.ts#L1-L178)
- [src/agent/config.ts:1-146](file://src/agent/config.ts#L1-L146)
- [src/agent/python_env.ts:1-223](file://src/agent/python_env.ts#L1-L223)
- [src/agent/tools.ts:1-10](file://src/agent/tools.ts#L1-L10)
- [src/agent/tools/run_js.ts:1-89](file://src/agent/tools/run_js.ts#L1-L89)
- [src/agent/tools/run_py.ts:1-94](file://src/agent/tools/run_py.ts#L1-L94)
- [src/agent/tools/write_file.ts:1-54](file://src/agent/tools/write_file.ts#L1-L54)
- [src/agent/tools/exec.ts:1-109](file://src/agent/tools/exec.ts#L1-L109)
- [src/agent/tools/security.ts:1-26](file://src/agent/tools/security.ts#L1-L26)

## 性能与体验特性
- 流式输出：边生成边显示，降低感知延迟。
- ESC 中断：即时终止长文本生成，提升交互效率。
- TTY 优化：键盘事件直连，命令面板与补全减少重复输入。
- 会话续接：基于 SQLite 检查点，避免重复计算与上下文丢失。
- Python 环境按需初始化：仅在需要时创建虚拟环境与安装依赖，减少冷启动成本。
- **增强的工具日志**：提供更丰富的工具执行过程可视化，包括多行代码块的行数统计显示。

## 故障排查指南
- **API Key/认证失败**：检查 OPENAI_API_KEY 或代理配置，参考错误格式化提示。
- **额度不足/429**：检查账户余额与配额，等待重试。
- **内容安全拦截**：安全审查触发，更换表述或简化查询。
- **网络超时**：检查网络与代理，重试请求。
- **递归限制**：任务过于复杂，建议拆分为多步执行。
- **ESC 不生效**：确认在 TTY 模式下运行，raw 模式已启用。
- **/rewind 无法切换**：先用 /sessions 获取 thread_id，再执行 /rewind <thread_id>。
- **Python/Node 不可用**：/config 中启用自动安装或手动安装对应运行时。
- **工具执行失败**：检查危险 API 检测规则，避免使用被阻断的操作。

**章节来源**
- [src/agent/cli.ts:28-63](file://src/agent/cli.ts#L28-L63)
- [src/agent/slash_commands.ts:32-42](file://src/agent/slash_commands.ts#L32-L42)
- [src/agent/sessions.ts:42-56](file://src/agent/sessions.ts#L42-L56)

## 结论
该 CLI 界面以清晰的分层设计实现了从输入到流式输出的完整链路，结合斜杠命令系统与会话持久化，既满足日常问答，又支持文件与代码执行等高级能力。ESC 中断与 TTY 优化显著提升了交互体验；配置中心与 Python 环境按需初始化保障了易用性与安全性。最新的改进包括移除特定品牌标识的错误消息格式化、增强工具日志功能以提供更好的执行过程可视化，以及优化导入语句格式以提升代码质量。

## 附录：使用示例与最佳实践

### 基本使用
- 启动交互：直接运行命令进入交互模式，输入任意文本发起对话。
- 单轮问答：使用 ask 子命令快速获得一次性回答。
- 退出：输入 exit 或使用 /exit 命令退出。

**章节来源**
- [src/agent/cli.ts:65-83](file://src/agent/cli.ts#L65-L83)

### 斜杠命令速览与示例
- /config：打开配置中心，设置 Python 镜像源、自动安装策略，可立即初始化常用数据分析包。
- /sessions：查看最近 20 条会话，复制 thread_id。
- /rewind <thread_id>：切换到指定历史会话继续对话。
- /new：新建会话，清空历史。
- /help：列出所有斜杠命令及简要说明。
- /exit：退出程序。

**章节来源**
- [src/agent/slash_commands.ts:21-77](file://src/agent/slash_commands.ts#L21-L77)
- [src/agent/sessions.ts:59-178](file://src/agent/sessions.ts#L59-L178)

### ESC 中断控制
- 在对话过程中按 ESC 可立即中断生成，避免长时间等待。
- 中断后会输出"已停止"，随后可继续输入新消息或执行命令。

**章节来源**
- [src/agent/cli.ts:140-148](file://src/agent/cli.ts#L140-L148)

### 文本输入与文件操作
- 文本输入：在交互模式下直接输入消息，支持多行输入（TTY 下的自然输入）。
- 文件写入：使用工具写入文件，注意路径必须位于当前目录内，且内容不得包含危险 API。
- 读取文件：通过工具读取文件内容，支持 UTF-8 编码。
- 系统命令：使用工具执行 shell 命令（如 ls、pwd、git），谨慎使用以避免风险。

**章节来源**
- [src/agent/tools/write_file.ts:7-54](file://src/agent/tools/write_file.ts#L7-L54)
- [src/agent/agent.ts:69-95](file://src/agent/agent.ts#L69-L95)

### 代码执行（JS/Python）
- **JS 执行**：使用 run_js 工具，推荐通过工具调用而非手动拼接命令；代码需使用 console.log 输出结果。
- **Python 执行**：使用 run_py 工具，自动检测并安装所需包（pandas/numpy/openpyxl），推荐通过工具调用而非手动拼接命令。
- **安全策略**：内置危险 API 阻断（如 fs.rmSync、child_process、shutil.rmtree 等），禁止直接执行高危操作。
- **执行过程可视化**：工具执行过程会在界面上显示详细的日志信息，包括代码行数统计等。

**章节来源**
- [src/agent/tools/run_js.ts:22-89](file://src/agent/tools/run_js.ts#L22-L89)
- [src/agent/tools/run_py.ts:11-94](file://src/agent/tools/run_py.ts#L11-L94)
- [src/agent/python_env.ts:161-223](file://src/agent/python_env.ts#L161-L223)

### 工具日志与执行监控
- **工具调用日志**：每个工具调用都会在界面上显示详细的执行信息，包括工具名称、参数详情等。
- **多行代码块处理**：对于 JS/Python 代码执行，会显示代码的行数统计，便于了解执行规模。
- **实时进度反馈**：工具执行过程中的详细信息会实时显示，提供良好的用户体验。

**章节来源**
- [src/agent/style.ts:85-134](file://src/agent/style.ts#L85-L134)
- [src/agent/cli.ts:167-184](file://src/agent/cli.ts#L167-L184)

### 最佳实践
- 使用 /sessions 查看历史会话，必要时用 /rewind 切换到合适上下文。
- 对于复杂任务，建议拆分为多步执行，避免超过递归限制。
- Python 代码尽量显式导入所需库，以便自动检测与安装依赖。
- JS/Python 代码应避免高危 API，遵循工具的安全约束。
- 在 TTY 模式下使用 ESC 中断，提高交互效率。
- 通过 /config 调整 Python 镜像源与自动安装策略，提升开发体验。
- 利用工具日志功能监控代码执行过程，及时发现问题。