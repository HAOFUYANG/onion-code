import * as readline from "node:readline";
import chalk from "chalk";
import {
  brand,
  inputBorder,
  formatInputStatus,
  type InputContext,
} from "./style.js";
import {
  formatSlashCommand,
  matchSlashCommands,
  type SlashCommand,
} from "./slash_commands.js";

export type UserInputResult =
  | { type: "message"; text: string }
  | { type: "command"; command: SlashCommand; args?: string }
  | { type: "exit" };

interface InputState {
  buffer: string;
  selectedIndex: number;
  slashDismissed: boolean;
  renderedLines: number;
  /** 上一次渲染时面板是否可见，用于判断是否需要全量重绘 */
  panelVisible: boolean;
  /** 自定义 █ 闪烁光标是否可见 */
  cursorOn: boolean;
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
  const terminalWidth = process.stdout.columns || 80;
  const maxVisible = 10;
  const visibleSuggestions = suggestions.slice(0, maxVisible);

  if (visibleSuggestions.length === 0) {
    return `  ${chalk.dim("没有匹配的命令")}`;
  }

  const maxCmdLen = Math.max(
    ...visibleSuggestions.map((c) => c.name.length + 1),
  );
  const cmdWidth = Math.max(maxCmdLen, 8);
  const descMaxWidth = Math.max(20, terminalWidth - cmdWidth - 8);

