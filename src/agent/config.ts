import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import { ensurePythonEnvironment, PYTHON_DATA_PACKAGES } from "./python_env";

export interface PythonPipConfig {
  indexUrl: string;
  trustedHost: string;
}

export interface PythonConfig {
  venvPath: string;
  autoInstall: boolean;
  pip: PythonPipConfig;
}

export interface AppConfig {
  python: PythonConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  python: {
    venvPath: path.join(".data", "python-venv"),
    autoInstall: true,
    pip: {
      indexUrl: "https://pypi.tuna.tsinghua.edu.cn/simple",
      trustedHost: "pypi.tuna.tsinghua.edu.cn",
    },
  },
};

export function getDataDir(): string {
  return path.resolve(process.cwd(), ".data");
}

export function getConfigPath(): string {
  return path.join(getDataDir(), "config.json");
}

function mergeConfig(raw: Partial<AppConfig>): AppConfig {
  return {
    python: {
      ...DEFAULT_CONFIG.python,
      ...(raw.python ?? {}),
      pip: {
        ...DEFAULT_CONFIG.python.pip,
        ...(raw.python?.pip ?? {}),
      },
    },
  };
}

export function loadConfig(): AppConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return mergeConfig(raw);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: AppConfig): void {
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

export async function openConfigDialog(): Promise<void> {
  const current = loadConfig();

  console.log(chalk.bold.magenta("\n⚙ onionCode 配置中心\n"));

  const { section } = await inquirer.prompt<{ section: string }>([
    {
      type: "select",
      name: "section",
      message: "选择要配置的模块",
      choices: [
        { name: "Python 运行环境 / pip 镜像源", value: "python" },
        { name: "退出配置", value: "exit" },
      ],
    },
  ]);

  if (section === "exit") return;

  const answers = await inquirer.prompt<{
    indexUrl: string;
    trustedHost: string;
    autoInstall: boolean;
    initNow: boolean;
  }>([
    {
      type: "input",
      name: "indexUrl",
      message: "pip index-url",
      default: current.python.pip.indexUrl,
    },
    {
      type: "input",
      name: "trustedHost",
      message: "pip trusted-host",
      default: current.python.pip.trustedHost,
    },
    {
      type: "confirm",
      name: "autoInstall",
      message: "首次执行缺少 Python 依赖时，是否自动安装？",
      default: current.python.autoInstall,
    },
    {
      type: "confirm",
      name: "initNow",
      message: "是否立即初始化 Python 环境并安装常用数据分析依赖？",
      default: false,
    },
  ]);

  const nextConfig: AppConfig = {
    ...current,
    python: {
      ...current.python,
      autoInstall: answers.autoInstall,
      pip: {
        indexUrl: answers.indexUrl.trim(),
        trustedHost: answers.trustedHost.trim(),
      },
    },
  };

  saveConfig(nextConfig);
  console.log(chalk.green(`\n✅ 配置已保存到 ${getConfigPath()}`));

  if (answers.initNow) {
    const result = ensurePythonEnvironment(PYTHON_DATA_PACKAGES, nextConfig);
    if (result.ok) {
      console.log(chalk.green(`✅ Python 环境已就绪：${result.pythonPath}\n`));
    } else {
      console.log(chalk.red(`❌ Python 环境初始化失败：${result.error}\n`));
    }
  }
}
