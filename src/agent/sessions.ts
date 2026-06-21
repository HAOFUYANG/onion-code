import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";
import chalk from "chalk";
import Table from "cli-table3";
import { getDataDir } from "./config.js";

// ── UUIDv7 时间戳提取 ────────────────────────────────────────
// UUIDv7 格式：xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
// 前 48 位（高位 32 + 中间 16）为 Unix 毫秒时间戳
function uuidv7ToMs(uuid: string): number | null {
  try {
    const hex = uuid.replace(/-/g, "");
    const msPart = hex.slice(0, 12); // 前 48 bit = 12 hex chars
    return parseInt(msPart, 16);
  } catch {
    return null;
  }
}

// ── 相对时间格式化 ────────────────────────────────────────────
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  // 超过 30 天显示具体日期
  return new Date(ms).toLocaleDateString("zh-CN");
}

// ── 会话行结构 ────────────────────────────────────────────────
export interface SessionRow {
  threadId: string;
  lastQuestion: string;
  time: string;
}

// ── 校验 thread_id 是否存在 ─────────────────────────────────
export function threadExists(threadId: string): boolean {
  const dbPath = path.join(getDataDir(), "checkpointer.db");
  if (!fs.existsSync(dbPath)) return false;

  const db = new Database(dbPath, { readonly: true });
  try {
    const row = db
      .prepare(`SELECT 1 FROM writes WHERE thread_id = ? LIMIT 1`)
      .get(threadId);
    return row !== undefined;
  } finally {
    db.close();
  }
}

// ── 查询最近 20 条会话 ────────────────────────────────────────
export function querySessions(limit = 20): SessionRow[] {
  const dbPath = path.join(getDataDir(), "checkpointer.db");
  if (!fs.existsSync(dbPath)) return [];

  const db = new Database(dbPath, { readonly: true });

  try {
    // 每个 thread 取最早那条 user 消息（first checkpoint_id），
    // 按最近活跃（max checkpoint_id）倒序排列
    const rows = db
      .prepare(
        `
      SELECT
        w.thread_id,
        w.checkpoint_id,
        w.value
      FROM writes w
      INNER JOIN (
        SELECT thread_id, MIN(checkpoint_id) AS first_cp
        FROM writes
        WHERE channel = 'messages'
          AND CAST(value AS TEXT) LIKE '%"role":"user"%'
        GROUP BY thread_id
      ) first ON first.thread_id = w.thread_id
              AND first.first_cp = w.checkpoint_id
              AND w.channel = 'messages'
      ORDER BY (
        SELECT MAX(checkpoint_id) FROM writes
        WHERE thread_id = w.thread_id
      ) DESC
      LIMIT ?
    `,
      )
      .all(limit) as {
      thread_id: string;
      checkpoint_id: string;
      value: Buffer | string;
    }[];

    return rows.map((row) => {
      // 提取 user 输入内容
      let lastQuestion = "";
      try {
        const raw =
          typeof row.value === "string"
            ? row.value
            : row.value.toString("utf-8");
        const parsed = JSON.parse(raw);
        // value 是数组，取第一个 role=user 的 content
        if (Array.isArray(parsed)) {
          const userMsg = parsed.find((m: any) => m.role === "user");
          if (userMsg) lastQuestion = String(userMsg.content ?? "");
        }
      } catch {
        lastQuestion = "";
      }

      // 截取前 50 字
      if (lastQuestion.length > 50) {
        lastQuestion = lastQuestion.slice(0, 50) + "…";
      }

      // 从 checkpoint_id (UUIDv7) 提取时间
      const ms = uuidv7ToMs(row.checkpoint_id);
      const time = ms ? relativeTime(ms) : "-";

      return {
        threadId: row.thread_id,
        lastQuestion: lastQuestion || "(空)",
        time,
      };
    });
  } finally {
    db.close();
  }
}

// ── 渲染会话列表表格 ─────────────────────────────────────────
export function renderSessionsTable(sessions: SessionRow[]): string {
  if (sessions.length === 0) {
    return chalk.yellow("\n  暂无历史会话记录。\n");
  }

  const table = new Table({
    head: ["thread_id", "最后用户输入", "时间"],
    colWidths: [38, 46, 10],
    wordWrap: true,
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
  });

  for (const s of sessions) {
    table.push([chalk.cyan(s.threadId), s.lastQuestion, chalk.gray(s.time)]);
  }

  return `\n${table.toString()}\n`;
}
