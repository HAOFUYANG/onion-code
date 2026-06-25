import React from "react";
import { Box, useStdout } from "ink";
import { useInkTheme, type ThemeColorToken } from "../theme/index.js";
import { ThemedBox } from "./ThemedBox.js";
import { ThemedText } from "./ThemedText.js";

type DialogTone = "default" | "info" | "success" | "danger";

interface DialogProps {
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: DialogTone;
  width?: number;
}

function getToneColor(tone: DialogTone): ThemeColorToken {
  switch (tone) {
    case "info":
      return "primary";
    case "success":
      return "accent";
    case "danger":
      return "cancel";
    default:
      return "border";
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
  const theme = useInkTheme();
  const toneColor = getToneColor(tone);
  const { stdout } = useStdout();
  const columns = stdout.columns ?? width;
  const resolvedWidth = Math.max(36, Math.min(width, columns - 4));

  return (
    <Box flexGrow={1} justifyContent="center" alignItems="center" paddingY={1}>
      <ThemedBox
        width={resolvedWidth}
        flexDirection="column"
        borderStyle="round"
        borderVariant="border"
        paddingX={2}
        paddingY={1}
        backgroundVariant="homeBg"
      >
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <ThemedText variant={toneColor}>{"● "}</ThemedText>
            <ThemedText variant="textBold">{title}</ThemedText>
          </Box>
          {subtitle ? (
            <Box marginTop={1}>
              <ThemedText variant="textMuted">{subtitle}</ThemedText>
            </Box>
          ) : null}
        </Box>

        <Box flexDirection="column">{children}</Box>

        {actions ? (
          <Box
            marginTop={1}
            borderTop={true}
            borderStyle="single"
            borderColor={theme.getColor("border")}
          >
            <Box paddingTop={1}>
              <ThemedText variant="textSubtle">{actions}</ThemedText>
            </Box>
          </Box>
        ) : null}
      </ThemedBox>
    </Box>
  );
}
