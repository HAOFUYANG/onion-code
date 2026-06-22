import React from "react";
import { Box, Text, useInput } from "ink";
import {
  ThreadPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ErrorPrimitive,
  LoadingPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react-ink";
import { MarkdownText } from "@assistant-ui/react-ink-markdown";
import { matchSlashCommands, formatSlashCommand } from "../slash_commands.js";

// ── 用户消息 ──────────────────────────────────────────────────
const UserMessage = () => (
  <MessagePrimitive.Root>
    <Box marginBottom={1}>
      <Text bold color="cyan">
        {"  ┃ You    "}
      </Text>
      <MessagePrimitive.Content
        renderText={({ part }) => <Text wrap="wrap">{part.text}</Text>}
      />
    </Box>
  </MessagePrimitive.Root>
);

// ── AI 消息 ───────────────────────────────────────────────────
const AssistantMessage = () => (
  <MessagePrimitive.Root>
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="magenta">
        {"  ┃ onion"}
      </Text>
      <Box paddingLeft={4}>
        <MessagePrimitive.Content
          renderText={({ part }) => <MarkdownText text={part.text} />}
          renderReasoning={({ part }) => (
            <Text dimColor italic>
              {part.text}
            </Text>
          )}
        />
        <ErrorPrimitive.Root>
          <ErrorPrimitive.Message />
        </ErrorPrimitive.Root>
      </Box>
    </Box>
  </MessagePrimitive.Root>
);

// ── 加载状态 ──────────────────────────────────────────────────
const Loading = () => (
  <LoadingPrimitive.Root marginBottom={1} paddingLeft={4}>
    <LoadingPrimitive.Spinner />
    <Text> </Text>
    <LoadingPrimitive.Text>思考中</LoadingPrimitive.Text>
    <Text> </Text>
    <LoadingPrimitive.ElapsedTime />
  </LoadingPrimitive.Root>
);

// ── Slash 命令面板（输入行上方，仅当 buffer 以 / 开头时显示） ─
interface SlashPanelInlineProps {
  buffer: string;
  selectedIndex: number;
}

const SlashPanelInline = ({ buffer, selectedIndex }: SlashPanelInlineProps) => {
  const suggestions = matchSlashCommands(buffer);
  if (!buffer.startsWith("/") || suggestions.length === 0) return null;

  return (
    <Box flexDirection="column" marginBottom={0}>
      {suggestions.map((cmd, i) => {
        const isSelected = i === selectedIndex;
        const label = `/${cmd.name}`;
        return (
          <Box key={cmd.name} paddingLeft={4}>
            {isSelected ? (
              <>
                <Text
                  backgroundColor="yellow"
                  color="black"
                >{` ${label} `}</Text>
                <Text dimColor>{`  ${cmd.description}`}</Text>
              </>
            ) : (
              <>
                <Text dimColor>{` ${label} `}</Text>
                <Text dimColor>{`  ${cmd.description}`}</Text>
              </>
            )}
          </Box>
        );
      })}
      <Box paddingLeft={4}>
        <Text dimColor>{"tab 补全  ↑↓ 选择  enter 执行  esc 关闭"}</Text>
      </Box>
    </Box>
  );
};

// ── 自定义 Composer（包裹 ComposerPrimitive.Input + slash 面板） ─
const Composer = () => {
  const [slashIndex, setSlashIndex] = React.useState(0);
  const aui = useAui();
  // 从 runtime 直接读取 composer text（不需要本地镜像 state）
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
      const completed = formatSlashCommand(suggestions[slashIndex]);
      aui.composer().setText(completed);
      setSlashIndex(0);
    }
  });

  return (
    <Box flexDirection="column">
      <SlashPanelInline buffer={composerText} selectedIndex={slashIndex} />
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="magenta">{"❯ "}</Text>
        <ComposerPrimitive.Input
          submitOnEnter
          placeholder="输入消息，或 / 查看命令..."
          autoFocus
        />
      </Box>
    </Box>
  );
};

// ── Thread 主组件 ─────────────────────────────────────────────
export const Thread = () => (
  <ThreadPrimitive.Root>
    <ThreadPrimitive.Empty>
      <Box flexDirection="column" marginBottom={1} paddingLeft={4}>
        <Text dimColor>{"开始对话，或输入 / 查看可用命令"}</Text>
      </Box>
    </ThreadPrimitive.Empty>

    <ThreadPrimitive.Messages>
      {({ message }) =>
        message.role === "user" ? <UserMessage /> : <AssistantMessage />
      }
    </ThreadPrimitive.Messages>

    <Loading />

    <Composer />
  </ThreadPrimitive.Root>
);
