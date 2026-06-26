import * as readline from "node:readline";
import stringWidth from "string-width";
import chalk from "chalk";
import { InputBuffer } from "./InputBuffer.js";
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

// ── 非 TTY 回退 ─────────────────────────────────────────

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

// ── Slash 面板渲染 ──────────────────────────────────────

function getSuggestions(buffer: InputBuffer): SlashCommand[] {
  const text = buffer.text;
  if (!text.startsWith("/")) return [];
  return matchSlashCommands(text);
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
  const descMaxWidth = Math.max(20, terminalWidth - cmdWidth - 12);

  // ── 标题行 ──
  const header = `  ${chalk.hex("#C084FC")("▸")} ${chalk.bold.white("命令")}  ${chalk.dim(`${visibleSuggestions.length} 项可用`)}`;
  const divider = `  ${chalk.hex("#7C3AED")("─".repeat(Math.min(terminalWidth - 4, 40)))}`;

  // ── 命令行 ──
  const rows = visibleSuggestions.map((cmd, index) => {
    const selected = index === selectedIndex;
    const indicator = selected ? chalk.magenta("▸") : " ";
    const icon = cmd.icon ? `${cmd.icon} ` : "";
    const paddedCmd = `/${cmd.name}`.padEnd(cmdWidth);

    // 选中的行：高亮背景感
    const cmdText = selected
      ? chalk.bold.cyan(paddedCmd)
      : chalk.dim(paddedCmd);

    const desc =
      cmd.description.length > descMaxWidth
        ? `${cmd.description.slice(0, Math.max(0, descMaxWidth - 1))}…`
        : cmd.description;

    // 别名提示
    const aliasHint = cmd.aliases?.length
      ? chalk.dim(`  (${cmd.aliases.map((a) => `/${a}`).join(", ")})`)
      : "";

    if (selected) {
      return `  ${indicator} ${icon}${cmdText}  ${chalk.white(desc)}${aliasHint}`;
    }
    return `  ${indicator} ${icon}${cmdText}  ${chalk.dim(desc)}${aliasHint}`;
  });

  // ── 页脚 ──
  const footer = [
    `  ${chalk.hex("#7C3AED")("─".repeat(Math.min(terminalWidth - 4, 40)))}`,
    `  ${chalk.hex("#C084FC")("tab")} ${chalk.dim("补全")}  ${chalk.hex("#C084FC")("↑↓")} ${chalk.dim("选择")}  ${chalk.hex("#C084FC")("enter")} ${chalk.dim("执行")}  ${chalk.hex("#C084FC")("esc")} ${chalk.dim("关闭")}`,
  ].join("\n");

  return [header, divider, ...rows, footer].join("\n");
}

// ── 输入控制器 ──────────────────────────────────────────

interface InputControllerState {
  buffer: InputBuffer;
  selectedIndex: number;
  slashDismissed: boolean;
  cursorOn: boolean;
  /** 面板上一次渲染时的行数 */
  prevPanelLines: number;
  /** 上一次渲染总行数 */
  renderedLines: number;
  /** 合并连续重绘 */
  redrawScheduled: boolean;
  ctx?: InputContext;
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
  // 确保从干净行开始，不叠加在上次回声/AI 输出之上
  process.stdout.write("\n");

  const state: InputControllerState = {
    buffer: new InputBuffer(),
    selectedIndex: 0,
    slashDismissed: false,
    cursorOn: true,
    prevPanelLines: 0,
    renderedLines: 0,
    redrawScheduled: false,
    ctx,
  };

  // 光标闪烁定时器：530ms 切换一次
  const blinkInterval = setInterval(() => {
    state.cursorOn = !state.cursorOn;
    scheduleRedraw(state);
  }, 530);

  redraw(state);

  return new Promise((resolve) => {
    const onKeypress = makeKeypressHandler(state, (result) => {
      // 先移除监听器防止泄漏到下一次 readUserInput 调用
      process.stdin.off("keypress", onKeypress);
      finishInput(state, result, blinkInterval);
      resolve(result);
    });

    process.stdin.on("keypress", onKeypress);

    // 兜底清理（Ctrl+C / process.exit 等）
    const onExit = () => {
      clearInterval(blinkInterval);
      process.stdin.off("keypress", onKeypress);
      process.stdout.write("\x1b[?25h");
    };
    process.once("exit", onExit);
  });
}

