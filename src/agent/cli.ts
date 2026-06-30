import { randomUUID } from "node:crypto";
import chalk from "chalk";
import { Command } from "commander";
import { runAgentStream, compressAgentContext } from "./agent.js";
import { readUserInput } from "./input.js";
import { slashCommands, type SlashCommandContext } from "./commands.js";
import {
  status,
  splashScreen,
  assistantPrefix,
  userEcho,
  type InputContext,
  renderTokenBar,
  getModelMaxTokens,
} from "./style.js";
import {
  querySessions,
  renderSessionsTable,
  threadExists,
} from "./sessions.js";
import ora from "ora";
import { createMarkdownStreamer, render as renderMarkdown } from "markdansi";
import pkg from "../../package.json" with { type: "json" };

const program = new Command();

program.name("onionCode").description(pkg.description).version(pkg.version);

// ── 友好错误提示 ────────────────────────────
function formatError(err: unknown): string {
  const msg = (err as Error).message ?? String(err);

  // DeepSeek 内容安全审查
  if (msg.includes("Content Exists Risk")) {
    return (
      "请求被安全审查拦截（Content Exists Risk）。\n" +
      "        可能是工具返回的搜索结果触发了内容过滤，可尝试换个问法或简化查询。"
    );
  }

  // API Key / 认证问题
  if (msg.includes("401") || msg.includes("Incorrect API key")) {
    return "API Key 无效或未配置，请检查 .env 中的 OPENAI_API_KEY。";
  }

  // 余额不足
  if (msg.includes("insufficient_quota") || msg.includes("429")) {
    return "API 额度不足（429），请检查账户余额。";
  }

  // LangGraph 递归限制
  if (msg.includes("Recursion limit")) {
    return (
      "Agent 执行步数超出限制（recursionLimit）。\n" +
      "        任务可能过于复杂，可尝试拆分为多个小步骤分次执行。"
    );
  }

  // 网络超时
  if (msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
    return "请求超时，请检查网络连接后重试。";
  }

  return msg;
}

// ── ask 命令：单轮问答 ──
program
  .command("ask <message...>")
  .description(
    "A wise agent run on terminal,including tools,skills,memory,hook,sub-agent,Mcp server,themes",
  )
  .action(async (message: string[]) => {
    const input = message.join(" ");
    process.stdout.write(userEcho(input));
    process.stdout.write(assistantPrefix());
    const spinner = ora({ text: "thinking...", indent: 2 }).start();
    try {
      let fullText = "";
      const { usage } = await runAgentStream(input, (token) => {
        if (spinner.isSpinning) spinner.stop();
        fullText += token;
      });
      const rendered = renderMarkdown(fullText, {
        width: process.stdout.columns ?? 80,
      });
      process.stdout.write(rendered + "\n");

      // token 用量条
      const modelName = process.env.OPENAI_MODEL ?? "deepseek-v4-flash";
      const tokenLine = renderTokenBar(usage, modelName);
      if (tokenLine) process.stdout.write(tokenLine + "\n\n");
      else process.stdout.write("\n");
    } catch (err) {
      if (spinner.isSpinning) spinner.stop();
      process.stdout.write("\n");
      console.error(status.error(formatError(err as Error)) + "\n");
      process.exit(1);
    }
  });

// ── 默认行为：交互式聊天 ──
program.action(startInteractiveChat);

program.parse(process.argv);

// ────────────────────────────────────────────────────────────

// ── 共享：Context 压缩并输出 ──────────────────────────
async function performCompression(threadId: string): Promise<void> {
  const compressSpinner = ora({
    text: "正在压缩 Context...",
    indent: 2,
  }).start();

  const result = await compressAgentContext(threadId);

  compressSpinner.stop();

  if (result.compressed) {
    process.stdout.write(
      `  ${chalk.hex("#10B981")("✓")}  ${chalk.green("Context 已压缩")} — 已保留最近 ${result.keepRecent} 条消息（${chalk.cyan("第" + result.compressionCount + "次")}）\n`,
    );

    if (result.compressionCount >= 3) {
      process.stdout.write(
        `  ${chalk.hex("#F59E0B")("⚠")}  ${chalk.yellow("已压缩 3 次，强烈建议")} ${chalk.cyan("/new")} ${chalk.yellow("开启新会话")}\n`,
      );
    }
  } else if (result.error) {
    process.stdout.write(
      `  ${chalk.hex("#F59E0B")("⚠")}  ${chalk.yellow("Context 压缩失败")}: ${result.error}\n`,
    );
  } else {
    process.stdout.write(
      `  ${chalk.dim("ℹ")}  ${chalk.gray("无需压缩，当前消息量较少")}\n`,
    );
  }
}

