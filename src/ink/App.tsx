import React from "react";
import { Box, useInput, useStdout } from "ink";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  generateId,
} from "@assistant-ui/react-ink";
import { ThemeProvider, extendTheme, defaultTheme } from "@inkjs/ui";
import { ThemedBox } from "./components/ThemedBox.js";
import { Thread } from "./components/Thread.js";
import { ConfigPanel } from "./screens/ConfigPanel.js";
import { createLangchainAdapter } from "./runtime/adapter.js";
import { threadExists } from "../agent/sessions.js";
import { T } from "./theme/index.js";

// ── @inkjs/ui 自定义主题 ─────────────────────────────────────
const customTheme = extendTheme(defaultTheme, {
  components: {
    Spinner: {
      styles: {
        frame: () => ({ color: T.primary }),
        label: () => ({ color: T.textMuted }),
      },
    },
    TextInput: {
      styles: {
        value: () => ({
          color: T.textBold,
        }),
      },
    },
    Select: {
      styles: {
        focusIndicator: () => ({ color: T.primary }),
        selectedIndicator: () => ({ color: T.primary }),
        label({ isFocused }: { isFocused: boolean }) {
          return { color: isFocused ? T.primary : undefined };
        },
      },
    },
  },
});

// ── App 根组件 ────────────────────────────────────────────────
interface AppProps {
  onExit: () => void;
}

export const App = ({ onExit }: AppProps) => {
  const [threadId, setThreadId] = React.useState(() => generateId());
  const [showConfig, setShowConfig] = React.useState(false);
  const { stdout } = useStdout();
  const framePadding = 1;
  const viewportWidth = stdout.columns ?? 80;
  const viewportHeight = stdout.rows ?? 24;
  const contentWidth = Math.max(1, viewportWidth - framePadding * 2);
  const contentHeight = Math.max(1, viewportHeight - framePadding * 2);

  // 用 ref 让 adapter 总能读到最新 threadId，避免重建 adapter
  const threadIdRef = React.useRef(threadId);
  threadIdRef.current = threadId;

  const adapter = React.useMemo(
    () => createLangchainAdapter(() => threadIdRef.current),
    [],
  );

  const runtime = useLocalRuntime(adapter);

  useInput((input, key) => {
    if (key.ctrl && input === "c") onExit();
  });

  const handleNewThread = React.useCallback(() => {
    setThreadId(generateId());
    runtime.thread.reset();
  }, [runtime]);

  const handleRewindThread = React.useCallback(
    (targetId: string) => {
      if (!threadExists(targetId)) return false;
      setThreadId(targetId);
      runtime.thread.reset();
      return true;
    },
    [runtime],
  );

  const handleOpenConfig = React.useCallback(() => {
    setShowConfig(true);
  }, []);

  const handleCloseConfig = React.useCallback(() => {
    setShowConfig(false);
  }, []);

  return (
    <ThemeProvider theme={customTheme}>
      <AssistantRuntimeProvider runtime={runtime}>
        <ThemedBox
          flexDirection="column"
          width={viewportWidth}
          height={viewportHeight}
          paddingX={framePadding}
          paddingY={framePadding}
          backgroundVariant="appBg"
          overflow="hidden"
        >
          <Box
            flexDirection="column"
            flexGrow={1}
            width={contentWidth}
            height={contentHeight}
            minWidth={contentWidth}
            minHeight={contentHeight}
            overflow="hidden"
          >
            {showConfig ? (
              <ConfigPanel onClose={handleCloseConfig} />
            ) : (
              <Thread
                onNewThread={handleNewThread}
                onRewindThread={handleRewindThread}
                onOpenConfig={handleOpenConfig}
              />
            )}
          </Box>
        </ThemedBox>
      </AssistantRuntimeProvider>
    </ThemeProvider>
  );
};
