import React from "react";
import { Box, Text, useInput } from "ink";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  MessagePartPrimitive,
  ErrorPrimitive,
  LoadingPrimitive,
  StatusBarPrimitive,
  AuiIf,
  useAui,
  useAuiState,
} from "@assistant-ui/react-ink";
import {
  MarkdownText,
  MarkdownTextPrimitive,
} from "@assistant-ui/react-ink-markdown";
import { matchSlashCommands, formatSlashCommand } from "../slash_commands.js";
import { createRequire } from "node:module";
import figlet from "figlet";
import chalk from "chalk";
import pkg from "../../../package.json" with { type: "json" };

// ── figlet 字体初始化 ──────────────────────────────────────────
const _require = createRequire(import.meta.url);
try {
  const doomFont = _require("figlet/importable-fonts/Doom");
  figlet.parseFont("Doom", doomFont);
} catch {
  // fallback to Standard
}

function gradientText(text: string, c1: string, c2: string): string {
  const lines = text.split("\n").filter((l) => l.trim());
  const n = lines.length;
  return lines
    .map((line, i) => {
      const ratio = n > 1 ? i / (n - 1) : 0;
      const r1 = parseInt(c1.slice(1, 3), 16),
        g1 = parseInt(c1.slice(3, 5), 16),
        b1 = parseInt(c1.slice(5, 7), 16);
      const r2 = parseInt(c2.slice(1, 3), 16),
        g2 = parseInt(c2.slice(3, 5), 16),
        b2 = parseInt(c2.slice(5, 7), 16);
      const r = Math.round(r1 + (r2 - r1) * ratio);
      const g = Math.round(g1 + (g2 - g1) * ratio);
      const b = Math.round(b1 + (b2 - b1) * ratio);
      const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
      return chalk.hex(hex)(line);
    })
    .join("\n");
}

const BIG_TITLE = gradientText(
  figlet.textSync("onionCode", { font: "Doom", horizontalLayout: "fitted" }),
  "#60a5fa",
  "#f59e0b",
);

// ── 色彩 Token（OpenCode 蓝/橙双色主题）────────────────────────
const C = {
  userLabel: "#3b82f6" as const, // 蓝色  — 用户名/Build 标签
  aiLabel: "#3b82f6" as const, // 蓝色  — AI 状态图标
  aiReason: "#f59e0b" as const, // 橙黄  — Thought 推理行
  spinner: "#f59e0b" as const, // 橙黄  — 加载 spinner
  spinnerTxt: "#f59e0b" as const, // 橙黄  — 思考中文字
  slashBg: "#1e3a5f" as const, // 深蓝  — slash 高亮背景
  slashFg: "white" as const, // 白字  — slash 高亮
  slashDim: "#6b7280" as const, // 灰色  — slash 普通项
  prompt: "#3b82f6" as const, // 蓝色  — ❯ 符号
  border: "#3b3b3b" as const, // 暗灰  — 输入框边框
  accentLine: "#3b82f6" as const, // 蓝色  — 左侧竖线
  modelIcon: "#3b82f6" as const, // 蓝色  — ■ 状态图标
  statusDot: "#3b82f6" as const, // 蓝色  — 状态点
  cancel: "#f87171" as const, // 红色  — esc 中断
  dim: "#6b7280" as const, // 灰色  — 辅助文字
  tipDot: "#f59e0b" as const, // 橙黄  — Tip 点
  tipLabel: "#f59e0b" as const, // 橙黄  — "Tip" 标签
  shortcut: "white" as const, // 白色  — 快捷键
  version: "#4b5563" as const, // 深灰  — 版本号
  high: "#f59e0b" as const, // 橙黄  — high 标签
} as const;

// ── 用户消息 ──────────────────────────────────────────────────
const UserMessage = () => (
  <MessagePrimitive.Root>
    <Box
      marginBottom={1}
      flexDirection="column"
      paddingX={2}
      paddingTop={1}
      paddingBottom={1}
      borderStyle="single"
      borderColor={C.accentLine}
      borderTop={false}
      borderRight={false}
      borderBottom={false}
      borderLeft={true}
    >
      <MessagePrimitive.Parts
        components={{
          Text: () => (
            <Box>
              <MessagePartPrimitive.Text wrap="wrap" />
            </Box>
          ),
        }}
      />
    </Box>
  </MessagePrimitive.Root>
);

