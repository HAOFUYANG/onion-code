---
kind: design
name: 采用 vue-tui + Vite 重构终端 UI 层
source: session
category: adr
---

# 采用 vue-tui + Vite 重构终端 UI 层

_来源：c034d8f → 1b9678c 提交周期内记录的编码计划——内容为规划时意图，实现可能滞后或有出入。_

**状态：** accepted

## 背景
原有 UI 层（input.ts, style.ts, cli.ts）为纯手写实现，包含 330 行手动 readline/ANSI 控制及 chalk 字符串拼接，导致代码脆弱、难维护且无组件复用能力。为解决此技术债务并提升开发体验，需引入成熟的 TUI 框架。

## 决策驱动
- 组件化与可维护性
- 热模块替换（HMR）开发体验
- 响应式状态管理简化复杂交互
- 业务逻辑与视图层解耦

## 备选方案
- **vue-tui + Vite + Vue SFC** — 优点：提供 SFC 组件架构、Static/Streaming 原生支持、Vite HMR 极速反馈、生态标准统一；参考 coding-agent 示例可实现快速迁移。；缺点：vue-tui 处于 beta 阶段，API 可能存在变动风险；需处理 Vite 对 native 依赖（如 better-sqlite3）的外部化配置。
- **维持现状（手写 readline/ANSI/chalk）** _（已否决）_ — 优点：无额外依赖，构建简单。；缺点：代码极度脆弱（330行手动输入处理），无组件复用，难以扩展复杂 UI（如 Slash 面板、会话表格），维护成本高。

## 决策
放弃手写 UI 实现，全面迁移至 vue-tui 技术栈。具体包括：使用 Vue SFC (.vue) 编写组件，采用 Vite 替代 tsc 进行构建，利用 <Static> 和响应式流式文本处理聊天历史与实时输出，并通过 composables (useAgent, useInput) 封装底层逻辑。业务层代码（agent.ts, tools.ts 等）保持不变，仅剥离渲染逻辑。

## 影响
正面：获得组件化复用能力、HMR 开发体验、更健壮的输入处理（useInput 替代手写 readline）和清晰的架构分层。负面/成本：引入 vue-tui beta 依赖需锁定版本以防 API 变更；Vite 构建需配置 externalize 以兼容 native 模块；需处理 inquirer 等非 TUI 弹窗与 vue-tui 的事件冲突（临时退出/重挂载）。