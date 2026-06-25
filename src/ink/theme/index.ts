import React from "react";

// ── 终端主题自适应系统 ──────────────────────────────────────────
// 同时感知终端背景明暗与颜色能力，尽量尊重用户现有终端配置。

export type TerminalMode = "dark" | "light";
export type ColorLevel = "none" | "ansi16" | "ansi256" | "truecolor";

type ResolvedColor = string | undefined;

interface TokenScale {
  truecolor: ResolvedColor;
  ansi256?: ResolvedColor;
  ansi16?: ResolvedColor;
  none?: ResolvedColor;
}

interface ThemeScale {
  appBg: TokenScale;
  primary: TokenScale;
  accent: TokenScale;
  cancel: TokenScale;
  textBold: TokenScale;
  textMuted: TokenScale;
  textSubtle: TokenScale;
  inputBg: TokenScale;
  homeBg: TokenScale;
  border: TokenScale;
  slashBg: TokenScale;
  slashFg: TokenScale;
  titleGradient: {
    truecolor: string[];
    ansi256?: string[];
    ansi16?: string[];
    none?: string[];
  };
}

/**
 * 跨平台终端背景色检测。
 *
 * 优先级：
 *   1. ONIONCODE_THEME=light|dark  — 用户显式覆盖，最高优先级
 *   2. COLORFGBG="fg;bg"           — iTerm2 等设置（bg<7→dark, bg>=7→light）
 *   3. 默认 dark                  — 现代开发者终端绝大多数为深色
 *
 * 注：
 *   - 不再对 Apple_Terminal 做默认 light 推断；这个启发式在深色 Profile
 *     或 IDE/中间终端环境里容易误判。Apple Terminal 用户如需浅色主题，
 *     可以显式设置 ONIONCODE_THEME=light。
 */
export function detectTerminalMode(): TerminalMode {
  const explicit = process.env.ONIONCODE_THEME?.toLowerCase();
  if (explicit === "light" || explicit === "dark") return explicit;

  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(";");
    const bg = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(bg)) return bg >= 7 ? "light" : "dark";
  }

  return "dark";
}

/**
 * 颜色能力检测。
 *
 * 优先级：
 *   1. NO_COLOR            → none
 *   2. stdout.getColorDepth() → truecolor / ansi256 / ansi16 / none
 *   3. TERM / COLORTERM 兜底
 */
export function detectColorLevel(): ColorLevel {
  if (process.env.NO_COLOR !== undefined) return "none";

  const depth =
    typeof process.stdout?.getColorDepth === "function"
      ? process.stdout.getColorDepth()
      : 1;

  if (depth >= 24) return "truecolor";
  if (depth >= 8) return "ansi256";
  if (depth >= 4) return "ansi16";

  const colorTerm = process.env.COLORTERM?.toLowerCase() ?? "";
  if (colorTerm.includes("truecolor") || colorTerm.includes("24bit")) {
    return "truecolor";
  }

  const term = process.env.TERM?.toLowerCase() ?? "";
  if (term.includes("256color")) return "ansi256";
  if (term && term !== "dumb") return "ansi16";

  return "none";
}

function pickColor(scale: TokenScale, level: ColorLevel): ResolvedColor {
  switch (level) {
    case "truecolor":
      return scale.truecolor;
    case "ansi256":
      return scale.ansi256 ?? scale.truecolor;
    case "ansi16":
      return scale.ansi16 ?? scale.ansi256 ?? scale.truecolor;
    case "none":
      return scale.none;
  }
}

function pickGradient(
  scale: ThemeScale["titleGradient"],
  level: ColorLevel,
): string[] | undefined {
  switch (level) {
    case "truecolor":
      return scale.truecolor;
    case "ansi256":
      return scale.ansi256 ?? scale.truecolor;
    case "ansi16":
      return scale.ansi16 ?? scale.ansi256 ?? scale.truecolor;
    case "none":
      return scale.none;
  }
}

