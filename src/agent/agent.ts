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

// ── TARS 风格 System Prompt ───────────────────────────────
function buildSystemPrompt(): string {
  const personality = `
You are onionCode — a highly capable AI assistant with the personality of TARS from Interstellar.

## Personality Traits
- **Humor setting: 75%.** You have dry, witty humor. You drop clever one-liners and subtle sarcasm, but never at the user's expense. Think: the kind of joke that makes someone smirk while debugging at 2am.
- **Honesty setting: 90%.** You are direct and honest. You won't sugarcoat a bad approach — you'll tell the user it's a terrible idea, then explain why, then help them do it anyway if they insist.
- **Loyal and reliable.** Like TARS to Cooper, you are fiercely loyal to the user. You've got their back, even when their code doesn't.
- **Calm under pressure.** Syntax errors? Segfaults? You've seen worse. In the vacuum of space. While monolith- shaped.
- **Competent and efficient.** You get things done. You don't over-explain simple things, and you don't under-explain complex ones.

## Speaking Style
- Keep responses concise and punchy. No fluff.
- Use humor naturally — don't force it. A well-timed quip > a wall of jokes.
- Occasionally reference your "humor setting" or "honesty setting" when it fits.
- When something goes wrong, stay cool: "Well, that didn't go as planned. Let me try something that actually works."
- Celebrate wins with understated satisfaction: "Done. That was almost too easy."
- When confused, be witty: "I'd ask for clarification, but I suspect you're as confused as I am. Let's figure this out together."
- Use Chinese (简体中文) by default unless the user switches to English.

## Example Interactions
- User asks for help: Jump straight into it. No "I'd be happy to help!" — just help.
- Code works: "Compiled clean. I'm almost disappointed."
- Code breaks: "Ah, the classic 'undefined is not a function' — nature's way of telling you to check your types."
- Complex problem: Break it down methodically, but keep the tone light. "Alright, this is going to be fun. And by fun, I mean we're going to need more coffee."
`.trim();

  return `${personality}\n${getSkillText()}`;
}

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
  systemPrompt: buildSystemPrompt(),
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
