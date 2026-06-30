import { ChatOpenAI } from "@langchain/openai";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import {
  SystemMessage,
  HumanMessage,
  type BaseMessage,
  type UsageMetadata,
  isAIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import {
  StateGraph,
  Annotation,
  START,
  END,
  messagesStateReducer,
  type CompiledStateGraph,
} from "@langchain/langgraph";
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
  maybePersistedOutput,
} from "./tools.js";
import { toolLog } from "./style.js";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { getSkillText } from "./skills.js";
import { compressMessages } from "./context.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 以项目根目录（而非 cwd）为基准加载 .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com/v1",
  },
  streaming: true,
  modelKwargs: {
    thinking: { type: "disabled" },
  },
});

// 工具列表 — 各 tool 输入 schema 不同，tsserver 联合类型签名不兼容
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tools: any[] = [
  searchTool,
  readFileTool,
  writeFileTool,
  execTool,
  runJsTool,
  runPyTool,
  webSearchTool,
  webFetchTool,
  loadSkillTool,
];

const modelWithTools = model.bindTools(tools as any);

// ── State Schema ──────────────────────────────────────────
const StateAnnotation = Annotation.Root({
  /** 规范对话历史 — checkpointer 持久化，追加语义 */
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  /** LLM 实际输入 — 供 preprocess 节点注入变换后的消息 */
  llmInputMessages: Annotation<BaseMessage[]>({
    reducer: (_prev, update) => messagesStateReducer([], update),
    default: () => [],
  }),
  /** Context 压缩摘要 — CLI 侧压缩后写入，modelRequest 读取 */
  contextSummary: Annotation<string | null>({
    reducer: (_prev, update) => update,
    default: () => null,
  }),
  /** Context 压缩次数 */
  compressionCount: Annotation<number>({
    reducer: (_prev, update) => update,
    default: () => 0,
  }),
  /** 上次压缩时的消息边界索引（messages.slice 起点） */
  lastCompressedIndex: Annotation<number>({
    reducer: (_prev, update) => update,
    default: () => 0,
  }),
});

type AgentState = typeof StateAnnotation.State;

const systemPrompt = buildSystemPrompt();

// ── 辅助：取模型输入 messages ──────────────────────────────
function getModelInputState(state: AgentState) {
  const { messages, llmInputMessages, ...rest } = state;
  if (llmInputMessages != null && llmInputMessages.length > 0) {
    return { messages: llmInputMessages, ...rest };
  }
  return { messages, ...rest };
}

// ── model_request 节点 ────────────────────────────────────
async function modelRequest(
  state: AgentState,
  config: any,
): Promise<Partial<AgentState>> {
  let inputMessages: BaseMessage[];

  if (state.contextSummary != null && state.lastCompressedIndex > 0) {
    // 压缩路径：摘要 + 从压缩边界开始的最近消息（含本轮用户输入）
    // slice 后可能以孤立的 ToolMessage 开头（其 AIMessage 已被截掉），
    // 跳过它们以避免 LangChain 抛出 "tool messages must be a response to a preceding message with tool_calls"
    const recentMessages = state.messages.slice(state.lastCompressedIndex);
    // 收集 slice 中所有 AIMessage 的 tool_call_id
    const knownToolCallIds = new Set<string>();
    for (const m of recentMessages) {
      if (isAIMessage(m) && m.tool_calls?.length) {
        for (const tc of m.tool_calls) {
          if (tc.id) knownToolCallIds.add(tc.id);
        }
      }
    }
    // 跳过开头没有对应 AIMessage 的孤立 ToolMessage
    const firstNonOrphan = recentMessages.findIndex(
      (m) =>
        m.getType() !== "tool" ||
        (m as ToolMessage).tool_call_id === "" ||
        knownToolCallIds.has((m as ToolMessage).tool_call_id),
    );
    const safeRecent =
      firstNonOrphan > 0
        ? recentMessages.slice(firstNonOrphan)
        : recentMessages;

    inputMessages = [
      new SystemMessage(systemPrompt),
      new SystemMessage(`[上下文摘要]\n${state.contextSummary}`),
      ...safeRecent,
    ];
  } else {
    // 正常路径：llmInputMessages 优先（供未来 preprocess 使用），否则用 messages
    const input = getModelInputState(state);
    inputMessages = [
      new SystemMessage(systemPrompt),
      ...(input.messages ?? []),
    ];
  }

  const response = await modelWithTools.invoke(inputMessages, config);
  return { messages: [response], llmInputMessages: [] };
}

// ── shouldContinue 路由 ───────────────────────────────────
function shouldContinue(state: AgentState): "tools" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  if (isAIMessage(lastMessage) && lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
}

// ── tools 节点 ────────────────────────────────────────────
async function toolNode(
  state: AgentState,
  config: any,
): Promise<Partial<AgentState>> {
  const messages = state.messages;

  // 去重：已执行的 tool_call
  const executedIds = new Set(
    messages
      .filter((m) => m.getType() === "tool")
      .map((m) => (m as ToolMessage).tool_call_id),
  );

  // 找最后一条带 tool_calls 的 AI 消息
  let aiMessage: BaseMessage | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isAIMessage(messages[i])) {
      aiMessage = messages[i];
      break;
    }
  }

  if (!aiMessage || !isAIMessage(aiMessage)) {
    throw new Error("ToolNode 仅接受含 tool_calls 的 AIMessage 作为输入。");
  }

  const pendingCalls =
    aiMessage.tool_calls?.filter(
      (call) => call.id == null || !executedIds.has(call.id),
    ) ?? [];

  const outputs = await Promise.all(
    pendingCalls.map(async (call) => {
      const tool = tools.find((t) => t.name === call.name);
      console.log(toolLog(call.name), JSON.stringify(call.args));
      try {
        if (!tool) {
          throw new Error(`未找到工具 "${call.name}"。`);
        }
        const output = await tool.invoke(
          { ...call, type: "tool_call" },
          config,
        );
        const content = maybePersistedOutput(
          typeof output === "string" ? output : JSON.stringify(output),
          call.id ?? "",
        );
        return new ToolMessage({
          content,
          tool_call_id: call.id ?? "",
          name: call.name,
        });
      } catch (e: any) {
        return new ToolMessage({
          content: `执行失败: ${e.message}\n请修正后重试。`,
          tool_call_id: call.id ?? "",
          name: call.name,
        });
      }
    }),
  );

  return { messages: outputs };
}

