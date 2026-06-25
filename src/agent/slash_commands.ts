export interface SlashCommandContext {
  newThread: () => void;
  showHelp: () => void;
  showSessions: () => void;
  rewindThread: (threadId: string) => void;
  openConfig: () => void;
  showNotice: (message: string) => void;
}

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  handler: (
    ctx: SlashCommandContext,
    args?: string,
  ) => Promise<"exit" | void> | "exit" | void;
}

export const slashCommands: SlashCommand[] = [
  {
    name: "config",
    aliases: ["conf"],
    description: "打开配置中心",
    handler: async (ctx) => ctx.openConfig(),
  },
  {
    name: "rewind",
    aliases: ["rw"],
    description: "恢复某条聊天记录（用法：/rewind <thread_id>）",
    handler: (ctx, args) => {
      if (!args?.trim()) {
        ctx.showNotice("\n  用法：/rewind <thread_id>  先用 /sessions 查看 ID\n");
        return;
      }
      ctx.rewindThread(args.trim());
    },
  },
  {
    name: "sessions",
    aliases: ["sess"],
    description: "查看最近 20 条聊天记录",
    handler: (ctx) => ctx.showSessions(),
  },
  {
    name: "new",
    description: "新建会话",
    handler: (ctx) => ctx.newThread(),
  },
  {
    name: "theme",
    description: "切换终端主题（即将支持）",
    handler: (ctx) => {
      ctx.showNotice("\n  /theme 暂未实现。主题系统后续会接入配置中心。\n");
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
