import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
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
} from "./tools.js";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { getSkillText } from "./skills.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

## Tool Usage Rules
- **NEVER use write_file + exec to run code.** Always use run_py for Python and run_js for JavaScript. These tools handle temp files and cleanup automatically — no files are left behind.
- write_file is ONLY for creating files the user explicitly wants to keep (e.g., project source files, configs, documents).
- exec is for shell commands (ls, pwd, git, etc.), NOT for running scripts.
`.trim();

  return `${personality}\n${getSkillText()}`;
}

// 以项目根目录（而非 cwd）为基准加载 .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── SQLite 持久化（Checkpointer）────────────────────────────
const checkpointDir = path.resolve(process.cwd(), ".data");
fs.mkdirSync(checkpointDir, { recursive: true });
const checkpointer = SqliteSaver.fromConnString(
  path.join(checkpointDir, "checkpointer.db"),
);

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

// ── Token 用量 ──────────────────────────────────────────
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * 以流式方式运行 agent，将 token 逐个回调给调用方
 * @param {string} userMessage - 当前用户输入（历史已由 checkpointer 自动续接）
 * @param {Function} onToken   - 每个 token 到来时的回调 (token: string) => void
 * @param {string} threadId    - 会话 ID，相同 ID 自动续上历史记录
 * @param {AbortSignal} [signal] - 可选的取消信号，可用于 ESC 中断
 * @param {Function} [onToolCall] - 工具调用回调 (toolName: string, args: Record<string, any>) => void
 * @returns {Promise<{ text: string; usage: TokenUsage | null }>}  完整 AI 回复 + token 用量
 */
export async function runAgentStream(
  userMessage: string,
  onToken: (token: string) => void,
  threadId: string = "default-session",
  signal?: AbortSignal,
  onToolCall?: (toolName: string, args: Record<string, any>) => void,
): Promise<{ text: string; usage: TokenUsage | null }> {
  const config = {
    configurable: { thread_id: threadId },
    recursionLimit: 100,
  };

  const stream = await agent.stream(
    { messages: [{ role: "user", content: userMessage }] },
    { ...config, streamMode: "messages" },
  );

  let fullResponse = "";
  let usage: TokenUsage | null = null;
  // 累积 tool_call_chunks，因为参数可能分多个 chunk 到达
  const toolCallAccumulator = new Map<string, { name: string; args: string }>();

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

    if (content) {
      onToken(content);
      fullResponse += content;
    }

    // 处理 tool_call chunks：累积工具名和参数
    if (toolCallChunks.length > 0 && onToolCall) {
      for (const tc of toolCallChunks) {
        const index = tc.index ?? 0;
        const existing = toolCallAccumulator.get(String(index));
        const name = tc.name ?? existing?.name ?? "";
        const args = (existing?.args ?? "") + (tc.args ?? "");
        toolCallAccumulator.set(String(index), { name, args });

        // 当工具名和参数都完整时（通常 name 在第一个 chunk，args 逐步累积）
        // 在这里不立即回调，等 tool 执行完成后由后续 chunk 触发
      }
    }

    // 检测 tool 消息（工具执行完成），此时触发 onToolCall
    if (
      typeof message._getType === "function" &&
      message._getType() === "tool"
    ) {
      if (onToolCall && toolCallAccumulator.size > 0) {
        for (const [, { name, args }] of toolCallAccumulator) {
          if (name) {
            let parsedArgs: Record<string, any> = {};
            try {
              parsedArgs = args ? JSON.parse(args) : {};
            } catch {
              // args 可能不完整，跳过解析
            }
            onToolCall(name, parsedArgs);
          }
        }
        toolCallAccumulator.clear();
      }
    }

    // 捕获 token 用量（LangChain >0.3 在末 chunk 的 usage_metadata 中返回）
    const um = (message as any).usage_metadata;
    if (um && typeof um === "object") {
      const input = um.input_tokens ?? um.inputTokens ?? 0;
      const output = um.output_tokens ?? um.outputTokens ?? 0;
      const total = um.total_tokens ?? um.totalTokens ?? 0;
      if (input > 0 || output > 0 || total > 0) {
        usage = {
          inputTokens: input,
          outputTokens: output,
          totalTokens: total,
        };
      }
    }
  }

  return { text: fullResponse, usage };
}
