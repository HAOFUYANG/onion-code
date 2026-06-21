import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { loadSkill, discoverSkills } from "../skills.js";

export const loadSkillTool = tool(
  async ({ skillName }: { skillName: string }) => {
    // 先验证 skill 是否存在（提供更友好的错误）
    const allSkills = discoverSkills();
    const found = allSkills.find((s) => s.name === skillName);

    if (!found) {
      const available = allSkills.map((s) => `"${s.name}"`).join(", ");
      return `Error: Skill "${skillName}" not found. Available skills: ${available || "(none)"}`;
    }

    const content = loadSkill(skillName);
    if (!content) {
      return `Error: Failed to load skill "${skillName}".`;
    }

    return content;
  },
  {
    name: "load_skill",
    description:
      "Load the full content of a skill by its name. Use this to activate a skill and get its complete instructions. Call this when you determine a skill's description matches the user's request and you need the full guidance.",
    schema: z.object({
      skillName: z.string().describe("The name of the skill to load."),
    }),
  },
);
