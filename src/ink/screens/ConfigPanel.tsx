import React from "react";
import { Box, Text, useInput } from "ink";
import { Select, TextInput, StatusMessage } from "@inkjs/ui";
import type { Option } from "@inkjs/ui";
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  type AppConfig,
} from "../../agent/config.js";
import {
  ensurePythonEnvironment,
  PYTHON_DATA_PACKAGES,
} from "../../agent/python_env.js";
import { Dialog } from "../components/Dialog.js";
import { T } from "../theme/index.js";

// ── 配置步骤枚举 ────────────────────────────────────────────────
type Step = "module" | "python" | "done";

interface ConfigPanelProps {
  onClose: () => void;
}

// ── 布尔选项 ─────────────────────────────────────────────────────
const boolOptions: Option[] = [
  { label: "是", value: "true" },
  { label: "否", value: "false" },
];

// ── 模块选择 ─────────────────────────────────────────────────────
const moduleOptions: Option[] = [
  { label: "Python 运行环境 / pip 镜像源", value: "python" },
  { label: "退出配置", value: "exit" },
];

export function ConfigPanel({ onClose }: ConfigPanelProps) {
  const [step, setStep] = React.useState<Step>("module");
  const [message, setMessage] = React.useState<{
    text: string;
    variant: "success" | "error";
  } | null>(null);
  const currentRef = React.useRef(loadConfig());

  // 允许 ESC 关闭面板
  useInput((_input, key) => {
    if (key.escape) onClose();
  });

  // ── Step: 模块选择 ──────────────────────────────────────────
  if (step === "module") {
    return (
      <Dialog
        title="onionCode 配置中心"
        subtitle={`配置文件: ${getConfigPath()}`}
        tone="info"
        actions="enter 选择  ·  esc 关闭"
      >
        <Box marginBottom={1} flexDirection="column">
          <Box marginBottom={1}>
            <Text color={T.textMuted}>
              选择要配置的模块。后续可以继续扩展模型、主题和权限等页面。
            </Text>
          </Box>
          <Select
            options={moduleOptions}
            onChange={(value) => {
              if (value === "exit") {
                onClose();
              } else {
                setStep("python");
              }
            }}
          />
        </Box>
      </Dialog>
    );
  }

  // ── Step: Python 配置 ────────────────────────────────────────
  if (step === "python") {
    const handleSave = (nextConfig: AppConfig) => {
      saveConfig(nextConfig);
      currentRef.current = nextConfig;
      setMessage({ text: `配置已保存到 ${getConfigPath()}`, variant: "success" });
      setStep("done");
    };

    return (
      <Dialog
        title="Python 运行环境"
        subtitle={`数据包预设: ${PYTHON_DATA_PACKAGES.join(", ")}`}
        tone="info"
        actions="enter 保存当前项  ·  esc 返回"
      >
        <Box flexDirection="column">
          {/* pip index-url */}
          <Box marginBottom={1} flexDirection="column">
            <Text color={T.textMuted}>pip index-url</Text>
            <TextInput
              defaultValue={currentRef.current.python.pip.indexUrl}
              onSubmit={(indexUrl) => {
                handleSave({
                  ...currentRef.current,
                  python: {
                    ...currentRef.current.python,
                    pip: {
                      ...currentRef.current.python.pip,
                      indexUrl: indexUrl.trim(),
                    },
                  },
                });
              }}
            />
          </Box>

          {/* pip trusted-host */}
          <Box marginBottom={1} flexDirection="column">
            <Text color={T.textMuted}>pip trusted-host</Text>
            <TextInput
              defaultValue={currentRef.current.python.pip.trustedHost}
              onSubmit={(trustedHost) => {
                handleSave({
                  ...currentRef.current,
                  python: {
                    ...currentRef.current.python,
                    pip: {
                      ...currentRef.current.python.pip,
                      trustedHost: trustedHost.trim(),
                    },
                  },
                });
              }}
            />
          </Box>

          {/* autoInstall */}
          <Box marginBottom={1} flexDirection="column">
            <Text color={T.textMuted}>自动安装 Python 依赖？</Text>
            <Select
              options={boolOptions}
              defaultValue={
                currentRef.current.python.autoInstall ? "true" : "false"
              }
              onChange={(value) => {
                handleSave({
                  ...currentRef.current,
                  python: {
                    ...currentRef.current.python,
                    autoInstall: value === "true",
                  },
                });
              }}
            />
          </Box>

          {/* 初始化 Python 环境 */}
          <Box marginBottom={1} flexDirection="column">
            <Text color={T.textMuted}>立即初始化 Python 环境？</Text>
            <Select
              options={boolOptions}
              onChange={(value) => {
                if (value === "true") {
                  const result = ensurePythonEnvironment(
                    PYTHON_DATA_PACKAGES,
                    currentRef.current,
                  );
                  if (result.ok) {
                    setMessage({
                      text: `Python 环境已就绪：${result.pythonPath}`,
                      variant: "success",
                    });
                  } else {
                    setMessage({
                      text: `Python 环境初始化失败：${result.error}`,
                      variant: "error",
                    });
                  }
                }
                setStep("done");
              }}
            />
          </Box>
        </Box>
      </Dialog>
    );
  }

  // ── Step: 完成 ────────────────────────────────────────────────
  return (
    <Dialog
      title="配置结果"
      subtitle="修改已应用到当前配置文件"
      tone={message?.variant === "error" ? "danger" : "success"}
      actions="esc 返回"
    >
      {message && (
        <Box marginBottom={1}>
          <StatusMessage variant={message.variant}>
            {message.text}
          </StatusMessage>
        </Box>
      )}
      <Text color={T.textMuted}>你可以继续通过 `/config` 返回这里修改其他配置。</Text>
    </Dialog>
  );
}
