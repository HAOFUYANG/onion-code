import { randomUUID } from "node:crypto";
import chalk from "chalk";
import { Command } from "commander";
import { runAgentStream } from "./agent.js";
import { readUserInput } from "./input.js";
import { slashCommands, type SlashCommandContext } from "./slash_commands.js";
import {
  status,
  splashScreen,
  assistantPrefix,
  userEcho,
  type InputContext,
  toolLog,
  toolLogLines,
} from "./style.js";
import {
  querySessions,
  renderSessionsTable,
  threadExists,
} from "./sessions.js";
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
    try {
      await runAgentStream(input, (token) => process.stdout.write(token));
      process.stdout.write("\n");
    } catch (err) {
      process.stdout.write("\n");
      console.error(status.error(formatError(err as Error)) + "\n");
      process.exit(1);
    }
  });

// ── 默认行为：交互式聊天 ──
program.action(startInteractiveChat);

program.parse(process.argv);

// ────────────────────────────────────────────────────────────

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
    showHelp: () => {
      console.log(`\n  ${chalk.dim("可用命令")}`);
      for (const command of slashCommands) {
        const name = `/${command.name}`;
        const padding = " ".repeat(Math.max(0, 14 - name.length));
        console.log(
          `    ${chalk.cyan(name)}${padding}${chalk.dim(command.description)}`,
        );
      }
      console.log("");
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
    const onData = (data: Buffer) => {
      if (data[0] === 0x1b && !abortController.signal.aborted) {
        abortController.abort();
        process.stdout.write(status.stopped);
      }
    };
    stdin.on("data", onData);

    try {
      process.stdout.write(assistantPrefix());
      const startMs = Date.now();
      await runAgentStream(
        userInput,
        (token: string) => {
          if (firstToken) {
            // 首个 token：清除当前行的思考指示器（回退到行首重写）
            process.stdout.write("\r\x1b[K");
            process.stdout.write(assistantPrefix().trimEnd());
            firstToken = false;
          }
          process.stdout.write(token);
        },
        threadId,
        abortController.signal,
        (toolName: string, args: Record<string, any>) => {
          // 工具调用日志：作为流的一部分输出，不打断流式
          const detail =
            args.command ??
            args.code ??
            args.query ??
            args.url ??
            args.filename ??
            args.skillName;
          const lines = args.code ? String(args.code).split("\n").length : 0;
          if (lines > 0) {
            process.stdout.write(toolLogLines(toolName, lines));
          } else {
            process.stdout.write(
              toolLog(toolName, detail ? String(detail) : undefined),
            );
          }
        },
      );
      if (firstToken) {
        // 无 token 输出（空响应或被中断）
        process.stdout.write("\r\x1b[K");
        firstToken = false;
      }
      lastResponseMs = Date.now() - startMs;
      messageCount++;
      process.stdout.write("\n\n");
    } finally {
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
