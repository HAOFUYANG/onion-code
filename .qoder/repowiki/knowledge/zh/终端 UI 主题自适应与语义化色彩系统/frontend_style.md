## 1. 核心系统与策略
该项目采用 **Ink** 作为终端 UI 渲染引擎，并基于 **@inkjs/ui** 组件库构建交互界面。其前端样式的核心在于一套**自研的终端主题自适应系统**（`src/ink/theme/index.ts`），能够根据终端背景色（深色/浅色）自动切换配色方案，确保在不同环境下的高对比度和可读性。

### 关键特性：
- **环境感知**：通过检测 `COLORFGBG`、`TERM_PROGRAM` 等环境变量，智能识别终端是处于 Dark Mode 还是 Light Mode。
- **语义化设计令牌 (Design Tokens)**：定义了 `primary`（主强调）、`accent`（次强调）、`cancel`（错误/中断）、`textBold/Muted/Subtle`（文本层级）等语义 Token，而非硬编码颜色值。
- **双模式色板**：为 Dark 和 Light 模式分别定义了两套经过对比度调优的色板。例如，Light 模式下使用更深的蓝色 (`#2563eb`) 以保证在白底上的辨识度。

## 2. 架构与组织方式
样式逻辑被高度模块化，主要分为以下三个层次：

1.  **主题层 (`src/ink/theme/index.ts`)**：
    -   导出 `T` 对象，包含所有语义化颜色。
    -   提供 `detectTerminalMode()` 函数作为运行时检测入口。
    -   定义了标题渐变色 `titleGradient`，用于首页大标题。

2.  **组件层 (`src/ink/components/*.tsx`)**：
    -   **Thread.tsx**：对话界面的核心。利用 `T` 对象动态设置边框颜色 (`borderColor={T.primary}`)、背景色 (`backgroundColor={T.homeBg}`) 以及 Slash 命令面板的高亮样式。
    -   **Dialog.tsx**：通用对话框组件。支持 `tone` 属性（info/success/danger），根据语义自动映射到 `T.primary`、`T.accent` 或 `T.cancel`。
    -   **ConfigPanel.tsx**：配置面板。统一使用 `T.textMuted` 处理说明文字，保持视觉层级一致。

3.  **CLI 样式层 (`src/agent/style.ts`)**：
    -   针对非 Ink 渲染的纯 CLI 输出（如启动画面 Splash Screen、工具调用日志），使用 **Chalk** 和 **Figlet**。
    -   定义了独立的 CLI 主题色（如 `primary: "#C026D3"`），并实现了渐变色文本生成工具 `gradientText`。
    -   为不同工具（exec, run_py, web_search 等）分配了专属图标和颜色，形成统一的日志视觉规范。

## 3. 开发规范与约定
-   **禁止硬编码颜色**：在 Ink 组件中，必须从 `src/ink/theme/index.ts` 导入 `T` 并使用其属性（如 `T.textBold`），严禁直接使用 `color="white"` 或 hex 值。
-   **语义优先**：选择颜色时应根据文本或元素的语义（主要操作、辅助信息、错误提示）选择对应的 Token，而不是根据颜色外观。
-   **Markdown 渲染适配**：在 `Thread.tsx` 中，`markdansi` 的主题会根据 `terminalMode` 自动切换为 `dim`（浅色终端）或 `bright`（深色终端），开发者无需手动干预，但需知晓此行为。
-   **CLI 与 GUI 分离**：`src/agent/style.ts` 中的样式仅用于 `console.log` 或标准输出流；`src/ink/` 下的样式仅用于 Ink 渲染的交互式界面。两者虽然视觉风格相似（都偏向紫色/品红系），但技术实现完全隔离。

## 4. 关键文件索引
-   `src/ink/theme/index.ts`: 全局主题配置、色板定义、终端模式检测。
-   `src/ink/App.tsx`: 根组件，通过 `extendTheme` 将自定义色板注入 `@inkjs/ui` 的全局主题。
-   `src/ink/components/Thread.tsx`: 核心对话界面，展示了如何在复杂布局中应用主题。
-   `src/agent/style.ts`: CLI 命令行输出的样式工具集（启动横幅、日志图标等）。