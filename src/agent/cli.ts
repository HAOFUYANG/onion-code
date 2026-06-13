import { Command } from "commander";
import * as readline from "readline";
import { runAgentStream } from "./agent";
import { brand, status, welcomeBanner } from "./style";
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
  const THREAD_ID = "user-session-1";

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function prompt(question: string): Promise<string> {
    return new Promise((resolve) => rl.question(question, resolve));
  }

  async function chat(userInput: string): Promise<void> {
    rl.pause();

    const abortController = new AbortController();
    const stdin = process.stdin;

    // 监听 ESC 键（ASCII 27 = 0x1b）
    stdin.resume();
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
        THREAD_ID,
        abortController.signal,
      );
      process.stdout.write("\n\n");
    } finally {
      stdin.removeListener("data", onData);
      rl.resume();
    }
  }

  console.log(welcomeBanner(pkg.version));

  while (true) {
    const userInput = await prompt(brand.prompt);
    if (!userInput.trim()) continue;
    if (userInput.toLowerCase() === "exit") {
      console.log(status.bye);
      rl.close();
      break;
    }
    try {
      await chat(userInput);
    } catch (err) {
      console.error(status.error(formatError(err as Error)) + "\n");
    }
  }
}
