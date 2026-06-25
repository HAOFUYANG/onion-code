import React from "react";
import { Box, Text } from "ink";
import { T } from "../theme/index.js";

type DialogTone = "default" | "info" | "success" | "danger";

interface DialogProps {
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: DialogTone;
  width?: number;
}

function getToneColor(tone: DialogTone): string {
  switch (tone) {
    case "info":
      return T.primary;
    case "success":
      return T.accent;
    case "danger":
      return T.cancel;
    default:
      return T.border;
  }
}

export function Dialog({
  title,
  children,
  actions,
  subtitle,
  tone = "default",
  width = 76,
}: DialogProps) {
  const toneColor = getToneColor(tone);

  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center" paddingY={1}>
      <Box
        width={width}
        flexDirection="column"
        borderStyle="round"
        borderColor={T.border}
        paddingX={2}
        paddingY={1}
        backgroundColor={T.homeBg}
      >
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text color={toneColor}>{"● "}</Text>
            <Text color={T.textBold}>{title}</Text>
          </Box>
          {subtitle ? (
            <Box marginTop={1}>
              <Text color={T.textMuted}>{subtitle}</Text>
            </Box>
          ) : null}
        </Box>

        <Box flexDirection="column">{children}</Box>

        {actions ? (
          <Box marginTop={1} borderTop={true} borderStyle="single" borderColor={T.border}>
            <Box paddingTop={1}>
              <Text color={T.textSubtle}>{actions}</Text>
            </Box>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
