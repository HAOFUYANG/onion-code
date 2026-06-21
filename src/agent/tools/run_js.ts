import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { hasDangerousApi } from "./security.js";

function isNodeAvailable(): boolean {
  try {
    execSync("node --version", {
      encoding: "utf-8",
      timeout: 5_000,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

export const runJsTool = tool(
  async ({ code }: { code: string }) => {
    if (!code.trim()) {
      return "Error: Code cannot be empty.";
    }

    // 安全扫描：阻止危险 API 调用
    if (hasDangerousApi(code)) {
      return `Error: Code contains dangerous operations (e.g., fs.rmSync, child_process, shutil.rmtree) and was blocked.`;
    }

    if (!isNodeAvailable()) {
      return "Error: Node.js is not installed or not available in PATH.";
    }

    // 写入临时文件执行，避免命令行转义问题
    const tmpFile = path.join(
      os.tmpdir(),
      `run-js-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.js`,
    );

    try {
      fs.writeFileSync(tmpFile, code, "utf-8");

      const output = execSync(`node "${tmpFile}"`, {
        cwd: process.cwd(),
        timeout: 15_000,
        encoding: "utf-8",
        maxBuffer: 1024 * 512,
      });

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
    name: "run_js",
    description:
      "Execute JavaScript/Node.js code. This is the PRIMARY and PREFERRED way to run JS code — do NOT use write_file + exec as an alternative. Code is written to a temp file in the system temp directory, executed, and automatically cleaned up. No files are left behind. Returns stdout output. Dangerous operations (fs.rmSync, child_process, exec, spawn, etc.) are blocked.",
    schema: z.object({
      code: z
        .string()
        .describe(
          "The JavaScript code to execute. Use console.log() to output results.",
        ),
    }),
  },
);
