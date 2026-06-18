import chalk from "chalk";
import { openConfigDialog } from "./config";

export interface SlashCommandContext {
  newThread: () => void;
  showHelp: () => void;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  handler: (ctx: SlashCommandContext) => Promise<"exit" | void> | "exit" | void;
}

export const slashCommands: SlashCommand[] = [
  {
    name: "config",
    aliases: ["conf"],
    description: "打开配置中心",
    handler: async () => openConfigDialog(),
  },
  {
    name: "new",
    description: "新建会话",
    handler: (ctx) => ctx.newThread(),
  },
  {
    name: "theme",
    description: "切换终端主题（即将支持）",
    handler: () => {
      console.log(
        chalk.yellow(
          "\n/theme 暂未实现。主题系统正在装配，别催，它还在穿宇航服。\n",
        ),
      );
    },
  },
  {
    name: "help",
    description: "查看 slash 命令帮助",
    handler: (ctx) => ctx.showHelp(),
  },
  {
    name: "exit",
    aliases: ["quit"],
    description: "退出程序",
    handler: () => "exit",
  },
];

export function matchSlashCommands(input: string): SlashCommand[] {
  const query = input.replace(/^\//, "").trim().toLowerCase();
  if (!query) return slashCommands;

  return slashCommands.filter((cmd) => {
    if (cmd.name.startsWith(query)) return true;
    return cmd.aliases?.some((alias) => alias.startsWith(query)) ?? false;
  });
}

export function formatSlashCommand(command: SlashCommand): string {
  return `/${command.name}`;
}
