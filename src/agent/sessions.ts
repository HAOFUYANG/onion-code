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

// ── 提取 user 消息内容（兼容两种序列化格式） ─────────────────
function extractUserContent(value: Buffer | string): string {
  try {
    const raw = typeof value === "string" ? value : value.toString("utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return "";

    for (const m of parsed) {
      // 旧格式: { role: "user", content: "..." }
      if (m.role === "user" && m.content) {
        return String(m.content);
      }
      // 新格式 (constructor): { id: [..., "HumanMessage"], kwargs: { content: "..." } }
      if (
        m.type === "constructor" &&
        Array.isArray(m.id) &&
        m.id[2] === "HumanMessage"
      ) {
        return String(m.kwargs?.content ?? "");
      }
    }
  } catch {
    // ignore
  }
  return "";
}

// ── 判断 value 是否为 user 消息（用于 SQL 筛选） ───────────────
function isUserMessage(value: Buffer | string): boolean {
  // SQLite UDF 太重，这里用字符串预判 — 两种格式都匹配
  const raw = typeof value === "string" ? value : value.toString("utf-8");
  return raw.includes('"role":"user"') || raw.includes("HumanMessage");
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
    // 先查出所有不同的 thread_id（按最近活跃排序），不用 SQL LIKE 过滤
    // 因为 SQL 字符串匹配无法覆盖两种序列化格式，改用 JS 层过滤
    const threadRows = db
      .prepare(
        `
      SELECT DISTINCT w.thread_id
      FROM writes w
      WHERE w.channel = 'messages'
      ORDER BY (
        SELECT MAX(checkpoint_id) FROM writes
        WHERE thread_id = w.thread_id AND channel = 'messages'
      ) DESC
      LIMIT ?
    `,
      )
      .all(limit * 3) as { thread_id: string }[];

    const results: SessionRow[] = [];

    for (const { thread_id } of threadRows) {
      if (results.length >= limit) break;

      // 查这个 thread 的第一条 user 消息
      const allRows = db
        .prepare(
          `SELECT w.checkpoint_id, w.value
         FROM writes w
         WHERE w.thread_id = ? AND w.channel = 'messages'
         ORDER BY w.checkpoint_id ASC`,
        )
        .all(thread_id) as { checkpoint_id: string; value: Buffer | string }[];

      // 找第一条 user 消息
      for (const row of allRows) {
        if (!isUserMessage(row.value)) continue;

        const lastQuestion = extractUserContent(row.value)
          .slice(0, 50)
          .replace(/\n/g, " ");
        const finalQuestion =
          lastQuestion.length >= 50
            ? lastQuestion.slice(0, 50) + "…"
            : lastQuestion;

        const ms = uuidv7ToMs(row.checkpoint_id);
        const time = ms ? relativeTime(ms) : "-";

        results.push({
          threadId: thread_id,
          lastQuestion: finalQuestion || "(空)",
          time,
        });
        break; // 只取第一条 user 消息
      }
    }

    return results;
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
