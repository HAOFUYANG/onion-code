import React from "react";
import { Box, Text, useInput } from "ink";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  StatusBarPrimitive,
  useAui,
} from "@assistant-ui/react-ink";
import { Thread } from "./Thread.js";
import { langchainAdapter } from "./adapter.js";
import pkg from "../../../package.json" with { type: "json" };

// ── 状态栏 ────────────────────────────────────────────────────
const StatusBar = () => (
  <StatusBarPrimitive.Root>
    <Text dimColor>
      {"model: "}
      <StatusBarPrimitive.ModelName
        name={process.env.OPENAI_MODEL ?? "deepseek-v4-flash"}
      />
      {" · "}
      <StatusBarPrimitive.MessageCount />
      {" · "}
      <StatusBarPrimitive.Status />
    </Text>
  </StatusBarPrimitive.Root>
);

// ── App 根组件 ────────────────────────────────────────────────
interface AppProps {
  onExit: () => void;
}

export const App = ({ onExit }: AppProps) => {
  const runtime = useLocalRuntime(langchainAdapter);
  const aui = useAui();

  useInput((input, key) => {
    if (key.ctrl && input === "c") onExit();
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Box flexDirection="column" padding={1}>
        {/* 标题行 */}
        <Box>
          <Text bold color="magenta">
            {"🧅 onionCode"}
          </Text>
          <Text dimColor>
            {"  v" + pkg.version + "  ·  " + (pkg.description ?? "")}
          </Text>
        </Box>

        {/* 状态栏 */}
        <StatusBar />

        {/* 对话主体 */}
        <Box marginTop={1}>
          <Thread />
        </Box>
      </Box>
    </AssistantRuntimeProvider>
  );
};
