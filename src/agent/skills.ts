import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface SkillManifest {
  name: string;
  description: string;
}

export interface SkillInfo extends SkillManifest {
  dir: string;
}

// ── 解析 SKILL.md 的 YAML frontmatter ──
function parseFrontmatter(content: string): SkillManifest | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  const descMatch = yaml.match(/^description:\s*(.+)$/m);

  if (!nameMatch || !descMatch) return null;

  return {
    name: nameMatch[1].trim(),
    description: descMatch[1].trim(),
  };
}

// ── 获取 skills 目录绝对路径 ──
// skills.ts 在 src/agent/skills.ts，skills 目录在 src/agent/skills/
function getSkillsDir(): string {
  // 1. __dirname + "skills"（dev: src/agent/skills, build-copy: dist/agent/skills）
  const primary = path.resolve(__dirname, "skills");
  if (fs.existsSync(path.join(primary, "planner", "SKILL.md"))) {
    return primary;
  }

  // 2. 回退到 src（运行 dist 但 skills 未复制到 dist 时）
  const srcFallback = path.resolve(__dirname, "../src/agent/skills");
  if (fs.existsSync(path.join(srcFallback, "planner", "SKILL.md"))) {
    return srcFallback;
  }

  // 3. 最终 fallback
  return primary;
}

// ── 技能缓存 ────────────────────────────────────────────
let cachedSkills: SkillInfo[] | null = null;

/** 清除技能缓存（新增/删除 skill 目录后调用） */
export function invalidateSkillCache(): void {
  cachedSkills = null;
}

/**
 * 遍历 skills 目录下所有子目录，读取每个 SKILL.md 的 name 和 description。
 * 返回 SkillInfo 数组（每项包含 name, description, dir）。
 * 结果被缓存，可通过 invalidateSkillCache() 清除。
 */
export function discoverSkills(): SkillInfo[] {
  if (cachedSkills) return cachedSkills;
  const skillsDir = getSkillsDir();
  const results: SkillInfo[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(skillsDir, entry.name);
    const skillPath = path.join(skillDir, "SKILL.md");

    if (!fs.existsSync(skillPath)) continue;

    try {
      const content = fs.readFileSync(skillPath, "utf-8");
      const manifest = parseFrontmatter(content);
      if (manifest) {
        results.push({ ...manifest, dir: skillDir });
      }
    } catch {
      // 跳过无法读取的 skill
    }
  }

  cachedSkills = results;
  return results;
}

/**
 * 根据 skill name 加载完整的 SKILL.md 内容。
 * @param name skill 的 name（对应 SKILL.md 中的 name 字段）
 * @returns SKILL.md 的完整内容，如果未找到则返回 null
 */
export function loadSkill(name: string): string | null {
  const skillsDir = getSkillsDir();

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
    if (!fs.existsSync(skillPath)) continue;

    try {
      const content = fs.readFileSync(skillPath, "utf-8");
      const manifest = parseFrontmatter(content);
      if (manifest && manifest.name === name) {
        return content;
      }
    } catch {
      // 继续查找
    }
  }

  return null;
}

/**
 * 将所有 skills 的 name 和 description 拼接成一段文本，用于注入 system prompt。
 * 包含 skills 目录路径，引导 AI 知道新 skill 应该放在哪里。
 */
export function getSkillText(): string {
  const skillsDir = getSkillsDir();
  const skills = discoverSkills();
  if (skills.length === 0) return "";

  const lines = ["\n## 可用 Skills\n"];
  lines.push(`Skills 目录: \`${skillsDir}\``);
  lines.push("新增 skill 时，请在此目录下创建子目录并添加 SKILL.md 文件。\n");
  for (const skill of skills) {
    lines.push(`- **${skill.name}**: ${skill.description}`);
  }
  lines.push("\n要使用某个 skill，调用 load_skill 工具加载其完整内容即可。");

  return lines.join("\n");
}
