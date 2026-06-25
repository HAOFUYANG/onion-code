import * as fs from "node:fs";
import * as path from "node:path";
import { ensurePythonEnvironment, PYTHON_DATA_PACKAGES } from "./python_env.js";

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
