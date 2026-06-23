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
import { MarkdownTextPrimitive } from "@assistant-ui/react-ink-markdown";
import { matchSlashCommands, formatSlashCommand } from "../slash_commands.js";
import { T, terminalMode } from "./theme.js";
import { createRequire } from "node:module";
import figlet from "figlet";
import chalk from "chalk";

// ── Markdown 流式输出优化 ────────────────────────────────────
// streaming 过程中 AI 可能输出未闭合的语法残片，预处理将其修复为安全的可渲染形式。
// markdansi 会按原文字符处理未闭合的模块，不会崩溃，但这里额外保证了完整性。
function preprocessMarkdownStream(text: string): string {
  let t = text;
  // 修复未闭合的代码块：数一下 ``` 出现次数，奇数表示未闭合
  const fenceCount = (t.match(/^```/gm) || []).length;
  if (fenceCount % 2 !== 0) t += "\n```";
  // 修复未闭合的粗体：** 奇数
  const boldCount = (t.match(/\*\*/g) || []).length;
  if (boldCount % 2 !== 0) t += "**";
  // 修复未闭合的斜体（单个 *）：找尾部独立的 *
  const trailingItalic = t.match(/(\*[^*\n][^\n]*)$/);
  if (trailingItalic && (trailingItalic[1].match(/\*/g) || []).length % 2 !== 0)
    t += "*";
  return t;
}

// markdansi 主题：跟随终端模式自动切换
// light 终端下使用 dim（轻色调，避免白底上强色过于刺眼）；dark 终端使用 bright
// 类型为已知的 ThemeName自面量
const MARKDOWN_THEME: "dim" | "bright" =
  terminalMode === "light" ? "dim" : "bright";

// ── 色彩系统已迁移至 theme.ts（语义色板 T，dark/light 自适应）──

// ── figlet 大标题（渐变色，跟随主题） ────────────────────────
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
  T.figletFrom,
  T.figletTo,
);

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
      borderColor={T.primary}
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
          Text: () => (
            <>
              <MarkdownTextPrimitive
                preprocess={preprocessMarkdownStream}
                theme={MARKDOWN_THEME}
              />
              {/* streaming 时显示光标▮，完成后自动消失 */}
              <MessagePartPrimitive.InProgress>
                <Text color={T.primary}>{" ▮"}</Text>
              </MessagePartPrimitive.InProgress>
            </>
          ),
          Reasoning: () => (
            <Box marginBottom={1}>
              <Text color={T.accent} italic>
                {"+  Thought: "}
              </Text>
              <MarkdownTextPrimitive
                preprocess={preprocessMarkdownStream}
                theme={MARKDOWN_THEME}
              />
            </Box>
          ),
        }}
      />
      <ErrorPrimitive.Root>
        <Text color={T.cancel}>
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
    <LoadingPrimitive.Spinner color={T.accent} variant="dots" />
    <Text color={T.accent}>{" 思考中  "}</Text>
    <LoadingPrimitive.ElapsedTime dimColor />
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
                backgroundColor={T.slashBg}
                color={T.slashFg}
                bold
              >{` /${cmd.name} `}</Text>
            ) : (
              <Text dimColor>{` /${cmd.name} `}</Text>
            )}
            <Text dimColor>{`  ${cmd.description}`}</Text>
          </Box>
        );
      })}
      <Text dimColor>{"  tab 补全  ↑↓ 选择"}</Text>
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
      <Text color={T.primary} bold>
        {"■ "}
      </Text>
      <Text color={T.primary} bold>
        {"Build"}
      </Text>
      <Text dimColor>{" · "}</Text>
      <Text bold color={T.textBold}>
        {modelDisplay}
      </Text>
      <Text dimColor>{" · "}</Text>
      <StatusBarPrimitive.MessageCount dimColor />
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
          backgroundColor={T.homeBg}
          borderStyle="bold"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor={T.primary}
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
                <Text color={T.cancel}>{"  esc"}</Text>
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </Box>

          {/* 状态栏：Build · ModelName · 快捷键提示 */}
          <StatusBarPrimitive.Root gap={0}>
            <Text color={T.primary} bold>
              {"Build"}
            </Text>
            <Text dimColor>{"  "}</Text>
            <Text bold color={T.textBold}>
              {modelName
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </Text>
            <Box flexGrow={1} />
            <Text dimColor>{"/"}</Text>
            <Text dimColor>{" commands  "}</Text>
            <Text color={T.primary} bold>
              {"ctrl+c"}
            </Text>
            <Text dimColor>{" exit"}</Text>
          </StatusBarPrimitive.Root>
        </Box>
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
          backgroundColor={T.inputBg}
          borderStyle="bold"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor={T.primary}
        >
          <Box marginBottom={1}>
            <ComposerPrimitive.Input
              submitOnEnter
              placeholder="输入消息，或 / 查看命令..."
              autoFocus
            />
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel>
                <Text color={T.cancel}>{"  esc 中断"}</Text>
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