// ── AI 消息 ───────────────────────────────────────────────────
const AssistantMessage = () => (
  <MessagePrimitive.Root>
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <MessagePrimitive.Parts
        components={{
          Text: () => <MarkdownTextPrimitive />,
          Reasoning: () => (
            <Box marginBottom={1}>
              <Text color={C.aiReason} italic>
                {"+ Thought: "}
              </Text>
              <MarkdownTextPrimitive preprocess={(t) => t} />
            </Box>
          ),
        }}
      />
      <ErrorPrimitive.Root>
        <Text color={C.cancel}>
          {"✖ "}
          <ErrorPrimitive.Message />
        </Text>
      </ErrorPrimitive.Root>
    </Box>
  </MessagePrimitive.Root>
);

// ── 加载状态 ──────────────────────────────────────────────────
const Loading = () => (
  <LoadingPrimitive.Root paddingLeft={3} marginBottom={1}>
    <LoadingPrimitive.Spinner color={C.spinner} variant="dots" />
    <Text color={C.spinnerTxt}>{" 思考中  "}</Text>
    <LoadingPrimitive.ElapsedTime color={C.dim} />
  </LoadingPrimitive.Root>
);

// ── Slash 命令面板 ────────────────────────────────────────────
const SlashPanel = ({
  buffer,
  selectedIndex,
}: {
  buffer: string;
  selectedIndex: number;
}) => {
  const suggestions = matchSlashCommands(buffer);
  if (!buffer.startsWith("/") || suggestions.length === 0) return null;
  return (
    <Box flexDirection="column">
      {suggestions.map((cmd, i) => {
        const sel = i === selectedIndex;
        return (
          <Box key={cmd.name}>
            {sel ? (
              <Text
                backgroundColor={C.slashBg}
                color={C.slashFg}
                bold
              >{` /${cmd.name} `}</Text>
            ) : (
              <Text color={C.slashDim}>{` /${cmd.name} `}</Text>
            )}
            <Text color={C.dim}>{`  ${cmd.description}`}</Text>
          </Box>
        );
      })}
      <Text color={C.dim}>{"  tab 补全  ↑↓ 选择"}</Text>
    </Box>
  );
};

// ── 底部状态行 ────────────────────────────────────────────────
const ComposerFooter = () => {
  const modelName = process.env.OPENAI_MODEL ?? "deepseek-v4-flash";
  const modelDisplay = modelName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return (
    <StatusBarPrimitive.Root gap={0} paddingX={2}>
      <Text color={C.modelIcon} bold>
        {"■ "}
      </Text>
      <Text color={C.userLabel} bold>
        {"Build"}
      </Text>
      <Text color={C.dim}>{" · "}</Text>
      <Text bold color="white">
        {modelDisplay}
      </Text>
      <Text color={C.dim}>{" · "}</Text>
      <StatusBarPrimitive.MessageCount color={C.dim} />
    </StatusBarPrimitive.Root>
  );
};

