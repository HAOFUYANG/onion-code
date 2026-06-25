import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
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
import { Spinner, StatusMessage } from "@inkjs/ui";
import BigText from "ink-big-text";
import {
  slashCommands,
  matchSlashCommands,
  formatSlashCommand,
  type SlashCommandContext,
} from "../../agent/slash_commands.js";
import { querySessions, renderSessionsTable } from "../../agent/sessions.js";
import { T, terminalMode, useInkTheme } from "../theme/index.js";
import chalk from "chalk";
import { ThemedText } from "./ThemedText.js";
import { ThemedBox } from "./ThemedBox.js";

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

// ── 首页大标题（改用 ink-big-text，风格更接近 OpenCode）──

// ── 用户消息 ──────────────────────────────────────────────────
const UserMessage = () => (
  <MessagePrimitive.Root>
    <ThemedBox
      marginBottom={1}
      flexDirection="column"
      paddingX={2}
      paddingTop={1}
      paddingBottom={1}
      borderStyle="single"
      borderVariant="primary"
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
    </ThemedBox>
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
            </>
          ),
          Reasoning: () => (
            <Box marginBottom={1}>
              <ThemedText variant="accent" italic>
                {"+  Thought: "}
              </ThemedText>
              <MarkdownTextPrimitive
                preprocess={preprocessMarkdownStream}
                theme={MARKDOWN_THEME}
              />
            </Box>
          ),
        }}
      />
      <ErrorPrimitive.Root>
        <StatusMessage variant="error">
          <ErrorPrimitive.Message />
        </StatusMessage>
      </ErrorPrimitive.Root>
    </Box>
  </MessagePrimitive.Root>
);

// ── 加载状态 ──────────────────────────────────────────────────
const Loading = () => (
  <LoadingPrimitive.Root paddingLeft={3} marginBottom={1}>
    <Spinner type="bouncingBar" label="thinking" />
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
  if (!buffer.startsWith("/")) return null;
  if (suggestions.length === 0) {
    if (buffer.length > 1) {
      return (
        <Box flexDirection="column">
          <Box paddingLeft={2}>
            <Text dimColor>没有匹配的命令</Text>
          </Box>
        </Box>
      );
    }
    return null;
  }
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
              >{` /${cmd.name} `}</Text>
            ) : (
              <Text dimColor>{` /${cmd.name} `}</Text>
            )}
            <ThemedText variant="textMuted">{`  ${cmd.description}`}</ThemedText>
          </Box>
        );
      })}
      <ThemedText variant="textSubtle">{"  tab 补全  ↑↓ 选择"}</ThemedText>
    </Box>
  );
};

// ── 底部状态行（HomePage / Composer 共用） ──────────────────
const FooterStatusBar = ({
  variant,
}: {
  variant: "home" | "composer";
}) => {
  const { stdout } = useStdout();
  const columns = stdout.columns ?? 80;
  const mode = process.env.npm_lifecycle_event === "dev" ? "dev" : "build";
  const modelName = process.env.OPENAI_MODEL ?? "deepseek-v4-flash";
  const modelDisplay = modelName
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return (
    <StatusBarPrimitive.Root gap={0} paddingX={2}>
      <ThemedText variant="primary">{"●"}</ThemedText>
      <ThemedText variant="textMuted">{` ${mode}`}</ThemedText>
      <ThemedText variant="textSubtle">{" · "}</ThemedText>
      <ThemedText variant="textBold">
        {modelDisplay}
      </ThemedText>
      {variant === "composer" ? (
        <>
          <ThemedText variant="textSubtle">{" · "}</ThemedText>
          <StatusBarPrimitive.MessageCount dimColor />
        </>
      ) : (
        <>
          <Box flexGrow={1} />
          {columns >= 72 ? (
            <>
              <ThemedText variant="textSubtle">{"/"}</ThemedText>
              <ThemedText variant="textSubtle">{" commands  "}</ThemedText>
              <ThemedText variant="textMuted">{"ctrl+c"}</ThemedText>
              <ThemedText variant="textSubtle">{" exit"}</ThemedText>
            </>
          ) : null}
        </>
      )}
    </StatusBarPrimitive.Root>
  );
};

// ── Slash 命令处理 Hook（HomePage / Composer 共用） ─────────
interface UseSlashCommandHandlerOptions {
  onNewThread: () => void;
  onRewindThread: (threadId: string) => boolean;
  onOpenConfig: () => void;
}

