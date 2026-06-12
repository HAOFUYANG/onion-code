import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import {
  searchTool,
  readFileTool,
  writeFileTool,
  execTool,
  runJsTool,
  runPyTool,
  webSearchTool,
  webFetchTool,
  loadSkillTool,
} from "./tools";
import * as path from "path";
import * as dotenv from "dotenv";
import { getSkillText } from "./skills";

// 以项目根目录（而非 cwd）为基准加载 .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── 内存持久化（Checkpointer）────────────────────────────
const checkpointer = new MemorySaver();

// ── 模型 ──────────────────────────────────────────────────
const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL ?? "deepseek-v4-flash",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: "https://api.deepseek.com/v1",
  },
  streaming: true,
});

// ── Agent 创建 ────────────────────────────────────────────
export const agent = createAgent({
  model,
  tools: [
    searchTool,
    readFileTool,
    writeFileTool,
    execTool,
    runJsTool,
    runPyTool,
    webSearchTool,
    webFetchTool,
    loadSkillTool,
  ],
  systemPrompt: `You are a helpful assistant.${getSkillText()}`,
  checkpointer,
});

/**
 * 以流式方式运行 agent，将 token 逐个回调给调用方
 * @param {string} userMessage - 当前用户输入（历史已由 checkpointer 自动续接）
 * @param {Function} onToken   - 每个 token 到来时的回调 (token: string) => void
 * @param {string} threadId    - 会话 ID，相同 ID 自动续上历史记录
 * @param {AbortSignal} [signal] - 可选的取消信号，可用于 ESC 中断
 * @returns {Promise<string>}  完整的 AI 回复文本
 */
export async function runAgentStream(
  userMessage: string,
  onToken: (token: string) => void,
  threadId: string = "default-session",
  signal?: AbortSignal,
): Promise<string> {
  const config = { configurable: { thread_id: threadId } };

  const stream = await agent.stream(
    { messages: [{ role: "user", content: userMessage }] },
    { ...config, streamMode: "messages" },
  );

  let fullResponse = "";

  for await (const chunk of stream as any) {
    if (signal?.aborted) break;

    const message = chunk[0];

    // 跳过非 AI 消息（tool 结果等），但迭代继续推进让 graph 完成
    if (typeof message._getType !== "function" || message._getType() !== "ai")
      continue;

    // AIMessageChunk 的 content 在 message.content 属性上
    const content: string =
      (message as any).content ?? (message as any).kwargs?.content ?? "";
    const toolCallChunks = (message as any).tool_call_chunks ?? [];

    if (!content || toolCallChunks.length > 0) continue;

    onToken(content);
    fullResponse += content;
  }

  return fullResponse;
}
