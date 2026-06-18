import { randomUUID } from "crypto";
import chalk from "chalk";
import { Command } from "commander";
import { runAgentStream } from "./agent";
import { readUserInput } from "./input";
import { slashCommands, type SlashCommandContext } from "./slash_commands";
import { brand, status, splashScreen } from "./style";
import { querySessions, renderSessionsTable, threadExists } from "./sessions";
import pkg from "../../package.json";

const program = new Command();

program.name("onionCode").description(pkg.description).version(pkg.version);

// ── 友好错误提示 ────────────────────────────
function formatError(err: unknown): string {
  const msg = (err as Error).message ?? String(err);

  // DeepSeek 内容安全审查
  if (msg.includes("Content Exists Risk")) {
    return (
      "请求被 DeepSeek 安全审查拦截（Content Exists Risk）。\n" +
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
    process.stdout.write(`\n${brand.onion}: `);
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

  const slashContext: SlashCommandContext = {
    newThread: () => {
      threadId = randomUUID();
      console.log(`\n✅ 已新建会话：${threadId}\n`);
    },
    showSessions: () => {
      const sessions = querySessions(20);
      console.log(renderSessionsTable(sessions));
    },
    rewindThread: (targetId: string) => {
      if (!threadExists(targetId)) {
        console.log(
          chalk.red(
            `\n❌ 找不到该会话：${targetId}\n   请用 /sessions 查看已有的 thread_id。\n`,
          ),
        );
        return;
      }
      threadId = targetId;
      console.log(
        chalk.green(
          `\n⏪ 已切换到历史会话：${threadId}\n   直接输入内容即可继续聊天。\n`,
        ),
      );
    },
    showHelp: () => {
      console.log("\n可用 Slash Commands：");
      for (const command of slashCommands) {
        console.log(`  /${command.name.padEnd(8)} ${command.description}`);
      }
      console.log("");
    },
  };

  async function chat(userInput: string): Promise<void> {
    const abortController = new AbortController();
    const stdin = process.stdin;
    const wasRaw = stdin.isTTY ? stdin.isRaw : false;

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
      process.stdout.write(`\n${brand.onion}: `);
      await runAgentStream(
        userInput,
        (token: string) => process.stdout.write(token),
        threadId,
        abortController.signal,
      );
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
    const input = await readUserInput();

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
