## 1. 核心系统与工具
该项目采用 **Ink** (React for CLI) 作为主要的终端用户界面渲染引擎，结合 **@assistant-ui/react-ink** 实现类聊天应用的交互逻辑。视觉样式完全通过代码定义，不依赖外部 CSS 文件。

- **渲染引擎**: `ink` (v7.x) + `react` (v19.x)
- **UI 组件库**: `@assistant-ui/react-ink` (提供 Thread, Composer, Message 等原子组件)
- **样式工具**: `chalk` (终端颜色), `figlet` (ASCII 艺术字), `boxen` (边框盒子)
- **字体处理**: 使用 `figlet` 加载 "Doom" 字体（实体块字符）生成品牌标识。

## 2. 设计令牌 (Design Tokens)
在 `src/agent/style.ts` 和 `src/agent/ui/Thread.tsx` 中定义了统一的颜色常量，形成了鲜明的“赛博朋克”或“霓虹”风格：

- **主色调**: 
  - `primary`: `#C026D3` (Magenta/品红) - 用于品牌标识、提示符。
  - `secondary`: `#7C3AED` (Purple/紫色) - 用于 AI 标签、边框。
  - `accent`: `#06B6D4` (Cyan/青色) - 用于强调信息。
- **功能色**:
  - `success`: `#10B981` (Green)
  - `warning`: `#F59E0B` (Amber)
  - `error`: `#EF4444` (Red)
- **UI 专用色 (Thread.tsx)**:
  - `userLabel`: `#60a5fa` (Blue) - 用户消息标签。
  - `aiLabel`: `#c084fc` (Purple) - AI 回复标签。
  - `slashBg`: `#4c1d95` (Deep Purple) - Slash 命令选中背景。

## 3. 架构与布局约定
### 3.1 启动画面 (Splash Screen)
- 位于 `src/agent/style.ts` 的 `splashScreen` 函数。
- 使用渐变色 ASCII 艺术字展示 "onionCode"。
- 信息面板采用 `boxen` 的双线边框 (`double`)，紫色边框 (`#A855F7`)，内容居中。

### 3.2 聊天界面 (Thread UI)
- **首页 (HomePage)**: 
  - 顶部展示巨大的渐变色 ASCII Logo。
  - 输入区左侧有一条品红色竖线 (`┃`) 作为装饰。
  - 输入框采用单线边框 (`single`)，深灰色 (`#4b5563`)。
  - 底部包含快捷键提示 (`/` commands, `ctrl+c` exit) 和版本号。
- **对话状态**:
  - 用户消息：蓝色粗体标签 `▸ You`，内容缩进。
  - AI 消息：紫色粗体标签 `◈ onion`，推理过程 (`Reasoning`) 以灰色斜体显示，前缀为 `💭`。
  - 加载状态：琥珀色 Spinner (`⠋⠙⠹...`) 配合灰色“思考中”文本。

### 3.3 交互反馈
- **Slash 命令面板**: 当输入 `/` 时弹出，选中项高亮显示（深紫背景白字），未选中项为灰色。
- **工具调用日志**: 在 `style.ts` 中为不同工具定义了专属 Emoji 和颜色（如 `exec` 为黄色齿轮 `⚙`，`run_py` 为蓝色蛇 `🐍`）。

## 4. 开发者规范
1. **禁止使用 CSS**: 所有样式必须通过 `chalk` (CLI 模式) 或 Ink 组件的 `color`/`bold` 属性 (TUI 模式) 实现。
2. **颜色一致性**: 新增 UI 元素应复用 `src/agent/ui/Thread.tsx` 中的 `C` 常量对象或 `src/agent/style.ts` 中的 `theme` 对象，避免硬编码颜色值。
3. **响应式考量**: 终端宽度有限，长文本需自动换行 (`wrap="wrap"`)。使用 `boxen` 或边框时应考虑终端最小宽度。
4. **品牌露出**: 关键路径（启动、欢迎页、助手回复前缀）必须保持 `🧅 onion` 或 `onionCode` 的品牌标识，并使用定义的品红/紫色系。
5. **ASCII 艺术**: 仅在主欢迎页使用大型 ASCII 艺术，日常交互中保持简洁，避免刷屏。