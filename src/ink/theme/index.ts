// ── 终端主题自适应系统 ──────────────────────────────────────────
// 参考 OpenCode system theme：根据终端背景自动切换 light/dark 色板，
// 确保白色终端下文字与 UI 元素同样清晰美观。

export type TerminalMode = "dark" | "light";

/**
 * 检测终端背景模式。
 * 优先读取 COLORFGBG 环境变量（格式 "fg;bg"，值为 ANSI 颜色索引 0-15）：
 *   "15;0" → 白字黑底 → dark
 *   "0;15" → 黑字白底 → light
 * 无法检测时默认 dark（最常见终端配置）。
 */
export function detectTerminalMode(): TerminalMode {
  // 1. TERM_PROGRAM_VERSION 不含主题信息，先检查 TERM_PROGRAM
  // macOS Terminal.app 默认白色背景，系统不设 COLORFGBG
  const termProgram = process.env.TERM_PROGRAM;
  if (termProgram === "Apple_Terminal") {
    // Apple Terminal 默认白底，除非用户显式设置了暗色 Profile
    // 用 COLORFGBG 覆盖此默认值（如果存在）
    // → 先走 COLORFGBG 判断，最终 fallback 返回 light
  }

  // 2. COLORFGBG：iTerm2 / 部分终端会设置该变量
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(";");
    const bg = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(bg)) {
      // ANSI 颜色索引：0=黑,7=白,8=暗灰,15=亮白
      // bg >= 7（白/亮白）→ light；其余 → dark
      return bg >= 7 ? "light" : "dark";
    }
  }

  // 3. COLORTERM / NO_COLOR 等标准环境变量
  if (process.env.NO_COLOR !== undefined) return "light";

  // 4. Apple Terminal fallback → light（白底）
  if (termProgram === "Apple_Terminal") return "light";

  // 5. 其他终端（iTerm2/Warp/Alacritty 等）默认 dark
  return "dark";
}

export const terminalMode = detectTerminalMode();

// ── 语义色板 ────────────────────────────────────────────────────
// 每个语义 token 在 dark/light 下有不同值，确保对比度始终达标。
// 简化原 18 个 C token → 13 个语义 T token，消除冗余别名。

const DARK = {
  primary: "#3b82f6", // 蓝 — 主强调色（竖线/标签/图标）
  accent: "#f59e0b", // 橙 — 次强调色（Tip/high/spinner）
  cancel: "#f87171", // 红 — 中断/错误
  textBold: "#e4e4e7", // 亮灰白 — 比纯白更克制，接近 OpenCode 小字观感
  textMuted: "#9a9aa2", // 中灰 — 辅助文本（说明/分隔）
  textSubtle: "#666670", // 深灰 — 极弱对比（版本号/弱提示）
  inputBg: "#222225", // 深灰黑 — 输入区背景
  homeBg: "#222225", // 同上 — 首页输入区背景
  border: "#3b3b3b", // 暗灰 — 边框
  slashBg: "#1e3a5f", // 深蓝 — slash 高亮背景
  slashFg: "white", // 白 — slash 高亮前景
  titleGradient: ["#a855f7", "#8b5cf6", "#6366f1", "#3b82f6"],
};

const LIGHT = {
  primary: "#2563eb", // 深蓝 — 白底上更易辨认的强调色
  accent: "#d97706", // 深橙 — 白底上避免过亮的橙色
  cancel: "#dc2626", // 深红 — 白底上更醒目
  textBold: "#2b313a", // 近黑灰 — 高对比但不生硬
  textMuted: "#6b7280", // 中灰 — 白底辅助文字
  textSubtle: "#9ca3af", // 浅灰 — 白底上的极弱对比
  inputBg: "#f5f5f5", // 浅灰 — 输入区背景
  homeBg: "#f5f5f5", // 同上 — 首页输入区背景
  border: "#d4d4d4", // 浅灰 — 边框
  slashBg: "#dbeafe", // 淡蓝 — slash 高亮背景
  slashFg: "#1e40af", // 深蓝 — slash 高亮前景
  titleGradient: ["#7c3aed", "#6d28d9", "#4f46e5", "#2563eb"],
};

export const T = terminalMode === "dark" ? DARK : LIGHT;