function resolveTheme(scale: ThemeScale, level: ColorLevel) {
  return {
    appBg: pickColor(scale.appBg, level),
    primary: pickColor(scale.primary, level),
    accent: pickColor(scale.accent, level),
    cancel: pickColor(scale.cancel, level),
    textBold: pickColor(scale.textBold, level),
    textMuted: pickColor(scale.textMuted, level),
    textSubtle: pickColor(scale.textSubtle, level),
    // 保留输入区域背景色；其余区域是否使用背景色由组件自行决定。
    inputBg: pickColor(scale.inputBg, level),
    homeBg: pickColor(scale.homeBg, level),
    border: pickColor(scale.border, level),
    slashBg: pickColor(scale.slashBg, level),
    slashFg: pickColor(scale.slashFg, level),
    titleGradient: pickGradient(scale.titleGradient, level),
  };
}

export const terminalMode = detectTerminalMode();
export const colorLevel = detectColorLevel();

// ── 语义色板 ────────────────────────────────────────────────────
// 组件只消费语义 token，最终颜色值由终端能力决定。

const DARK: ThemeScale = {
  appBg: {
    truecolor: "#000000",
    ansi16: "black",
    none: undefined,
  },
  primary: {
    truecolor: "#3b82f6",
    ansi16: "blue",
    none: undefined,
  },
  accent: {
    truecolor: "#f59e0b",
    ansi16: "yellow",
    none: undefined,
  },
  cancel: {
    truecolor: "#f87171",
    ansi16: "red",
    none: undefined,
  },
  textBold: {
    truecolor: "#e4e4e7",
    ansi16: "white",
    none: undefined,
  },
  textMuted: {
    truecolor: "#9a9aa2",
    ansi16: "gray",
    none: undefined,
  },
  textSubtle: {
    truecolor: "#666670",
    ansi16: "gray",
    none: undefined,
  },
  inputBg: {
    truecolor: "#222225",
    ansi16: "black",
    none: undefined,
  },
  homeBg: {
    truecolor: "#222225",
    ansi16: "black",
    none: undefined,
  },
  border: {
    truecolor: "#3b3b3b",
    ansi16: "gray",
    none: undefined,
  },
  slashBg: {
    truecolor: "#1e3a5f",
    ansi16: "blue",
    none: undefined,
  },
  slashFg: {
    truecolor: "white",
    ansi16: "white",
    none: undefined,
  },
  titleGradient: {
    truecolor: ["#a855f7", "#8b5cf6", "#6366f1", "#3b82f6"],
    ansi16: ["magenta", "blue"],
    none: undefined,
  },
};

const LIGHT: ThemeScale = {
  appBg: {
    truecolor: "#ffffff",
    ansi16: "white",
    none: undefined,
  },
  primary: {
    truecolor: "#2563eb",
    ansi16: "blue",
    none: undefined,
  },
  accent: {
    truecolor: "#d97706",
    ansi16: "yellow",
    none: undefined,
  },
  cancel: {
    truecolor: "#dc2626",
    ansi16: "red",
    none: undefined,
  },
  textBold: {
    truecolor: "#2b313a",
    ansi16: "black",
    none: undefined,
  },
  textMuted: {
    truecolor: "#6b7280",
    ansi16: "gray",
    none: undefined,
  },
  textSubtle: {
    truecolor: "#9ca3af",
    ansi16: "gray",
    none: undefined,
  },
  inputBg: {
    truecolor: "#f5f5f5",
    ansi16: "white",
    none: undefined,
  },
  homeBg: {
    truecolor: "#f5f5f5",
    ansi16: "white",
    none: undefined,
  },
  border: {
    truecolor: "#d4d4d4",
    ansi16: "gray",
    none: undefined,
  },
  slashBg: {
    truecolor: "#dbeafe",
    ansi16: "white",
    none: undefined,
  },
  slashFg: {
    truecolor: "#1e40af",
    ansi16: "blue",
    none: undefined,
  },
  titleGradient: {
    truecolor: ["#7c3aed", "#6d28d9", "#4f46e5", "#2563eb"],
    ansi16: ["magenta", "blue"],
    none: undefined,
  },
};

export const T = resolveTheme(terminalMode === "dark" ? DARK : LIGHT, colorLevel);
export type InkTheme = typeof T;
export type ThemeColorToken = Exclude<keyof InkTheme, "titleGradient">;

export function useInkTheme() {
  return React.useMemo(
    () => ({
      mode: terminalMode,
      colorLevel,
      tokens: T,
      getColor(token: ThemeColorToken) {
        return T[token];
      },
      hasColor: colorLevel !== "none",
    }),
    [],
  );
}
