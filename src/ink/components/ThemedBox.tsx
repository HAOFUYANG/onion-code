import React from "react";
import { Box } from "ink";
import { useInkTheme, type ThemeColorToken } from "../theme/index.js";

type InkBoxProps = React.ComponentProps<typeof Box>;

interface ThemedBoxProps extends InkBoxProps {
  backgroundVariant?: ThemeColorToken;
  borderVariant?: ThemeColorToken;
}

export function ThemedBox({
  backgroundVariant,
  borderVariant,
  backgroundColor,
  borderColor,
  children,
  ...rest
}: ThemedBoxProps) {
  const theme = useInkTheme();

  return (
    <Box
      backgroundColor={
        backgroundVariant ? theme.getColor(backgroundVariant) : backgroundColor
      }
      borderColor={borderVariant ? theme.getColor(borderVariant) : borderColor}
      {...rest}
    >
      {children}
    </Box>
  );
}
