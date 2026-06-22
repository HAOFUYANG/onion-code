## 1. 核心系统与工具
本项目采用 **Vue TUI** (`@vue-tui/runtime`) 作为前端渲染引擎，基于 Vue 3 组件化架构构建命令行终端用户界面（TUI）。它不依赖传统的 Web CSS/HTML，而是通过终端兼容的布局原语（`Box`, `Text`）和属性（颜色、边框、内边距）来定义视觉样式。

## 2. 视觉风格与设计规范
### 2.1 配色方案 (Design Tokens)
项目定义了统一的语义化色板，主要集中在紫色/品红系，营造现代且高对比度的终端体验：
- **主色调 (Primary)**: `#C026D3` (Magenta) - 用于输入框焦点、用户消息前缀、主要交互元素。
- **辅助色 (Secondary)**: `#7C3AED` (Purple) / `#A855F7` - 用于边框、装饰性图标。
- **强调色 (Accent)**: `#06B6D4` (Cyan) - 用于网络搜索、文件读取等工具图标。
- **状态色**: 
  - 成功: `#10B981` (Green)
  - 警告: `#F59E0B` (Amber)
  - 错误: `#EF4444` (Red)
- **文本层级**: 使用 `dimColor` 属性降低次要信息（如时间戳、提示符）的亮度，实现视觉层级区分。

### 2.2 布局与排版
- **布局模型**: 严格遵循 Flexbox 逻辑（`flexDirection: 'column' | 'row'`），通过 `paddingLeft/Right/Top/Bottom` 控制间距。
- **边框样式**: 采用 `double` 样式的边框配合紫色系描边，用于启动画面（SplashScreen）的信息面板。
- **光标定位**: 利用 `useBoxMetrics` 和 `useCursor` 实现精确到字符级别的真实光标渲染，而非简单的块闪烁。

### 2.3 动态视觉效果
- **ASCII 艺术渐变**: 启动画面通过 `figlet` 生成 ASCII 艺术字，并利用自定义算法在 `#F0ABFC` 到 `#A78BFA` 之间进行逐行颜色插值，实现垂直渐变效果。
- **流式响应指示**: 在 AI 回复末尾添加 `█` 符号并配合 `dimColor`，模拟终端打字机光标效果。

## 3. 组件化架构
UI 逻辑被拆分为高度内聚的 Vue 组件：
- **`InputBox.vue`**: 处理用户输入，包含焦点状态管理（`useFocus`）和实时状态栏（显示模型名、会话 ID、响应耗时）。
- **`MessageItem.vue`**: 负责历史消息渲染，根据角色（user/assistant/tool）应用不同的图标和颜色策略。
- **`SlashPanel.vue`**: 命令选择面板，通过背景色反白（`backgroundColor="#f4b183" black`）标识当前选中项。
- **`ToolLog.vue`** (隐含在 MessageItem 中): 根据工具名称动态映射图标和颜色（如 `run_py` 对应 🐍 蓝色）。

## 4. 开发者约定
- **样式定义位置**: 所有颜色常量应统一定义在 `src/ui/composables/useTheme.ts` 中，禁止在组件内硬编码 Hex 颜色值（除特殊动效外）。
- **终端兼容性**: 避免使用 ANSI 转义码直接操作屏幕，应优先使用 `@vue-tui/runtime` 提供的声明式组件属性。
- **响应式设计**: 由于是 TUI 环境，不涉及媒体查询，但需考虑不同终端宽度下的文本截断（`truncate` 函数）和换行行为。