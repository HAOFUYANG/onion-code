import chalk from "chalk";
import figlet from "figlet";
import boxen from "boxen";
import { createRequire } from "node:module";

// ── 加载实体 Doom 字体（█ 块字符，非空心轮廓）──
const require = createRequire(import.meta.url);
try {
  const doomFont = require("figlet/importable-fonts/Doom");
  figlet.parseFont("Doom", doomFont);
} catch {
  // Doom 不可用时回退到 Standard
}

// ── 主题色 ──────────────────────────────────────────────
export const theme = {
  primary: "#C026D3", // magenta
  secondary: "#7C3AED", // purple
  accent: "#06B6D4", // cyan
  success: "#10B981", // green
  warning: "#F59E0B", // amber
  error: "#EF4444", // red
};

// ── 品牌标识 ──────────────────────────────────────────────
export const brand = {
  /** 🧅 onion 标签：粗体品红色 */
  onion: chalk.bold.magenta("🧅"),
  /** onion 全名标签 */
  onionName: chalk.bold.magenta("🧅 onion"),
  /** 用户输入提示符 — 主题色 */
  prompt: chalk.bold.magenta("❯ "),
};

// ── 输入框左侧主题色边线 ──────────────────────────────────
export const inputBorder = chalk.magenta("┃");

// ── 输入框上下文信息 ──────────────────────────────────────
export interface InputContext {
  model: string;
  threadId: string;
  messageCount: number;
  lastResponseMs: number | null;
}

/**
 * 格式化输入框下方的状态行
 * 效果: 🤖 model  ·  🧵 thread  ·  💬 N msgs  ·  ⏱ Xs
 */
export function formatInputStatus(ctx: InputContext): string {
  const sep = chalk.dim("  ·  ");
  const parts: string[] = [];

  parts.push(`${chalk.cyan("🤖")} ${chalk.dim(ctx.model)}`);
  parts.push(`${chalk.magenta("🧵")} ${chalk.dim(ctx.threadId)}`);
  parts.push(
    `${chalk.yellow("💬")} ${chalk.dim(`${ctx.messageCount} msgs`)}`,
  );
  if (ctx.lastResponseMs !== null) {
    const secs = (ctx.lastResponseMs / 1000).toFixed(1);
    parts.push(`${chalk.green("⏱")} ${chalk.dim(`${secs}s`)}`);
  }

  return parts.join(sep);
}

// ── 用户消息回显 ──────────────────────────────────────────
/**
 * 格式化用户消息回显，提交后以 dim 样式 + 主题色箭头显示
 */
export function userEcho(text: string): string {
  const lines = text.split("\n");
  const indented = lines.map((l) => chalk.dim(l)).join(`\n  ${chalk.dim("❯")} `);
  return `\n  ${chalk.magenta("❯")} ${indented}\n`;
}

// ── 助手回复前缀 ──────────────────────────────────────────
/**
 * 助手回复前缀：换行 + 🧅 + 空格
 */
export function assistantPrefix(): string {
  return `\n  ${brand.onion} `;
}

// ── 工具调用日志（丰富配色，每个工具有独立图标）─────────────
const TOOL_STYLES: Record<string, { icon: string; color: (s: string) => string }> = {
  exec: { icon: "⚙", color: chalk.yellow },
  run_js: { icon: "⚡", color: chalk.green },
  run_py: { icon: "🐍", color: chalk.blue },
  read_file: { icon: "📖", color: chalk.cyan },
  write_file: { icon: "📝", color: chalk.magenta },
  web_search: { icon: "🔍", color: chalk.cyan },
  web_fetch: { icon: "🌐", color: chalk.blue },
  search: { icon: "🔍", color: chalk.gray },
  load_skill: { icon: "✨", color: chalk.magenta },
};

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/**
 * 生成带颜色图标和详情的工具调用日志
 * 效果: ⚙ exec "ls -la"
 */
export function toolLog(toolName: string, detail?: string): string {
  const style = TOOL_STYLES[toolName] ?? { icon: "⏺", color: chalk.yellow };
  const icon = style.color(style.icon);
  const name = chalk.bold(toolName);
  const info = detail ? chalk.dim(` "${truncate(detail, 60)}"`) : "";
  return `\n  ${icon} ${name}${info}`;
}

