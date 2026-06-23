---
kind: design
name: 采用 Ink + React 重构 CLI 交互层
source: session
category: adr
---

# 采用 Ink + React 重构 CLI 交互层

_来源：dea62aa → 9d7b66c 提交周期内记录的编码计划——内容为规划时意图，实现可能滞后或有出入。_

**状态：** accepted

## 背景
原有的 `src/agent/input.ts` 使用手写 raw mode 处理终端输入，缺乏光标控制、placeholder 等现代交互特性，且维护复杂。为了提升用户体验并简化交互逻辑，需要引入成熟的 TUI（Terminal User Interface）框架。

## 决策驱动
- 交互体验增强（光标、placeholder、动态渲染）
- 降低底层终端控制的复杂度
- 利用 React 组件化能力管理 UI 状态

## 备选方案
- **Ink + React** — 优点：基于 React 生态，组件化开发；@inkjs/ui 提供现成的高质量组件（如 TextInput）；支持声明式 UI 更新。；缺点：引入 React 运行时依赖，增加包体积；需要配置 JSX 编译支持。
- **维持手写 raw mode** _（已否决）_ — 优点：零额外依赖，启动开销极小。；缺点：实现复杂交互（如命令自动补全面板、光标移动）极其困难且容易出错；代码难以维护。

## 决策
迁移至 Ink 框架。安装 `ink`、`react` 及 `@inkjs/ui`，在 `tsconfig.json` 中启用 `jsx: react-jsx`。重写 `src/agent/input.ts` 中的 `readUserInput`，通过 `ink.render` 挂载 `<InputPrompt>` 组件。新建 `src/agent/ui/InputPrompt.tsx` 和 `src/agent/ui/SlashPanel.tsx` 封装交互逻辑，保留 `fallbackPrompt` 以兼容非 TTY 环境。

## 影响
CLI 交互能力显著提升，支持类似 TipTap 的命令下拉菜单和受控输入框。核心业务逻辑（`agent.ts`, `cli.ts` 主循环）无需修改，因为 `readUserInput` 接口签名保持不变。项目构建流程需支持 JSX 转换。