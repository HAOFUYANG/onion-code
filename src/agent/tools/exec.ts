import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { execSync } from "node:child_process";
import { hasDangerousApi } from "./security.js";

// ── 第 1 层：危险命令名黑名单 ──
const DANGEROUS_COMMANDS = new Set([
  // 删除/销毁
  "rm",
  "rmdir",
  "del",
  "erase",
  "rd",
  // 移动/重命名
  "mv",
  "move",
  "ren",
  "rename",
  // 复制（可能覆盖）
  "cp",
  "copy",
  "xcopy",
  "robocopy",
  // 底层磁盘
  "dd",
  "mkfs",
  "format",
  "fdisk",
  "parted",
  "mkfile",
  // 系统命令
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  // 权限
  "chmod",
  "chown",
  "chattr",
  // 提权
  "sudo",
  "su",
  "doas",
  // 用户管理
  "passwd",
  "useradd",
  "userdel",
  "usermod",
  // 进程管理（不可恢复）
  "kill",
  "pkill",
  "killall",
  "taskkill",
  // 链接
  "ln",
  "mklink",
  // 危险网络操作
  "wget",
  "curl",
  // 压缩
  "gzip",
  "gunzip",
  "tar",
]);

// ── 第 2 层：Eval 模式检测 ──────────────────
// 阻止通过语言解释器注入任意代码：node -e, python -c 等
const EVAL_PATTERNS = [
  /\bnode\s+(?:-e|--eval|-p|--print)\s+/,
  /\bpython\d?\s+(?:-c|--command)\s+/,
  /\bruby\s+(?:-e)\s+/,
  /\bperl\s+(?:-e)\s+/,
  /\bphp\s+(?:-r)\s+/,
  /\bdeno\s+eval\s+/,
  /\bbun\s+(?:-e)\s+/,
];

// ── 第 3 层：危险 API 调用模式检测 ──────────
// 从共享模块 security.ts 导入

function hasEvalPattern(command: string): boolean {
  const lower = command.toLowerCase();
  return EVAL_PATTERNS.some((re) => re.test(lower));
}

function isDangerousByCommand(command: string): boolean {
  const tokens = command
    .toLowerCase()
    .split(/[\s;|&<>()$`"'\\]+/)
    .filter(Boolean);
  return tokens.some((t) => DANGEROUS_COMMANDS.has(t));
}

export const execTool = tool(
  async ({ command }: { command: string }) => {
    if (!command.trim()) {
      return "Error: Command cannot be empty.";
    }

    if (
      isDangerousByCommand(command) ||
      hasEvalPattern(command) ||
      hasDangerousApi(command)
    ) {
      if (hasEvalPattern(command)) {
        return `Error: Eval-style commands (node -e, python -c, etc.) are blocked for security.`;
      }
      return `Error: Command contains dangerous operations and was blocked.`;
    }

    try {
      const output = execSync(command, {
        cwd: process.cwd(),
        timeout: 30_000,
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
      });
      return output || "(command completed with no output)";
    } catch (err: any) {
      // execSync 抛出时可能带有 stdout/stderr 属性
      if (err.stderr) {
        return `Error: ${err.stderr}`;
      }
      if (err.stdout) {
        return err.stdout;
      }
      if (err.code === "ETIMEDOUT") {
        return "Error: Command timed out after 30 seconds.";
      }
      return `Error: ${err.message}`;
    }
  },
  {
    name: "exec",
    description:
      "Execute a shell command in the current directory. Dangerous commands (rm, mv, cp, sudo, chmod, kill, etc.), eval-style code injection (node -e, python -c, etc.), and destructive API calls (fs.rmSync, shutil.rmtree, etc.) are blocked.",
    schema: z.object({
      command: z.string().describe("The shell command to execute."),
    }),
  },
);
