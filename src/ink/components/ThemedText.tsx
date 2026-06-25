import React from "react";
import { Text } from "ink";
import { useInkTheme, type ThemeColorToken } from "../theme/index.js";

type InkTextProps = React.ComponentProps<typeof Text>;

interface ThemedTextProps extends InkTextProps {
  variant?: ThemeColorToken;
}

export function ThemedText({
  variant,
  color,
  children,
  ...rest
}: ThemedTextProps) {
  const theme = useInkTheme();
  const resolvedColor = variant ? theme.getColor(variant) : color;

  return (
    <Text color={resolvedColor} {...rest}>
      {children}
    </Text>
  );
}
