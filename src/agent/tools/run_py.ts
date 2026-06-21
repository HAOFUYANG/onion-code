import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { hasDangerousApi } from "./security.js";
import { loadConfig } from "../config.js";
import { getPythonForCode } from "../python_env.js";

export const runPyTool = tool(
  async ({ code }: { code: string }) => {
    if (!code.trim()) {
      return "Error: Code cannot be empty.";
    }

    // 安全扫描：阻止危险 API 调用
    if (hasDangerousApi(code)) {
      return `Error: Code contains dangerous operations (e.g., os.remove, subprocess, shutil.rmtree) and was blocked.`;
    }

    const runtime = getPythonForCode(code, loadConfig());
    if (!runtime.ok || !runtime.pythonPath) {
      return `Error: ${runtime.error ?? "Python 3 is not installed or not available in PATH."}`;
    }

    // 写入临时文件执行，避免命令行转义问题
    const tmpFile = path.join(
      os.tmpdir(),
      `run-py-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.py`,
    );

    try {
      fs.writeFileSync(tmpFile, code, "utf-8");

      const result = spawnSync(
        runtime.pythonPath,
        [...(runtime.argsPrefix ?? []), tmpFile],
        {
          cwd: process.cwd(),
          timeout: 15_000,
          encoding: "utf-8",
          maxBuffer: 1024 * 512,
          shell: false,
        },
      );

      if (result.error) {
        const error = result.error as NodeJS.ErrnoException;
        if (error.code === "ETIMEDOUT") {
          return "Error: Code execution timed out after 15 seconds.";
        }
        return `Error: ${error.message}`;
      }

      if (result.status !== 0) {
        return `Error: ${result.stderr || result.stdout || `Python exited with code ${result.status}`}`;
      }

      return result.stdout || "(code completed with no output)";
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
      "Execute Python code using python3. This is the PRIMARY and PREFERRED way to run Python code — do NOT use write_file + exec as an alternative. Code is written to a temp file in the system temp directory, executed, and automatically cleaned up. No files are left behind. Returns stdout output. Dangerous operations (os.remove, subprocess, shutil.rmtree, etc.) are blocked.",
    schema: z.object({
      code: z
        .string()
        .describe("The Python code to execute. Use print() to output results."),
    }),
  },
);