// ── OpenCode 风格首页（空状态） ────────────────────────────────
const HomePage = () => {
  const modelName = process.env.OPENAI_MODEL ?? "deepseek-v4-flash";
  return (
    <Box flexDirection="column">
      {/* figlet 大标题 */}
      <Box marginBottom={2} marginTop={1}>
        <Text>{BIG_TITLE}</Text>
      </Box>

      {/* 左侧竖线 + 灰色背景输入区域 */}
      <Box flexDirection="row">
        <Box
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          paddingTop={0}
          paddingBottom={0}
          marginTop={1}
          marginBottom={1}
          backgroundColor="#272626ff"
          borderStyle="bold"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor={C.accentLine}
        >
          <Box marginBottom={1}>
            <ComposerPrimitive.Input
              submitOnEnter
              placeholder={
                "Ask anything... \u201cWhat is the tech stack of this project?\u201d"
              }
              autoFocus
            />
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel>
                <Text color={C.cancel}>{"  esc"}</Text>
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </Box>

          {/* 第二行：Build · ModelName Provider · high */}
          <StatusBarPrimitive.Root gap={0}>
            <Text color={C.userLabel} bold>
              {"Build"}
            </Text>
            <Text color={C.dim}>{"\u00b7  "}</Text>
            <Text bold color="white">
              {modelName
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </Text>
            <Text color={C.dim}>{"  DeepSeek  \u00b7  "}</Text>
            <Text color={C.high} bold>
              {"high"}
            </Text>
          </StatusBarPrimitive.Root>
        </Box>
      </Box>

      {/* 快捷键提示行（右对齐） */}
      <Box justifyContent="flex-end" marginTop={1}>
        <Text bold color={C.shortcut}>
          {"/"}
        </Text>
        <Text color={C.dim}>{" commands   "}</Text>
        <Text bold color={C.shortcut}>
          {"ctrl+c"}
        </Text>
        <Text color={C.dim}>{" exit"}</Text>
      </Box>

      {/* Tip 行 */}
      <Box marginTop={1}>
        <Text color={C.tipDot}>{"● "}</Text>
        <Text bold color={C.tipLabel}>
          {"Tip "}
        </Text>
        <Text color={C.dim}>{"输入 "}</Text>
        <Text bold color={C.shortcut}>
          {"/"}
        </Text>
        <Text color={C.dim}>{" 打开命令面板，"}</Text>
        <Text bold color={C.shortcut}>
          {"esc"}
        </Text>
        <Text color={C.dim}>{" 中断正在运行的回复"}</Text>
      </Box>

      {/* 版本号（右下角） */}
      <Box justifyContent="flex-end" marginTop={1}>
        <Text color={C.version}>{pkg.version}</Text>
      </Box>
    </Box>
  );
};

// ── Composer（对话中的输入框，带边框） ────────────────────────
const Composer = () => {
  const [slashIndex, setSlashIndex] = React.useState(0);
  const aui = useAui();
  const composerText = useAuiState((s) => s.composer.text);

  useInput((input, key) => {
    const suggestions = matchSlashCommands(composerText);
    if (key.upArrow && suggestions.length > 0) {
      setSlashIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (key.downArrow && suggestions.length > 0) {
      setSlashIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (key.tab && suggestions.length > 0) {
      aui.composer().setText(formatSlashCommand(suggestions[slashIndex]));
      setSlashIndex(0);
    }
  });

  return (
    <Box flexDirection="column" marginTop={2}>
      <SlashPanel buffer={composerText} selectedIndex={slashIndex} />
      {/* 左侧竖线 + 灰色背景输入区域 */}
      <Box flexDirection="row">
        <Box
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          paddingTop={0}
          paddingBottom={0}
          backgroundColor="#272626ff"
          borderStyle="bold"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor={C.accentLine}
        >
          <Box marginBottom={1}>
            <ComposerPrimitive.Input
              submitOnEnter
              placeholder="输入消息，或 / 查看命令..."
              autoFocus
            />
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel>
                <Text color={C.cancel}>{"  esc 中断"}</Text>
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </Box>
          <ComposerFooter />
        </Box>
      </Box>
    </Box>
  );
};

// ── Thread 主组件 ─────────────────────────────────────────────
// ── Thread 主组件 ───────────────────────────────────────────────────
export const Thread = () => (
  <ThreadPrimitive.Root flexDirection="column">
    {/* 空状态：OpenCode 风格首页 */}
    <AuiIf condition={(s) => s.thread.isEmpty}>
      <HomePage />
    </AuiIf>

    {/* 消息列表：flexGrow 占满剩余空间，推动输入框至底部 */}
    <Box flexGrow={1} flexDirection="column">
      <ThreadPrimitive.Messages
        components={{ UserMessage, AssistantMessage }}
      />
      <Loading />
    </Box>

    {/* 输入区域：空状态时由 HomePage 内嵌 ComposerPrimitive.Input，有消息后用 Composer */}
    <AuiIf condition={(s) => !s.thread.isEmpty}>
      <Composer />
    </AuiIf>
  </ThreadPrimitive.Root>
);
