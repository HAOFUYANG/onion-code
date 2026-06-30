import fs from "node:fs";
import path from "node:path";

export { searchTool } from "./tools/search.js";
export { readFileTool } from "./tools/read_file.js";
export { writeFileTool } from "./tools/write_file.js";
export { execTool } from "./tools/exec.js";
export { runJsTool } from "./tools/run_js.js";
export { runPyTool } from "./tools/run_py.js";
export { webSearchTool } from "./tools/web_search.js";
export { webFetchTool } from "./tools/web_fetch.js";
export { loadSkillTool } from "./tools/load_skill.js";

/**
 * 当 tool 输出内容过大时，将内容持久化到文件，返回摘要信息。
 * 内容 <= 50000 字符时原样返回，超出时写入文件并返回包含前 2000 字的预览。
 */
export function maybePersistedOutput(
  content: string,
  toolCallId: string,
): string {
  if (content.length <= 50000) {
    return content;
  }

  const dir = path.resolve(process.cwd(), "./.tool_output");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `tool_output_${toolCallId}.txt`);
  fs.writeFileSync(filePath, content, "utf-8");

  return `<persisted-output>
Output too large (${(content.length / 1024).toFixed(1)}KB).
Full output saved to: ${filePath}
If you need the complete content, it is recommended to read it in segments
Preview (first 2KB):
${content.slice(0, 2000)}
...
</persisted-output>`;
}
