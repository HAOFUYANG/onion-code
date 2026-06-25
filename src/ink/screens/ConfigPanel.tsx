import React from "react";
import { Box, useInput } from "ink";
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
import { ThemedText } from "../components/ThemedText.js";

// ── 配置步骤枚举 ────────────────────────────────────────────────
type Step =
  | "module"
  | "pipIndexUrl"
  | "pipTrustedHost"
  | "autoInstall"
  | "initPython"
  | "done";

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
  const [draft, setDraft] = React.useState<AppConfig>(() => loadConfig());

  const saveDraft = React.useCallback(
    (nextDraft: AppConfig = draft, nextMessage?: typeof message) => {
      saveConfig(nextDraft);
      setDraft(nextDraft);
      setMessage(
        nextMessage ?? {
          text: `配置已保存到 ${getConfigPath()}`,
          variant: "success",
        },
      );
      setStep("done");
    },
    [draft, message],
  );

  const goBack = React.useCallback(() => {
    if (step === "module") {
      onClose();
      return;
    }
    if (step === "pipIndexUrl" || step === "done") {
      setStep("module");
      return;
    }
    if (step === "pipTrustedHost") setStep("pipIndexUrl");
    if (step === "autoInstall") setStep("pipTrustedHost");
    if (step === "initPython") setStep("autoInstall");
  }, [onClose, step]);

  // ESC 按层级返回；只有在模块首页才关闭配置面板。
  useInput((_input, key) => {
    if (key.escape) goBack();
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
            <ThemedText variant="textMuted">
              选择要配置的模块。后续可以继续扩展模型、主题和权限等页面。
            </ThemedText>
          </Box>
          <Select
            options={moduleOptions}
            onChange={(value) => {
              if (value === "exit") {
                onClose();
              } else {
                setStep("pipIndexUrl");
              }
            }}
          />
        </Box>
      </Dialog>
    );
  }

  // ── Step: pip index-url ─────────────────────────────────────
  if (step === "pipIndexUrl") {
    return (
      <Dialog
        title="Python 运行环境"
        subtitle={`数据包预设: ${PYTHON_DATA_PACKAGES.join(", ")}`}
        tone="info"
        actions="enter 下一项  ·  esc 返回"
      >
        <Box flexDirection="column">
          <ThemedText variant="textMuted">pip index-url</ThemedText>
          <TextInput
            defaultValue={draft.python.pip.indexUrl}
            onSubmit={(indexUrl) => {
              setDraft((current) => ({
                ...current,
                python: {
                  ...current.python,
                  pip: {
                    ...current.python.pip,
                    indexUrl: indexUrl.trim(),
                  },
                },
              }));
              setStep("pipTrustedHost");
            }}
          />
        </Box>
      </Dialog>
    );
  }

  // ── Step: pip trusted-host ───────────────────────────────────
  if (step === "pipTrustedHost") {
    return (
      <Dialog
        title="Python 运行环境"
        subtitle="pip trusted-host"
        tone="info"
        actions="enter 下一项  ·  esc 返回"
      >
        <Box flexDirection="column">
          <ThemedText variant="textMuted">pip trusted-host</ThemedText>
          <TextInput
            defaultValue={draft.python.pip.trustedHost}
            onSubmit={(trustedHost) => {
              setDraft((current) => ({
                ...current,
                python: {
                  ...current.python,
                  pip: {
                    ...current.python.pip,
                    trustedHost: trustedHost.trim(),
                  },
                },
              }));
              setStep("autoInstall");
            }}
          />
        </Box>
      </Dialog>
    );
  }

  // ── Step: autoInstall ────────────────────────────────────────
  if (step === "autoInstall") {
    return (
      <Dialog
        title="Python 运行环境"
        subtitle="自动安装 Python 依赖"
        tone="info"
        actions="enter 下一项  ·  esc 返回"
      >
        <Box flexDirection="column">
          <ThemedText variant="textMuted">自动安装 Python 依赖？</ThemedText>
          <Select
            options={boolOptions}
            defaultValue={draft.python.autoInstall ? "true" : "false"}
            onChange={(value) => {
              setDraft((current) => ({
                ...current,
                python: {
                  ...current.python,
                  autoInstall: value === "true",
                },
              }));
              setStep("initPython");
            }}
          />
        </Box>
      </Dialog>
    );
  }

  // ── Step: 初始化 Python 环境 ─────────────────────────────────
  if (step === "initPython") {
    return (
      <Dialog
        title="Python 运行环境"
        subtitle="保存配置"
        tone="info"
        actions="enter 保存  ·  esc 返回"
      >
        <Box flexDirection="column">
          <ThemedText variant="textMuted">立即初始化 Python 环境？</ThemedText>
          <Select
            options={boolOptions}
            onChange={(value) => {
              if (value !== "true") {
                saveDraft(draft);
                return;
              }

              saveConfig(draft);
              const result = ensurePythonEnvironment(PYTHON_DATA_PACKAGES, draft);
              setMessage(
                result.ok
                  ? {
                      text: `Python 环境已就绪：${result.pythonPath}`,
                      variant: "success",
                    }
                  : {
                      text: `Python 环境初始化失败：${result.error}`,
                      variant: "error",
                    },
              );
              setStep("done");
            }}
          />
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
      actions="esc 返回配置中心"
    >
      {message && (
        <Box marginBottom={1}>
          <StatusMessage variant={message.variant}>
            {message.text}
          </StatusMessage>
        </Box>
      )}
      <ThemedText variant="textMuted">
        你可以继续通过 `/config` 返回这里修改其他配置。
      </ThemedText>
    </Dialog>
  );
}
