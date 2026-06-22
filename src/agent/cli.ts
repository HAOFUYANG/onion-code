import React from "react";
import { render } from "ink";
import { Command } from "commander";
import { runAgentStream } from "./agent.js";
import { App } from "./ui/App.js";
import { splashScreen, assistantPrefix, userEcho, status } from "./style.js";
import pkg from "../../package.json" with { type: "json" };

const program = new Command();
program.name("onionCode").description(pkg.description).version(pkg.version);

// ── 友好错误提示 ─────────────────────────────────────────────
function formatError(err: unknown): string {
  const msg = (err as Error).message ?? String(err);
  if (msg.includes("Content Exists Risk"))
    return "请求被安全审查拦截（Content Exists Risk）。可尝试换个问法或简化查询。";
  if (msg.includes("401") || msg.includes("Incorrect API key"))
    return "API Key 无效或未配置，请检查 .env 中的 OPENAI_API_KEY。";
  if (msg.includes("insufficient_quota") || msg.includes("429"))
    return "API 额度不足（429），请检查账户余额。";
  if (msg.includes("Recursion limit"))
    return "Agent 执行步数超出限制（recursionLimit）。可尝试拆分为多个小步骤。";
  if (msg.includes("ETIMEDOUT") || msg.includes("timeout"))
    return "请求超时，请检查网络连接后重试。";
  return msg;
}

// ── ask 命令：单轮问答（非交互场景） ─────────────────────────
program
  .command("ask <message...>")
  .description("单轮问答，不进入交互界面")
  .action(async (message: string[]) => {
    const input = message.join(" ");
    process.stdout.write(userEcho(input));
    process.stdout.write(assistantPrefix());
    try {
      await runAgentStream(input, (token) => process.stdout.write(token));
      process.stdout.write("\n");
    } catch (err) {
      process.stdout.write("\n");
      console.error(status.error(formatError(err)) + "\n");
      process.exit(1);
    }
  });

// ── 默认：Ink 全量交互界面 ────────────────────────────────────
program.action(() => {
  process.stdout.write(
    splashScreen({
      name: pkg.name,
      version: pkg.version,
      description: (pkg as any).description,
      author: (pkg as any).author ?? "unknown",
      docs: (pkg as any).docs ?? "",
    }),
  );

  const { unmount } = render(
    React.createElement(App, {
      onExit: () => {
        process.stdout.write(status.bye + "\n");
        unmount();
        process.exit(0);
      },
    }),
  );
});

program.parse(process.argv);