  const rows = visibleSuggestions.map((cmd, index) => {
    const selected = index === selectedIndex;
    const indicator = selected ? chalk.magenta("▸") : " ";
    const cmdText = padVisible(`/${cmd.name}`, cmdWidth);
    const desc =
      cmd.description.length > descMaxWidth
        ? `${cmd.description.slice(0, Math.max(0, descMaxWidth - 1))}…`
        : cmd.description;

    if (selected) {
      return `  ${indicator} ${chalk.bold.cyan(cmdText)} ${chalk.dim(desc)}`;
    }
    return `  ${indicator} ${chalk.dim(cmdText)} ${chalk.dim(desc)}`;
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

/**
 * 渲染输入区域。
 *
 * 光标策略 —— 像前端 input 组件一样：
 * - 自定义 █ 闪烁光标：用 chalk.inverse(" ") 渲染反色块字符，定时器控制显隐。
 * - 终端原生光标已隐藏（\x1b[?25l），视觉光标完全由 █ 字符接管。
 * - 正常打字走「快速路径」：只 clearLine + 重写本行。
 * - 面板出现/消失走「全量重绘」：先预留空白行，写完边线+状态后 \x1b[NA 回到空白行写入输入内容。
 */
function render(state: InputState, ctx?: InputContext): void {
  const suggestions = getSuggestions(state);
  const shouldShowPanel =
    suggestions.length > 0 ||
    (state.buffer.startsWith("/") && !state.slashDismissed);

  const prefix = `  ${inputBorder} ${brand.prompt}`;

  // 自定义闪烁光标：反色空格模拟 █ 块状光标
  const cursorChar = state.cursorOn ? chalk.inverse(" ") : " ";
  const content = state.buffer
    ? state.buffer + cursorChar
    : cursorChar + chalk.dim("输入消息，或 / 查看命令...");

  // ── 快速路径：只需更新输入行内容 ──
  const layoutChanged = shouldShowPanel !== state.panelVisible;
  if (state.renderedLines > 0 && !shouldShowPanel && !layoutChanged) {
    readline.cursorTo(process.stdout, 0);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(`${prefix}${content}`);
    return;
  }

  // ── 全量重绘：面板出现/消失/首次渲染 ──
  if (state.renderedLines > 0) {
    // 光标在输入行上 → 先下移到渲染块末尾
    readline.moveCursor(process.stdout, 0, 1 + (ctx ? 1 : 0));
    clearPreviousRender(state.renderedLines);
  }

  // 1. 面板（输入行上方）
  let panelLines = 0;
  if (shouldShowPanel) {
    const panelStr = renderSlashPanel(suggestions, state.selectedIndex);
    process.stdout.write(`\r${panelStr}\n`);
    panelLines = panelStr.split("\n").length;
  }

  // 2. 预留输入行的空白行
  process.stdout.write(`\n`);

  // 3. 边线（输入行下方）
  process.stdout.write(`\r  ${inputBorder}`);

  // 4. 状态行（边线下方）
  if (ctx) {
    process.stdout.write(`\n\r    ${formatInputStatus(ctx)}`);
  }

  // 记录行数
  state.renderedLines = panelLines + 1 + 1 + (ctx ? 1 : 0);
  state.panelVisible = shouldShowPanel;

  // 5. 回到预留的空白行，写入输入内容
  //    状态 + 边线 = 1 或 2 行，\x1b[NA 向上跳 N 行
  const upLines = 1 + (ctx ? 1 : 0);
  process.stdout.write(`\x1b[${upLines}A`);
  process.stdout.write(`\r${prefix}${content}`);
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

export function readUserInput(ctx?: InputContext): Promise<UserInputResult> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return fallbackPrompt();
  }

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();

  // 隐藏终端原生光标，使用自定义 █ 闪烁光标
  process.stdout.write("\x1b[?25l");

  const state: InputState = {
    buffer: "",
    selectedIndex: 0,
    slashDismissed: false,
    renderedLines: 0,
    panelVisible: false,
    cursorOn: true,
  };

  // 光标闪烁定时器：约 530ms 切换一次，模拟输入框光标动画
  const blinkInterval = setInterval(() => {
    state.cursorOn = !state.cursorOn;
    render(state, ctx);
  }, 530);

  render(state, ctx);

  return new Promise((resolve) => {
    const cleanup = () => {
      clearInterval(blinkInterval);
      process.stdin.off("keypress", onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      // 恢复终端原生光标
      process.stdout.write("\x1b[?25h");
      process.stdout.write("\n");
    };

    const finish = (result: UserInputResult) => {
      // 光标在输入行 buffer 末尾，先移到渲染块底部再清除
      if (state.renderedLines > 0) {
        const linesBelow = 1 + (ctx ? 1 : 0);
        // 如果 buffer 为空，光标在 placeholder 位置，需要先回到 buffer 末尾
        // 但 finish 时不需要精确位置，只需下移到底部
        readline.moveCursor(process.stdout, 0, linesBelow);
        clearPreviousRender(state.renderedLines);
      }
      if (state.buffer.trim()) {
        process.stdout.write(
          `  ${chalk.magenta("❯")} ${chalk.dim(state.buffer)}\n`,
        );
      }
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
          render(state, ctx);
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
          render(state, ctx);
        }
        return;
      }

      if (key.name === "backspace") {
        state.buffer = state.buffer.slice(0, -1);
        state.slashDismissed = false;
        normalizeSelection(state);
        render(state, ctx);
        return;
      }

      const suggestions = getSuggestions(state);
      if (key.name === "up" && suggestions.length > 0) {
        state.selectedIndex =
          (state.selectedIndex - 1 + suggestions.length) % suggestions.length;
        render(state, ctx);
        return;
      }

      if (key.name === "down" && suggestions.length > 0) {
        state.selectedIndex = (state.selectedIndex + 1) % suggestions.length;
        render(state, ctx);
        return;
      }

      if (key.name === "tab" && suggestions.length > 0) {
        state.buffer = formatSlashCommand(suggestions[state.selectedIndex]);
        state.slashDismissed = false;
        render(state, ctx);
        return;
      }

      if (key.ctrl && key.name === "u") {
        state.buffer = "";
        state.selectedIndex = 0;
        state.slashDismissed = false;
        render(state, ctx);
        return;
      }

      if (str && !key.ctrl && !key.meta && str >= " ") {
        state.buffer += str;
        state.slashDismissed = false;
        normalizeSelection(state);
        render(state, ctx);
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}
