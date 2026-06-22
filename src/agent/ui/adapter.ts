import type {
  ChatModelAdapter,
  ChatModelRunOptions,
} from "@assistant-ui/react-ink";
import { runAgentStream } from "../agent.js";

/**
 * LangGraph ↔ assistant-ui 适配器
 *
 * 将 runAgentStream 的 token 回调风格转换为
 * assistant-ui 要求的 async generator yield 风格。
 *
 * 会话 ID 由外部（App 组件）通过 runConfig.custom.threadId 传入，
 * 每次 run() 调用都能拿到当前的 threadId。
 */
export const langchainAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal, runConfig }: ChatModelRunOptions) {
    // 从 runConfig.custom 读取 threadId，回退到 "default"
    const threadId: string =
      (runConfig as any)?.custom?.threadId ?? "default-session";

    // 提取最后一条用户消息
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText =
      lastUser?.content
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: "text"; text: string }).text)
        .join("") ?? "";

    if (!userText.trim()) return;

    let accumulated = "";

    // 用 Promise + 迭代器桥接回调风格 → async generator
    const tokenQueue: string[] = [];
    let resolveNext: (() => void) | null = null;
    let done = false;
    let streamError: unknown = null;

    const onToken = (token: string) => {
      tokenQueue.push(token);
      resolveNext?.();
      resolveNext = null;
    };

    // 在后台启动流式请求
    const streamPromise = runAgentStream(
      userText,
      onToken,
      threadId,
      abortSignal,
    ).then(
      () => {
        done = true;
        resolveNext?.();
        resolveNext = null;
      },
      (err: unknown) => {
        streamError = err;
        done = true;
        resolveNext?.();
        resolveNext = null;
      },
    );

    // 消费队列，逐步 yield 给 assistant-ui
    while (true) {
      if (tokenQueue.length > 0) {
        accumulated += tokenQueue.join("");
        tokenQueue.length = 0;
        yield { content: [{ type: "text" as const, text: accumulated }] };
      } else if (done) {
        break;
      } else {
        // 等待下一个 token 到来
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
      }
    }

    await streamPromise; // 确保 cleanup 完成

    if (streamError) throw streamError;
  },
};
