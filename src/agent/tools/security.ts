// ── 危险 API 调用模式检测 ──────────────────
// 供 write_file 和 exec 共享使用
// 扫描内容中的高危 API 调用，即使被引号包裹也能发现
export const DANGEROUS_API_PATTERNS: RegExp[] = [
  // Node.js fs 模块（删除/写入/权限/链接）
  /fs\.(?:rm|rmSync|unlink|unlinkSync|rmdir|rmdirSync)\(/,
  /fs\.(?:writeFile|writeFileSync|write|writeSync)\(/,
  /fs\.(?:chmod|chmodSync|chown|chownSync|lchmod|lchown)\(/,
  /fs\.(?:symlink|symlinkSync|link|linkSync|mkdtemp|mkdtempSync)\(/,
  // Node.js 子进程
  /child_process\./,
  /exec(?:Sync|\(\))?\s*\(/,
  /spawn(?:Sync)?\s*\(/,
  // 核心模块 require 或 import
  /require\([\s'"]fs["'\s]\)/,
  /require\([\s'"]child_process["'\s]\)/,
  // Python 危险模块
  /shutil\.(?:rmtree|rmdir|move|copy)/,
  /os\.(?:remove|unlink|rmdir|system)/,
  /subprocess\.(?:run|call|Popen)/,
  /pathlib\.(?:Path|PosixPath|PurePosixPath).*\.(?:unlink|rmdir)/,
];

export function hasDangerousApi(content: string): boolean {
  return DANGEROUS_API_PATTERNS.some((re) => re.test(content));
}