// ── 重绘调度 ────────────────────────────────────────────

function scheduleRedraw(state: InputControllerState): void {
  if (state.redrawScheduled) return;
  state.redrawScheduled = true;
  queueMicrotask(() => {
    state.redrawScheduled = false;
    redraw(state);
  });
}

// ── 核心重绘 ────────────────────────────────────────────
//
// 重绘策略（对齐 InputController 参考实现的 clearLine + cursorTo 模式）：
// 1. 每次 redraw 时，光标在上次渲染的输入行上
// 2. 先移到渲染块顶部，清除所有旧行
// 3. 逐行写入新内容
// 4. 光标归位到输入行的正确列位置

const PREFIX = `  ${inputBorder} ${brand.prompt}`;
const PREFIX_WIDTH = stringWidth(PREFIX);

function redraw(state: InputControllerState): void {
  const stdout = process.stdout;
  if (!stdout.isTTY) return;

  const suggestions = state.slashDismissed ? [] : getSuggestions(state.buffer);
  const shouldShowPanel = suggestions.length > 0;

  // ── 构建输出行 ──
  const lines: string[] = [];

  if (shouldShowPanel) {
    const panel = renderSlashPanel(suggestions, state.selectedIndex);
    lines.push(...panel.split("\n"));
  }

  const cursorChar = state.cursorOn ? chalk.inverse(" ") : " ";
  const bufferText = state.buffer.text;
  const inputContent = bufferText
    ? bufferText + cursorChar
    : cursorChar + chalk.dim("输入消息，或 / 查看命令...");
  lines.push(`${PREFIX}${inputContent}`);
  lines.push(`  ${inputBorder}`);
  if (state.ctx) {
    lines.push(`    ${formatInputStatus(state.ctx)}`);
  }

  // ── 清除旧渲染 ──
  // 光标当前在上次渲染的输入行上（上次 redraw 末尾归位的结果）
  // 需要上移到面板顶部，然后 clearScreenDown
  readline.cursorTo(stdout, 0);
  if (state.prevPanelLines > 0) {
    readline.moveCursor(stdout, 0, -state.prevPanelLines);
  }
  if (state.renderedLines > 0) {
    readline.clearScreenDown(stdout);
  }

  // ── 逐行写入 ──
  for (const line of lines) {
    stdout.write(line + "\n");
    readline.cursorTo(stdout, 0);
  }

  // ── 记录状态 ──
  state.renderedLines = lines.length;
  state.prevPanelLines = shouldShowPanel
    ? lines.length - 2 - (state.ctx ? 1 : 0) // total - input - border - status?
    : 0;

  // ── 光标归位：回到输入行的正确列 ──
  // 循环结束后光标在最后一行之下（col 0），需要上移到输入行
  // fromBottom = 边线(1) + 状态(0|1) + 1(当前行在block下方)
  const fromBottom = 2 + (state.ctx ? 1 : 0);
  readline.moveCursor(stdout, 0, -fromBottom);
  const cursorColumn =
    PREFIX_WIDTH + (bufferText ? stringWidth(bufferText) : 0);
  readline.cursorTo(stdout, cursorColumn);
}

// ── 选中值归一化 ────────────────────────────────────────

