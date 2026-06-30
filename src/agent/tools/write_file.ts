import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { hasDangerousApi } from "./security.js";

export const writeFileTool = tool(
  async ({ filename, content }: { filename: string; content: string }) => {
    const cwd = process.cwd();
    const resolved = path.resolve(cwd, filename);

    // 安全检查：确保路径没有逃逸到当前目录之外
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith("..") || path.isAbsolute(filename)) {
      return `Error: Cannot write files outside the current directory.`;
    }

    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return `Error: "${filename}" is a directory, not a file.`;
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        return `Error checking file: ${err.message}`;
      }
      // ENOENT = 文件不存在，允许创建
    }

    // 安全检查：内容中不能包含危险 API 调用
    if (hasDangerousApi(content)) {
      return `Error: File content contains dangerous operations (e.g., fs.rmSync, shutil.rmtree) and was blocked.`;
    }

    try {
      fs.writeFileSync(resolved, content, "utf-8");
      return `Successfully wrote to "${filename}".`;
    } catch (err: any) {
      return `Error writing file: ${err.message}`;
    }
  },
  {
    name: "write_file",
    description:
      "Create a new file or overwrite an existing file in the current directory. Writing content with dangerous operations (e.g., fs.rmSync, shutil.rmtree) is blocked.",
    schema: z.object({
      filename: z
        .string()
        .describe("The name of the file to create or overwrite."),
      content: z.string().describe("The content to write to the file."),
    }),
  },
);