async function startInteractiveChat() {
  let threadId: string = randomUUID();
  let messageCount = 0;
  let lastResponseMs: number | null = null;
  const modelName = process.env.OPENAI_MODEL ?? "deepseek-v4-flash";

  const slashContext: SlashCommandContext = {
    newThread: () => {
      threadId = randomUUID();
      console.log(`\n  ${chalk.dim("✓")} 新建会话 ${chalk.cyan(threadId)}\n`);
    },
    showSessions: () => {
      const sessions = querySessions(20);
      console.log(renderSessionsTable(sessions));
    },
    rewindThread: (targetId: string) => {
      if (!threadExists(targetId)) {
        console.log(
          chalk.red(
            `\n  找不到会话 ${chalk.dim(targetId)}，用 /sessions 查看列表\n`,
          ),
        );
        return;
      }
      threadId = targetId;
      console.log(
        `\n  ${chalk.dim("⏪")} 已切换到历史会话 ${chalk.cyan(threadId)}\n`,
      );
    },
    compressContext: () => performCompression(threadId),
    showHelp: () => {
      const terminalWidth = process.stdout.columns || 80;
      const divider = chalk.hex("#7C3AED")(
        "─".repeat(Math.min(terminalWidth - 4, 36)),
      );
      console.log(
        `\n  ${chalk.hex("#C084FC")("▸")} ${chalk.bold.white("可用命令")}  ${chalk.dim(`${slashCommands.length} 项`)}\n${divider}`,
      );
      for (const command of slashCommands) {
        const icon = command.icon ? `${command.icon} ` : "";
        const name = `/${command.name}`.padEnd(14);
        const aliasInfo = command.aliases?.length
          ? chalk.dim(`  (${command.aliases.map((a) => `/${a}`).join(", ")})`)
          : "";
        console.log(
          `    ${icon}${chalk.cyan(name)}${chalk.dim(command.description)}${aliasInfo}`,
        );
      }
      console.log(
        chalk.dim(
          `\n  输入 ${chalk.cyan("/")} 查看命令面板，${chalk.cyan("↑↓")} 导航，${chalk.cyan("enter")} 确认\n`,
        ),
      );
    },
  };

  async function chat(userInput: string): Promise<void> {
    const abortController = new AbortController();
    const stdin = process.stdin;
    const wasRaw = stdin.isTTY ? stdin.isRaw : false;
    let firstToken = true;

    // 监听 ESC 键（ASCII 27 = 0x1b）
    stdin.resume();
    if (stdin.isTTY) stdin.setRawMode(true);
    const spinner = ora({ text: "thinking...", indent: 2 }).start();

    const onData = (data: Buffer) => {
      if (data[0] === 0x1b && !abortController.signal.aborted) {
        abortController.abort();
        spinner.stop();
        process.stdout.write(status.stopped);
      }
    };
    stdin.on("data", onData);

    try {
      const startMs = Date.now();

      // markdansi 流式渲染器：逐块输出已完成的 Markdown 段落
      const termWidth = process.stdout.columns ?? 80;
      let streamer = createMarkdownStreamer({
        render: (md) => renderMarkdown(md, { width: termWidth }),
        spacing: "single",
      });

      const result = await runAgentStream(
        userInput,
        (token: string) => {
          if (firstToken) {
            // 首个 token：停 spinner，写助手前缀
            spinner.stop();
            process.stdout.write(assistantPrefix().trimEnd());
            firstToken = false;
          }
          const chunk = streamer.push(token);
          if (chunk) process.stdout.write(chunk);
        },
        threadId,
        abortController.signal,
        (_toolName: string, _args: Record<string, any>) => {
          // 工具调用前 flush streamer 残留内容，然后重建
          const tail = streamer.finish();
          if (tail) process.stdout.write(tail);
          streamer = createMarkdownStreamer({
            render: (md) => renderMarkdown(md, { width: termWidth }),
            spacing: "single",
          });
        },
      );
      const usage = result.usage;
      if (firstToken) {
        // 无 token 输出（空响应或被中断）
        spinner.stop();
        firstToken = false;
      }
      // flush streamer 最后残留的 Markdown 块
      const finalTail = streamer.finish();
      if (finalTail) process.stdout.write(finalTail);
      lastResponseMs = Date.now() - startMs;
      messageCount++;

      // token 用量条
      process.stdout.write("\n");
      const tokenLine = renderTokenBar(usage, modelName);
      if (tokenLine) process.stdout.write(tokenLine + "\n");

      // Context 压缩
      if (usage && usage.inputTokens > 0) {
        const maxTokens = getModelMaxTokens(modelName);
        const pct = usage.inputTokens / maxTokens;
        if (pct >= 0.8) {
          await performCompression(threadId);
        }
      }

      process.stdout.write("\n\n");
    } finally {
      if (spinner.isSpinning) spinner.stop();
      stdin.removeListener("data", onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
    }
  }

  console.log(
    splashScreen({
      name: pkg.name,
      version: pkg.version,
      description: (pkg as any).description,
      author: (pkg as any).author ?? "unknown",
      docs: (pkg as any).docs ?? "",
    }),
  );

  while (true) {
    const ctx: InputContext = {
      model: modelName,
      threadId: threadId.slice(0, 8),
      messageCount,
      lastResponseMs,
    };
    const input = await readUserInput(ctx);

    if (input.type === "exit") {
      console.log(status.bye);
      break;
    }

    if (input.type === "command") {
      try {
        const result = await input.command.handler(slashContext, input.args);
        if (result === "exit") {
          console.log(status.bye);
          break;
        }
      } catch (err) {
        console.error(status.error(formatError(err as Error)) + "\n");
      }
      continue;
    }

    if (!input.text.trim()) continue;
    try {
      await chat(input.text);
    } catch (err) {
      console.error(status.error(formatError(err as Error)) + "\n");
    }
  }
}
