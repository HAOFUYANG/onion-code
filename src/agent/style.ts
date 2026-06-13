import chalk from "chalk";
import figlet from "figlet";
import boxen from "boxen";

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

// ── 启动画面 ────────────────────────────────────────────────
export interface SplashOptions {
  name: string;
  version: string;
  description: string;
  author: string;
  docs: string;
}

export function splashScreen(opts: SplashOptions): string {
  // 大字名称：figlet 渲染，品红色
  const bigName = chalk.bold.magenta(
    figlet.textSync(opts.name, {
      font: "Standard",
      horizontalLayout: "fitted",
    }),
  );

  // 信息框内容
  const boxContent = [
    `${chalk.dim("version")}      ${chalk.cyan(opts.version)}`,
    `${chalk.dim("description")}  ${chalk.white(opts.description)}`,
    `${chalk.dim("author")}       ${chalk.green(opts.author)}`,
    `${chalk.dim("docs")}         ${chalk.blue.underline(opts.docs)}`,
  ].join("\n");

  const infoBox = boxen(boxContent, {
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: "round",
    borderColor: "magenta",
  } as any);

  // 使用说明
  const usage = [
    chalk.dim("─".repeat(48)),
    `  ${chalk.yellow("▶")} ${chalk.dim("ESC")}   取消当前 AI 请求`,
    `  ${chalk.yellow("▶")} ${chalk.dim("exit")}  退出程序`,
    chalk.dim("─".repeat(48)),
  ].join("\n");

  return `\n${bigName}\n${infoBox}\n${usage}\n`;
}

// ── 欢迎横幅（保留，少用场景）──────────────────────────────────────
export function welcomeBanner(version: string): string {
  const title = chalk.bold.magenta("🧅 onionCode");
  const ver = chalk.dim(`v${version}`);
  const hint = chalk.dim('输入 "exit" 退出');
  return `\n${title} ${ver}  ${chalk.gray("│")}  ${hint}\n${chalk.gray("─".repeat(48))}`;
}
