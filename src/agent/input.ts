import * as readline from "readline";
import chalk from "chalk";
import { brand } from "./style";
import {
  formatSlashCommand,
  matchSlashCommands,
  type SlashCommand,
} from "./slash_commands";

export type UserInputResult =
  | { type: "message"; text: string }
  | { type: "command"; command: SlashCommand; args?: string }
  | { type: "exit" };

interface InputState {
  buffer: string;
  selectedIndex: number;
  slashDismissed: boolean;
  renderedLines: number;
}

function fallbackPrompt(): Promise<UserInputResult> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(brand.prompt, (answer) => {
      rl.close();
      if (answer.toLowerCase() === "exit") {
        resolve({ type: "exit" });
        return;
      }

      const matches = answer.startsWith("/") ? matchSlashCommands(answer) : [];
      if (answer.startsWith("/") && matches.length > 0) {
        const parts = answer.trim().split(/\s+/);
        const args = parts.slice(1).join(" ") || undefined;
        resolve({ type: "command", command: matches[0], args });
        return;
      }

      resolve({ type: "message", text: answer });
    });
  });
}

function getSuggestions(state: InputState): SlashCommand[] {
  if (!state.buffer.startsWith("/") || state.slashDismissed) return [];
  return matchSlashCommands(state.buffer);
}

function visibleLength(value: string): number {
  return value.replace(/\u001b\[[0-9;]*m/g, "").length;
}

function padVisible(value: string, width: number): string {
  const diff = width - visibleLength(value);
  return diff > 0 ? `${value}${" ".repeat(diff)}` : value;
}

function renderSlashPanel(
  suggestions: SlashCommand[],
  selectedIndex: number,
): string {
  const terminalWidth = process.stdout.columns || 100;
  const menuWidth = Math.max(48, Math.min(92, terminalWidth - 6));
  const commandWidth = 16;
  const maxVisible = 10;
  const visibleSuggestions = suggestions.slice(0, maxVisible);

  if (visibleSuggestions.length === 0) {
    const empty = padVisible(chalk.dim("  没有匹配的命令"), menuWidth);
    return `  ${empty}`;
  }

  const rows = visibleSuggestions.map((cmd, index) => {
    const selected = index === selectedIndex;
    const commandText = padVisible(`/${cmd.name}`, commandWidth);
    const descriptionWidth = menuWidth - commandWidth - 2;
    const description =
      cmd.description.length > descriptionWidth
        ? `${cmd.description.slice(0, Math.max(0, descriptionWidth - 1))}…`
        : cmd.description;

    const row = padVisible(`${commandText}  ${description}`, menuWidth);

    if (selected) {
      return `  ${chalk.bgHex("#f4b183").black(row)}`;
    }

    return `  ${chalk.bold.white(commandText)}  ${chalk.dim(description)}`;
  });

  const footer = `  ${chalk.dim("tab 补全  ↑↓ 选择  enter 执行  esc 关闭")}`;
  return [...rows, footer].join("\n");
}

function clearPreviousRender(lines: number): void {
  if (lines <= 0) return;
  readline.moveCursor(process.stdout, 0, -(lines - 1));
  readline.cursorTo(process.stdout, 0);
  readline.clearScreenDown(process.stdout);
}

function render(state: InputState): void {
  clearPreviousRender(state.renderedLines);

  const suggestions = getSuggestions(state);
  const inputLine = `${brand.prompt}${state.buffer}`;
  const shouldShowPanel =
    suggestions.length > 0 ||
    (state.buffer.startsWith("/") && !state.slashDismissed);
  const panel = shouldShowPanel
    ? `${renderSlashPanel(suggestions, state.selectedIndex)}\n`
    : "";
  const output = `${panel}${inputLine}`;

  process.stdout.write(output);
  state.renderedLines = output.split("\n").length;
}

function normalizeSelection(state: InputState): void {
  const suggestions = getSuggestions(state);
  if (suggestions.length === 0) {
    state.selectedIndex = 0;
    return;
  }
  if (state.selectedIndex >= suggestions.length) {
    state.selectedIndex = suggestions.length - 1;
  }
  if (state.selectedIndex < 0) {
    state.selectedIndex = 0;
  }
}

export function readUserInput(): Promise<UserInputResult> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return fallbackPrompt();
  }

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  const state: InputState = {
    buffer: "",
    selectedIndex: 0,
    slashDismissed: false,
    renderedLines: 0,
  };

  render(state);

  return new Promise((resolve) => {
    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdout.write("\n");
    };

    const finish = (result: UserInputResult) => {
      clearPreviousRender(state.renderedLines);
      process.stdout.write(`${brand.prompt}${state.buffer}\n`);
      cleanup();
      resolve(result);
    };

    const onKeypress = (str: string, key: readline.Key) => {
      if (key.ctrl && key.name === "c") {
        finish({ type: "exit" });
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        const trimmed = state.buffer.trim();
        if (!trimmed) {
          state.buffer = "";
          render(state);
          return;
        }
        if (trimmed.toLowerCase() === "exit") {
          finish({ type: "exit" });
          return;
        }

        const suggestions = getSuggestions(state);
        if (state.buffer.startsWith("/") && suggestions.length > 0) {
          // 解析命令名后面的参数（如 /rewind <thread_id>）
          const parts = state.buffer.trim().split(/\s+/);
          const args = parts.slice(1).join(" ") || undefined;
          finish({
            type: "command",
            command: suggestions[state.selectedIndex],
            args,
          });
          return;
        }

        finish({ type: "message", text: state.buffer });
        return;
      }

      if (key.name === "escape") {
        if (state.buffer.startsWith("/") && !state.slashDismissed) {
          state.slashDismissed = true;
          render(state);
        }
        return;
      }

      if (key.name === "backspace") {
        state.buffer = state.buffer.slice(0, -1);
        state.slashDismissed = false;
        normalizeSelection(state);
        render(state);
        return;
      }

      const suggestions = getSuggestions(state);
      if (key.name === "up" && suggestions.length > 0) {
        state.selectedIndex =
          (state.selectedIndex - 1 + suggestions.length) % suggestions.length;
        render(state);
        return;
      }

      if (key.name === "down" && suggestions.length > 0) {
        state.selectedIndex = (state.selectedIndex + 1) % suggestions.length;
        render(state);
        return;
      }

      if (key.name === "tab" && suggestions.length > 0) {
        state.buffer = formatSlashCommand(suggestions[state.selectedIndex]);
        state.slashDismissed = false;
        render(state);
        return;
      }

      if (key.ctrl && key.name === "u") {
        state.buffer = "";
        state.selectedIndex = 0;
        state.slashDismissed = false;
        render(state);
        return;
      }

      if (str && !key.ctrl && !key.meta && str >= " ") {
        state.buffer += str;
        state.slashDismissed = false;
        normalizeSelection(state);
        render(state);
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}
