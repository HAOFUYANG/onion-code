import type {
  ChatModelAdapter,
  ChatModelRunOptions,
} from "@assistant-ui/react-ink";
import { runAgentStream } from "../../agent/agent.js";

/**
 * LangGraph ↔ assistant-ui 适配器
 *
 * threadId 由外部注入：通过 createLangchainAdapter 传入 getThreadId getter，
 * 每次 run() 调用时动态读取最新 threadId。
 */
export function createLangchainAdapter(
  getThreadId: () => string,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }: ChatModelRunOptions) {
      const threadId = getThreadId();

      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      const userText =
        lastUser?.content
          .filter((p) => p.type === "text")
          .map((p) => (p as { type: "text"; text: string }).text)
          .join("") ?? "";

      if (!userText.trim()) return;

      let accumulated = "";
      const tokenQueue: string[] = [];
      let resolveNext: (() => void) | null = null;
      let done = false;
      let streamError: unknown = null;

      const onToken = (token: string) => {
        tokenQueue.push(token);
        resolveNext?.();
        resolveNext = null;
      };

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

      while (true) {
        if (tokenQueue.length > 0) {
          accumulated += tokenQueue.join("");
          tokenQueue.length = 0;
          yield { content: [{ type: "text" as const, text: accumulated }] };
        } else if (done) {
          break;
        } else {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
        }
      }

      await streamPromise;
      if (streamError) throw streamError;
    },
  };
}

// 默认静态适配器（向后兼容，使用固定 session-default threadId）
export const langchainAdapter: ChatModelAdapter = createLangchainAdapter(
  () => "default-session",
);
