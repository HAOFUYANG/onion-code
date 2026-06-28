import {
  type BaseMessage,
  HumanMessage,
  SystemMessage,
  type AIMessage,
} from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

/**
 * 将 BaseMessage[] 格式化为 LLM 可理解的文本。
 * 对 AIMessage 的 tool_calls 一并格式化，保留工具调用信息。
 */
export function formatMessagesForCompression(messages: BaseMessage[]): string {
  return messages
    .map((m) => {
      const role = m.getType();
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);

      // AIMessage 可能有 tool_calls
      if (role === "ai") {
        const aiMsg = m as AIMessage;
        const toolCalls = aiMsg.tool_calls;
        if (toolCalls && toolCalls.length > 0) {
          const callsInfo = toolCalls
            .map((tc) => `  → 调用工具: ${tc.name}(${JSON.stringify(tc.args)})`)
            .join("\n");
          return `[ai]: ${content}\n${callsInfo}`;
        }
      }

      // ToolMessage 标注工具名
      if (role === "tool") {
        const toolMsg = m as any;
        return `[tool:${toolMsg.name ?? "unknown"}]: ${content}`;
      }

      return `[${role}]: ${content}`;
    })
    .join("\n\n");
}

/**
 * 压缩消息 — 调用 AI 生成摘要。
 *
 * @param messages        待压缩的消息数组（由 CLI 侧切好边界传入）
 * @param existingSummary 已有的压缩摘要（null 表示首次压缩）
 * @param model           用于生成摘要的 LLM 实例
 * @returns 合并后的摘要文本
 */
export async function compressMessages(
  messages: BaseMessage[],
  existingSummary: string | null,
  model: ChatOpenAI,
): Promise<string> {
  if (messages.length === 0) {
    return existingSummary ?? "";
  }

  const conversationText = formatMessagesForCompression(messages);

  try {
    let userPrompt: string;

    if (existingSummary) {
      // 增量压缩：已有摘要 + 新增消息
      userPrompt = [
        "## 已有历史摘要",
        existingSummary,
        "",
        "## 新增对话（需合并到上述摘要中）",
        conversationText,
        "",
        "请将上述新增对话内容合并到已有历史摘要中，输出一段完整的中文摘要（300字以内）。",
      ].join("\n");
    } else {
      // 首次压缩
      userPrompt = [
        "## 对话历史",
        conversationText,
        "",
        "请将以上对话历史压缩为一段简洁的中文摘要（300字以内），只保留关键信息和结论，不要包含语气词和客套话。",
      ].join("\n");
    }

    const response = await model.invoke([
      new SystemMessage(
        "你是一个对话摘要助手。请生成简洁、准确的中文摘要，保留关键决策、代码变更、用户需求和技术细节。",
      ),
      new HumanMessage(userPrompt),
    ]);

    const newSummary =
      typeof response.content === "string"
        ? response.content.trim()
        : JSON.stringify(response.content).trim();

    // 合并：已有摘要 + [后续对话摘要] + 新摘要
    if (existingSummary) {
      return `${existingSummary}\n\n[后续对话摘要]\n${newSummary}`;
    }

    return newSummary;
  } catch {
    // 压缩失败，返回已有摘要
    return existingSummary ?? "";
  }
}
