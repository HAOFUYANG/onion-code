import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { hasDangerousApi } from "./security";
import { toolLogLines } from "../style";

// 按优先级尝试的 Python 候选路径
const PYTHON_CANDIDATES = [
  "python3",
  "/usr/bin/python3",
  "/opt/homebrew/bin/python3",
  "/usr/local/bin/python3",
];

// 缓存已找到的可用 Python 路径，避免每次重复探测
let cachedPythonPath: string | null = null;

/**
 * 探测可用 python3：依次尝试候选路径，返回第一个能正常执行的路径。
 * 结果会被缓存，后续调用直接返回。
 */
function findWorkingPython(): string | null {
  if (cachedPythonPath) return cachedPythonPath;

  for (const candidate of PYTHON_CANDIDATES) {
    try {
      const ver = execSync(`${candidate} --version`, {
        encoding: "utf-8",
        timeout: 5_000,
        stdio: "pipe",
      }).trim();
      if (ver.startsWith("Python 3")) {
        cachedPythonPath = candidate;
        return candidate;
      }
    } catch {
      // 当前候选不可用，继续尝试下一个
    }
  }
  return null;
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

    const pythonPath = findWorkingPython();
    if (!pythonPath) {
      return "Error: python3 is not installed or not available in PATH. Please install Python 3 first.";
    }

    // 写入临时文件执行，避免命令行转义问题
    const tmpFile = path.join(
      os.tmpdir(),
      `run-py-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.py`,
    );

    try {
      fs.writeFileSync(tmpFile, code, "utf-8");

      const output = execSync(`${pythonPath} "${tmpFile}"`, {
        cwd: process.cwd(),
        timeout: 15_000,
        encoding: "utf-8",
        maxBuffer: 1024 * 512,
      });

      console.log(toolLogLines("run_py", code.split("\n").length));
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
      "Execute Python code using python3. This is the PRIMARY and PREFERRED way to run Python code — do NOT use write_file + exec as an alternative. Code is written to a temp file in the system temp directory, executed, and automatically cleaned up. No files are left behind. Returns stdout output. Dangerous operations (os.remove, subprocess, shutil.rmtree, etc.) are blocked.",
    schema: z.object({
      code: z
        .string()
        .describe("The Python code to execute. Use print() to output results."),
    }),
  },
);