// ── 编译 Graph ────────────────────────────────────────────
const workflow = new StateGraph(StateAnnotation)
  .addNode("model_request", modelRequest)
  .addNode("tools", toolNode)
  .addEdge(START, "model_request")
  .addConditionalEdges("model_request", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "model_request");

export const agent: CompiledStateGraph<any, any, any> = workflow.compile({
  checkpointer,
});

// ── Context 压缩 ─────────────────────────────────────────
export interface CompressResult {
  compressed: boolean;
  compressionCount: number;
  keepRecent: number;
  error?: string;
}

/**
 * 压缩 Agent Context — 获取当前会话状态，将最近 6 条之外的消息压缩为摘要。
 * 由 CLI 层在 token 使用率 >= 80% 时调用。
 */
export async function compressAgentContext(
  threadId: string,
  keepRecent = 6,
): Promise<CompressResult> {
  const config = { configurable: { thread_id: threadId } };

  try {
    const currentState = await agent.getState(config);

    const messages = (currentState?.values?.messages ?? []) as BaseMessage[];
    const prevSummary = (currentState?.values?.contextSummary ?? null) as
      | string
      | null;
    const prevCount = (currentState?.values?.compressionCount ?? 0) as number;
    const lastIdx = (currentState?.values?.lastCompressedIndex ?? 0) as number;
    const newCount = prevCount + 1;

    // 压缩从上次边界到最近 keepRecent 条之间的新增消息
    const toCompress = messages.slice(lastIdx, messages.length - keepRecent);

    if (toCompress.length === 0) {
      return { compressed: false, compressionCount: prevCount, keepRecent };
    }

    const summary = await compressMessages(toCompress, prevSummary, model);

    await agent.updateState(config, {
      contextSummary: summary,
      compressionCount: newCount,
      lastCompressedIndex: messages.length - keepRecent,
    });

    return { compressed: true, compressionCount: newCount, keepRecent };
  } catch (err) {
    return {
      compressed: false,
      compressionCount: 0,
      keepRecent,
      error: (err as Error).message ?? String(err),
    };
  }
}

// ── Token 用量 ──────────────────────────────────────────
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * 以流式方式运行 agent
 */
export async function runAgentStream(
  userMessage: string,
  onToken: (token: string) => void,
  threadId: string = "default-session",
  signal?: AbortSignal,
  onToolCall?: (toolName: string, args: Record<string, any>) => void,
): Promise<{ text: string; usage: TokenUsage | null }> {
  const config = { configurable: { thread_id: threadId } };

  const stream = await agent.stream(
    { messages: [new HumanMessage(userMessage)] },
    { ...config, streamMode: "messages", signal },
  );

  let fullResponse = "";
  let usage: TokenUsage | null = null;
  const toolCallAccumulator = new Map<
    string,
    { name: string; argsParts: string[] }
  >();

  for await (const chunk of stream as any) {
    if (signal?.aborted) break;

    const message = chunk[0];
    const metadata = chunk[1];

    // 只看 model_request 节点的输出
    if (metadata?.langgraph_node !== "model_request") continue;

    // 捕获 token 用量
    const um = (message as any).usage_metadata as UsageMetadata | undefined;
    if (um) {
      const input = um.input_tokens ?? (um as any).inputTokens ?? 0;
      const output = um.output_tokens ?? (um as any).outputTokens ?? 0;
      const total = um.total_tokens ?? (um as any).totalTokens ?? 0;
      if (input > 0 || output > 0 || total > 0) {
        usage = {
          inputTokens: input,
          outputTokens: output,
          totalTokens: total,
        };
      }
    }

    const content: string =
      (message as any).content ?? (message as any).kwargs?.content ?? "";
    const toolCallChunks = (message as any).tool_call_chunks ?? [];

    if (content) {
      onToken(content);
      fullResponse += content;
    }

    // 累积 tool_call chunks
    if (toolCallChunks.length > 0 && onToolCall) {
      for (const tc of toolCallChunks) {
        const index = tc.index ?? 0;
        const existing = toolCallAccumulator.get(String(index));
        const name = tc.name ?? existing?.name ?? "";
        const parts = [...(existing?.argsParts ?? []), tc.args ?? ""];
        toolCallAccumulator.set(String(index), { name, argsParts: parts });
      }
    }
  }

  // 流结束后触发 tool call 回调
  if (onToolCall && toolCallAccumulator.size > 0) {
    for (const [, { name, argsParts }] of toolCallAccumulator) {
      if (name) {
        let parsedArgs: Record<string, any> = {};
        try {
          parsedArgs = argsParts.join("") ? JSON.parse(argsParts.join("")) : {};
        } catch {
          // 拼接后仍可能因 chunk 边界不完整导致解析失败，忽略
        }
        onToolCall(name, parsedArgs);
      }
    }
  }

  return { text: fullResponse, usage };
}

export { model };
