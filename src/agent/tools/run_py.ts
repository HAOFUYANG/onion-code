import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { hasDangerousApi } from "./security";

function isPython3Available(): boolean {
  try {
    execSync("python3 --version", {
      encoding: "utf-8",
      timeout: 5_000,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

export const runPyTool = tool(
  async ({ code }: { code: string }) => {
    if (!code.trim()) {
      return "Error: Code cannot be empty.";
    }

    // 安全扫描：阻止危险 API 调用
    if (hasDangerousApi(code)) {
      return `Error: Code contains dangerous operations (e.g., os.remove, subprocess, shutil.rmtree) and was blocked.`;
    }

    if (!isPython3Available()) {
      return "Error: python3 is not installed or not available in PATH. Please install Python 3 first.";
    }

    // 写入临时文件执行，避免命令行转义问题
    const tmpFile = path.join(
      os.tmpdir(),
      `run-py-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.py`,
    );

    try {
      fs.writeFileSync(tmpFile, code, "utf-8");

      const output = execSync(`python3 "${tmpFile}"`, {
        cwd: process.cwd(),
        timeout: 15_000,
        encoding: "utf-8",
        maxBuffer: 1024 * 512,
      });

      console.log(`\n[Tool] run_py called (${code.split("\n").length} lines)`);
      return output || "(code completed with no output)";
    } catch (err: any) {
      if (err.stderr) {
        return `Error: ${err.stderr}`;
      }
      if (err.stdout) {
        return err.stdout;
      }
      if (err.code === "ETIMEDOUT") {
        return "Error: Code execution timed out after 15 seconds.";
      }
      return `Error: ${err.message}`;
    } finally {
      // 清理临时文件
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch {
        // 忽略清理失败
      }
    }
  },
  {
    name: "run_py",
    description:
      "Execute Python code using python3. The code is written to a temporary file and executed. Returns stdout output. Dangerous operations (os.remove, subprocess, shutil.rmtree, etc.) are blocked. Use this for calculations, data transformations, string processing, etc.",
    schema: z.object({
      code: z
        .string()
        .describe("The Python code to execute. Use print() to output results."),
    }),
  },
);