function normalizeSelection(
  state: InputControllerState,
  suggestions: SlashCommand[],
): void {
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

// ── 按键处理器工厂 ──────────────────────────────────────

function makeKeypressHandler(
  state: InputControllerState,
  onFinish: (result: UserInputResult) => void,
): (str: string, key: readline.Key) => void {
  return (str: string, key: readline.Key) => {
    if (key.ctrl && key.name === "c") {
      onFinish({ type: "exit" });
      return;
    }

    if (key.name === "return" || key.name === "enter") {
      const text = state.buffer.text.trim();
      if (!text) {
        state.buffer.clear();
        scheduleRedraw(state);
        return;
      }
      if (text.toLowerCase() === "exit") {
        onFinish({ type: "exit" });
        return;
      }

      const suggestions = state.slashDismissed
        ? []
        : getSuggestions(state.buffer);
      if (state.buffer.text.startsWith("/") && suggestions.length > 0) {
        const parts = state.buffer.text.trim().split(/\s+/);
        const args = parts.slice(1).join(" ") || undefined;
        onFinish({
          type: "command",
          command: suggestions[state.selectedIndex],
          args,
        });
        return;
      }

      onFinish({ type: "message", text: state.buffer.text });
      return;
    }

    if (key.name === "escape") {
      if (state.buffer.text.startsWith("/") && !state.slashDismissed) {
        state.slashDismissed = true;
        scheduleRedraw(state);
      }
      return;
    }

    if (key.name === "backspace") {
      state.buffer.backspace();
      state.slashDismissed = false;
      normalizeSelection(state, getSuggestions(state.buffer));
      scheduleRedraw(state);
      return;
    }

    if (key.name === "delete") {
      state.buffer.deleteForward();
      state.slashDismissed = false;
      normalizeSelection(state, getSuggestions(state.buffer));
      scheduleRedraw(state);
      return;
    }

    if (key.name === "left") {
      state.buffer.moveLeft();
      scheduleRedraw(state);
      return;
    }

    if (key.name === "right") {
      state.buffer.moveRight();
      scheduleRedraw(state);
      return;
    }

    if (key.name === "home") {
      state.buffer.moveHome();
      scheduleRedraw(state);
      return;
    }

    if (key.name === "end") {
      state.buffer.moveEnd();
      scheduleRedraw(state);
      return;
    }

    const suggestions = state.slashDismissed
      ? []
      : getSuggestions(state.buffer);

    if (key.name === "up" && suggestions.length > 0) {
      state.selectedIndex =
        (state.selectedIndex - 1 + suggestions.length) % suggestions.length;
      scheduleRedraw(state);
      return;
    }

    if (key.name === "down" && suggestions.length > 0) {
      state.selectedIndex = (state.selectedIndex + 1) % suggestions.length;
      scheduleRedraw(state);
      return;
    }

    if (key.name === "tab" && suggestions.length > 0) {
      state.buffer.clear();
      const cmdText = formatSlashCommand(suggestions[state.selectedIndex]);
      state.buffer.insert(cmdText);
      state.slashDismissed = false;
      scheduleRedraw(state);
      return;
    }

    if (key.ctrl && key.name === "u") {
      state.buffer.clear();
      state.selectedIndex = 0;
      state.slashDismissed = false;
      scheduleRedraw(state);
      return;
    }

    if (str && !key.ctrl && !key.meta && str >= " ") {
      state.buffer.insert(str);
      state.slashDismissed = false;
      normalizeSelection(state, getSuggestions(state.buffer));
      scheduleRedraw(state);
    }
  };
}

// ── 清理 + 输出回显 ────────────────────────────────────
//
// 光标在输入行上；从输入行（或面板顶部）开始清屏，再写回声。

function finishInput(
  state: InputControllerState,
  result: UserInputResult,
  blinkInterval: NodeJS.Timeout,
): void {
  clearInterval(blinkInterval);

  if (process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // ignore
    }
  }

  // 恢复终端原生光标
  process.stdout.write("\x1b[?25h");

  // 光标在输入行上（redraw 末尾归位的结果）
  // 从输入行列 0 开始（有面板则上移到面板顶部），清屏清除整个输入区域
  readline.cursorTo(process.stdout, 0);
  if (state.prevPanelLines > 0) {
    readline.moveCursor(process.stdout, 0, -state.prevPanelLines);
  }
  readline.clearScreenDown(process.stdout);

  // 回显用户输入
  if (result.type === "message" && result.text.trim()) {
    process.stdout.write(`  ${chalk.magenta("❯")} ${chalk.dim(result.text)}\n`);
  } else {
    process.stdout.write("\n");
  }
}
