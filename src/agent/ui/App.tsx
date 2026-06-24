import React from "react";
import { Box, useInput } from "ink";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  generateId,
} from "@assistant-ui/react-ink";
import { Thread } from "./Thread.js";
import { createLangchainAdapter } from "./adapter.js";
import { threadExists } from "../sessions.js";

// ── App 根组件 ────────────────────────────────────────────────
interface AppProps {
  onExit: () => void;
}

export const App = ({ onExit }: AppProps) => {
  const [threadId, setThreadId] = React.useState(() => generateId());

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
      if (!threadExists(targetId)) return;
      setThreadId(targetId);
      runtime.thread.reset();
    },
    [runtime],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box flexDirection="column" paddingX={1}>
        <Thread
          onNewThread={handleNewThread}
          onRewindThread={handleRewindThread}
        />
      </Box>
    </AssistantRuntimeProvider>
  );
};
