import chalk from "chalk";

// ── 品牌标识 ──────────────────────────────────────────────
export const brand = {
  /** 🧅 onion 标签：粗体品红色 */
  onion: chalk.bold.magenta("🧅 onion"),
  /** 用户输入提示符 */
  prompt: chalk.bold.green("❯ "),
};

// ── 工具调用日志 ──────────────────────────────────────────
/**
 * 生成带颜色的工具调用日志
 * 效果: ⚙ [tool-name] called: "detail"
 */
export function toolLog(toolName: string, detail?: string): string {
  const badge = chalk.yellow(`⚙ ${chalk.bold(`[${toolName}]`)}`);
  const tag = chalk.dim("called");
  const info = detail ? chalk.cyan(`"${detail}"`) : "";
  return `\n${badge} ${tag} ${info}`;
}

/**
 * 生成带代码行数的工具调用日志（run_js / run_py 等）
 */
export function toolLogLines(toolName: string, lines: number): string {
  const badge = chalk.yellow(`⚙ ${chalk.bold(`[${toolName}]`)}`);
  const tag = chalk.dim("called");
  const info = chalk.cyan(`(${lines} lines)`);
  return `\n${badge} ${tag} ${info}`;
}

// ── 状态消息 ──────────────────────────────────────────────
export const status = {
  /** 已停止 */
  stopped: chalk.yellow("\n\n  ⏹ 已停止\n\n"),
  /** 再见 */
  bye: chalk.magenta("👋 再见！"),
  /** 错误 */
  error: (msg: string) => chalk.red(`⚠ ${msg}`),
};

// ── 欢迎横幅 ──────────────────────────────────────────────
export function welcomeBanner(version: string): string {
  const title = chalk.bold.magenta("🧅 onionCode");
  const ver = chalk.dim(`v${version}`);
  const hint = chalk.dim('输入 "exit" 退出');
  return `\n${title} ${ver}  ${chalk.gray("│")}  ${hint}\n${chalk.gray("─".repeat(48))}`;
}