/**
 * 生成带代码行数的工具调用日志（run_js / run_py 等）
 * 效果: 🐍 run_py (5 lines)
 */
export function toolLogLines(toolName: string, lines: number): string {
  const style = TOOL_STYLES[toolName] ?? { icon: "⏺", color: chalk.yellow };
  const icon = style.color(style.icon);
  const name = chalk.bold(toolName);
  const info = chalk.dim(` (${lines} lines)`);
  return `\n  ${icon} ${name}${info}`;
}

// ── 状态消息 ──────────────────────────────────────────────
export const status = {
  /** 已停止 */
  stopped: chalk.yellow("\n  ⏹ 已停止\n"),
  /** 再见 */
  bye: chalk.magenta("\n  🧅 see you next time\n"),
  /** 错误 */
  error: (msg: string) => chalk.red(`  ⚠ ${msg}`),
};

// ── 分割线 ────────────────────────────────────────────────
export function divider(width?: number): string {
  const w = width ?? Math.min(process.stdout.columns || 60, 60);
  return chalk.dim("─".repeat(w));
}

// ── 渐变色工具 ────────────────────────────────────────────
function interpolateColor(c1: string, c2: string, ratio: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function gradientText(text: string, c1: string, c2: string): string {
  const lines = text.split("\n").filter((l) => l.trim());
  const n = lines.length;
  return lines
    .map((line, i) => {
      const ratio = n > 1 ? i / (n - 1) : 0;
      const color = interpolateColor(c1, c2, ratio);
      return chalk.hex(color)(line);
    })
    .join("\n");
}

// ── 启动画面 ────────────────────────────────────────────────
export interface SplashOptions {
  name: string;
  version: string;
  description: string;
  author: string;
  docs: string;
}

export function splashScreen(opts: SplashOptions): string {
  // Doom 实体字体（█ 块填充），回退 Standard
  const font = "Doom";
  const bigName = gradientText(
    figlet.textSync(opts.name, { font, horizontalLayout: "fitted" }),
    "#F0ABFC", // 极亮品红
    "#A78BFA", // 亮紫
  );

  // 信息面板（双线边框，居中）
  const infoLines = [
    `${chalk.hex("#F0ABFC").bold("🧅")}  ${chalk.bold.white("onionCode")}`,
    "",
    `${chalk.hex("#C084FC")("◆")} ${chalk.dim("版本")}  ${chalk.cyan(`v${opts.version}`)}`,
    `${chalk.hex("#C084FC")("◆")} ${chalk.dim("简介")}  ${chalk.white(opts.description)}`,
    `${chalk.hex("#C084FC")("◆")} ${chalk.dim("作者")}  ${chalk.green(opts.author)}  ${chalk.dim("·")}  ${chalk.blue.underline(opts.docs)}`,
  ].join("\n");

  const infoBox = boxen(infoLines, {
    padding: { top: 1, bottom: 1, left: 3, right: 3 },
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
    borderStyle: "double",
    borderColor: "#A855F7",
    float: "center",
  } as any);

  // 快捷操作
  const tips = [
    `  ${chalk.hex("#C084FC")("▶")} ${chalk.dim("输入内容")} ${chalk.white("开始对话")}    ${chalk.hex("#C084FC")("▶")} ${chalk.cyan("/")} ${chalk.dim("打开命令面板")}    ${chalk.hex("#C084FC")("▶")} ${chalk.cyan("ESC")} ${chalk.dim("中断")}    ${chalk.hex("#C084FC")("▶")} ${chalk.cyan("exit")} ${chalk.dim("退出")}`,
  ].join("\n");

  return `\n${bigName}\n\n${infoBox}\n\n${tips}\n`;
}

// ── 欢迎横幅（保留，少用场景）──────────────────────────────────────
export function welcomeBanner(version: string): string {
  const title = chalk.bold.magenta("🧅 onionCode");
  const ver = chalk.dim(`v${version}`);
  return `\n  ${title} ${ver}\n  ${chalk.dim("─".repeat(40))}`;
}
