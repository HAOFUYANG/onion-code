import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

export const readFileTool = tool(
  async ({ filename }: { filename: string }) => {
    const cwd = process.cwd();
    const resolved = path.resolve(cwd, filename);

    // 安全检查：确保路径没有逃逸到当前目录之外
    const relative = path.relative(cwd, resolved);
    if (relative.startsWith("..") || path.isAbsolute(filename)) {
      return `Error: Cannot read files outside the current directory.`;
    }

    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return `Error: "${filename}" is a directory, not a file.`;
      }

      const content = fs.readFileSync(resolved, "utf-8");
      return content;
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return `Error: File "${filename}" not found.`;
      }
      return `Error reading file: ${err.message}`;
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file in the current directory.",
    schema: z.object({
      filename: z.string().describe("The name of the file to read."),
    }),
  },
);