function useSlashCommandHandler(options: UseSlashCommandHandlerOptions) {
  const [slashIndex, setSlashIndex] = React.useState(0);
  const [cmdOutput, setCmdOutput] = React.useState<string | null>(null);
  const cmdExecutedRef = React.useRef(false);
  const aui = useAui();
  const theme = useInkTheme();
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;
  const composerText = useAuiState((s) => s.composer.text);
  const isSlashMode = composerText.startsWith("/");

  // SlashCommandContext 实现
  const slashCtxRef = React.useRef<SlashCommandContext>({
    newThread: () => {
      options.onNewThread();
      setCmdOutput(null);
    },
    showHelp: () => {
      const lines = slashCommands.map(
        (c) => {
          const commandLabel = "/" + c.name.padEnd(12);
          const styledLabel = theme.getColor("primary")
            ? chalk.bold.hex(theme.getColor("primary")!)(commandLabel)
            : chalk.bold(commandLabel);
          return `  ${styledLabel} ${chalk.dim(c.description)}`;
        },
      );
      setCmdOutput(chalk.bold("\n  可用命令:\n") + lines.join("\n") + "\n");
    },
    showSessions: () => {
      const sessions = querySessions(20);
      setCmdOutput(renderSessionsTable(sessions, terminalWidth));
    },
    rewindThread: (threadId: string) => {
      const ok = options.onRewindThread(threadId);
      setCmdOutput(
        ok
          ? `\n  已切换到会话 ${threadId}。上下文会续接，历史消息不会回填到当前界面。\n`
          : `\n  未找到会话 ${threadId}。先用 /sessions 查看可用 ID。\n`,
      );
    },
    openConfig: () => {
      options.onOpenConfig();
      setCmdOutput(null);
    },
    showNotice: (message: string) => {
      setCmdOutput(message);
    },
  });
  // 同步最新回调，避免闭包过时
  slashCtxRef.current.newThread = () => {
    options.onNewThread();
    setCmdOutput(null);
  };
  slashCtxRef.current.rewindThread = (threadId: string) => {
    const ok = options.onRewindThread(threadId);
    setCmdOutput(
      ok
        ? `\n  已切换到会话 ${threadId}。上下文会续接，历史消息不会回填到当前界面。\n`
        : `\n  未找到会话 ${threadId}。先用 /sessions 查看可用 ID。\n`,
    );
  };
  slashCtxRef.current.showSessions = () => {
    const sessions = querySessions(20);
    setCmdOutput(renderSessionsTable(sessions, terminalWidth));
  };
  slashCtxRef.current.showNotice = (message: string) => {
    setCmdOutput(message);
  };

  // slash 命令拦截
  const handleSubmit = React.useCallback(
    async (text: string) => {
      // slash 面板回车已直接执行命令，跳过重复处理
      if (cmdExecutedRef.current) {
        cmdExecutedRef.current = false;
        return;
      }
      const trimmed = text.trim();
      if (trimmed.startsWith("/")) {
        const parts = trimmed.slice(1).split(/\s+/);
        const name = parts[0].toLowerCase();
        const args = parts.slice(1).join(" ");
        const cmd = slashCommands.find(
          (c) => c.name === name || (c.aliases?.includes(name) ?? false),
        );
        if (cmd) {
          aui.composer().setText("");
          setCmdOutput(null);
          const result = await cmd.handler(
            slashCtxRef.current,
            args || undefined,
          );
          if (result === "exit") process.exit(0);
          return; // 不发给 AI
        }
      }
      // 普通消息
      setCmdOutput(null);
      aui.composer().send();
    },
    [aui],
  );

  // 键盘导航：↑↓ 选择 / Tab 补全 / Enter 执行 / ESC 关闭
  useInput((_input, key) => {
    const suggestions = matchSlashCommands(composerText);
    if (key.upArrow && isSlashMode && suggestions.length > 0) {
      setSlashIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
      return;
    }
    if (key.downArrow && isSlashMode && suggestions.length > 0) {
      setSlashIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (key.tab && isSlashMode && suggestions.length > 0) {
      aui.composer().setText(formatSlashCommand(suggestions[slashIndex]));
      setSlashIndex(0);
      return;
    }
    // Enter：当前文本未精确匹配命令时，自动执行面板选中项
    if (key.return && isSlashMode && suggestions.length > 0) {
      const trimmed = composerText.trim();
      const parts = trimmed.slice(1).split(/\s+/);
      const name = parts[0].toLowerCase();
      const exactMatch = slashCommands.find(
        (c) => c.name === name || (c.aliases?.includes(name) ?? false),
      );
      if (!exactMatch) {
        const selectedCmd = suggestions[slashIndex];
        cmdExecutedRef.current = true;
        aui.composer().setText("");
        setCmdOutput(null);
        setSlashIndex(0);
        Promise.resolve(
          selectedCmd.handler(slashCtxRef.current, undefined),
        ).then((result: string | void) => {
          if (result === "exit") process.exit(0);
        });
      }
      return;
    }
    if (key.escape && cmdOutput) setCmdOutput(null);
  });

  return { slashIndex, cmdOutput, composerText, handleSubmit };
}

// ── OpenCode 风格首页（空状态） ────────────────────────────────
interface HomePageProps {
  onNewThread: () => void;
  onRewindThread: (threadId: string) => boolean;
  onOpenConfig: () => void;
}

const HomePage = ({ onNewThread, onRewindThread, onOpenConfig }: HomePageProps) => {
  const { slashIndex, cmdOutput, composerText, handleSubmit } =
    useSlashCommandHandler({ onNewThread, onRewindThread, onOpenConfig });
  const { stdout } = useStdout();
  const columns = stdout.columns ?? 80;
  const showBigTitle = columns >= 72;

  return (
    <Box flexDirection="column">
      {/* OpenCode 风格首页大标题 */}
      <Box marginBottom={1} marginTop={1}>
        {showBigTitle ? (
          <BigText
            text="onioncode"
            font="block"
            {...(T.titleGradient ? { colors: T.titleGradient } : {})}
            lineHeight={2}
            space={true}
            letterSpacing={0}
          />
        ) : (
          <Box>
            <ThemedText variant="primary" bold>
              onionCode
            </ThemedText>
            <ThemedText variant="textMuted">{"  CLI AI agent"}</ThemedText>
          </Box>
        )}
      </Box>

      {/* 命令输出区 */}
      {cmdOutput && (
        <Box marginBottom={1}>
          <Text>{cmdOutput}</Text>
        </Box>
      )}
      <SlashPanel buffer={composerText} selectedIndex={slashIndex} />

      {/* 左侧竖线 + 灰色背景输入区域 */}
      <Box flexDirection="row">
        <ThemedBox
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          paddingTop={0}
          paddingBottom={0}
          backgroundVariant="homeBg"
          borderStyle="bold"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderVariant="primary"
        >
          <Box marginBottom={1}>
            <ComposerPrimitive.Input
              submitOnEnter
              onSubmit={handleSubmit}
              placeholder="输入消息，或 / 查看命令..."
              autoFocus
            />
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel>
                <ThemedText variant="textMuted">{"  esc 中断"}</ThemedText>
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </Box>
          <FooterStatusBar variant="home" />
        </ThemedBox>
      </Box>
    </Box>
  );
};

// ── Composer（对话中的输入框，带边框） ────────────────────────
interface ComposerProps {
  onNewThread: () => void;
  onRewindThread: (threadId: string) => boolean;
  onOpenConfig: () => void;
}

const Composer = ({ onNewThread, onRewindThread, onOpenConfig }: ComposerProps) => {
  const { slashIndex, cmdOutput, composerText, handleSubmit } =
    useSlashCommandHandler({ onNewThread, onRewindThread, onOpenConfig });

  return (
    <Box flexDirection="column" marginTop={2}>
      {/* 命令输出区（/sessions、/help 等结果） */}
      {cmdOutput && (
        <Box marginBottom={1}>
          <Text>{cmdOutput}</Text>
        </Box>
      )}
      <SlashPanel buffer={composerText} selectedIndex={slashIndex} />
      {/* 左侧竖线 + 灰色背景输入区域 */}
      <Box flexDirection="row">
        <ThemedBox
          flexDirection="column"
          flexGrow={1}
          paddingX={1}
          paddingTop={0}
          paddingBottom={0}
          backgroundVariant="inputBg"
          borderStyle="bold"
          borderLeft={true}
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderVariant="primary"
        >
          <Box marginBottom={1}>
            <ComposerPrimitive.Input
              submitOnEnter
              onSubmit={handleSubmit}
              placeholder="输入消息，或 / 查看命令..."
              autoFocus
            />
            <AuiIf condition={(s) => s.thread.isRunning}>
              <ComposerPrimitive.Cancel>
                <ThemedText variant="textMuted">{"  esc 中断"}</ThemedText>
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </Box>
          <FooterStatusBar variant="composer" />
        </ThemedBox>
      </Box>
    </Box>
  );
};

// ── Thread 主组件 ─────────────────────────────────────────────
interface ThreadProps {
  onNewThread: () => void;
  onRewindThread: (threadId: string) => boolean;
  onOpenConfig: () => void;
}

export const Thread = ({ onNewThread, onRewindThread, onOpenConfig }: ThreadProps) => (
  <ThreadPrimitive.Root flexDirection="column">
    {/* 空状态：OpenCode 风格首页 */}
    <AuiIf condition={(s) => s.thread.isEmpty}>
      <HomePage onNewThread={onNewThread} onRewindThread={onRewindThread} onOpenConfig={onOpenConfig} />
    </AuiIf>

    {/* 消息列表 */}
    <Box flexGrow={1} flexDirection="column">
      <ThreadPrimitive.Messages
        components={{ UserMessage, AssistantMessage }}
      />
      <Loading />
    </Box>

    {/* 输入区域：空状态由 HomePage 内嵌，有消息后用 Composer */}
    <AuiIf condition={(s) => !s.thread.isEmpty}>
      <Composer onNewThread={onNewThread} onRewindThread={onRewindThread} onOpenConfig={onOpenConfig} />
    </AuiIf>
  </ThreadPrimitive.Root>
);
