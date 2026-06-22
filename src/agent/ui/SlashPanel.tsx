import React from "react";
import { Box, Text } from "ink";
import type { SlashCommand } from "../slash_commands.js";

interface SlashPanelProps {
  suggestions: SlashCommand[];
  selectedIndex: number;
}

/**
 * TipTap / OpenCode 风格的 slash 命令下拉面板。
 * 紧贴输入行上方渲染，命令名左对齐，描述右侧 dim 色。
 * 选中行整行橙色背景高亮。
 */
export function SlashPanel({ suggestions, selectedIndex }: SlashPanelProps) {
  const maxVisible = 10;
  const visible = suggestions.slice(0, maxVisible);

  if (visible.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text dimColor>没有匹配的命令</Text>
      </Box>
    );
  }

  const maxCmdLen = Math.max(...visible.map((c) => c.name.length + 1), 8);

  return (
    <Box flexDirection="column">
      {visible.map((cmd, index) => {
        const isSelected = index === selectedIndex;
        const cmdLabel = `/${cmd.name}`.padEnd(maxCmdLen);
        return (
          <Box key={cmd.name} paddingLeft={2}>
            {isSelected ? (
              <Text color="black" backgroundColor="yellow">
                {` ${cmdLabel} `}
              </Text>
            ) : (
              <Text dimColor>{` ${cmdLabel} `}</Text>
            )}
            <Text dimColor>{cmd.description}</Text>
          </Box>
        );
      })}
      <Box paddingLeft={2}>
        <Text dimColor>tab 补全 ↑↓ 选择 enter 执行 esc 关闭</Text>
      </Box>
    </Box>
  );
}
