import React from "react";
import { Box, useInput } from "ink";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
} from "@assistant-ui/react-ink";
import { Thread } from "./Thread.js";
import { langchainAdapter } from "./adapter.js";

// ── App 根组件 ────────────────────────────────────────────────
interface AppProps {
  onExit: () => void;
}

export const App = ({ onExit }: AppProps) => {
  const runtime = useLocalRuntime(langchainAdapter);

  useInput((input, key) => {
    if (key.ctrl && input === "c") onExit();
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box flexDirection="column" paddingX={1}>
        <Thread />
      </Box>
    </AssistantRuntimeProvider>
  );
};
