import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { AppConfig } from "./config";

export const PYTHON_DATA_PACKAGES = ["pandas", "numpy", "openpyxl"];

interface PythonCommand {
  command: string;
  argsPrefix: string[];
}

interface PythonEnvironmentResult {
  ok: boolean;
  pythonPath?: string;
  argsPrefix?: string[];
  error?: string;
}

let cachedPythonPath: string | null = null;

function run(command: string, args: string[], timeout = 30_000) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf-8",
    timeout,
    maxBuffer: 1024 * 1024,
    shell: false,
  });
}

function isPython3(command: PythonCommand): boolean {
  const result = run(
    command.command,
    [...command.argsPrefix, "--version"],
    5_000,
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return result.status === 0 && output.startsWith("Python 3");
}

function getPythonCandidates(): PythonCommand[] {
  if (process.platform === "win32") {
    return [
      { command: "python", argsPrefix: [] },
      { command: "py", argsPrefix: ["-3"] },
    ];
  }

  return [
    { command: "python3", argsPrefix: [] },
    { command: "/usr/bin/python3", argsPrefix: [] },
    { command: "/opt/homebrew/bin/python3", argsPrefix: [] },
    { command: "/usr/local/bin/python3", argsPrefix: [] },
  ];
}

function findBasePython(): PythonCommand | null {
  for (const candidate of getPythonCandidates()) {
    if (isPython3(candidate)) return candidate;
  }
  return null;
}

function resolveVenvDir(config: AppConfig): string {
  return path.resolve(process.cwd(), config.python.venvPath);
}

export function getVenvPythonPath(config: AppConfig): string {
  const venvDir = resolveVenvDir(config);
  return process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");
}

function ensureVenv(config: AppConfig): PythonEnvironmentResult {
  const venvPython = getVenvPythonPath(config);
  if (fs.existsSync(venvPython)) {
    cachedPythonPath = venvPython;
    return { ok: true, pythonPath: venvPython };
  }

  const basePython = findBasePython();
  if (!basePython) {
    return {
      ok: false,
      error: "Python 3 is not installed or not available in PATH.",
    };
  }

  fs.mkdirSync(path.dirname(resolveVenvDir(config)), { recursive: true });
  const result = run(
    basePython.command,
    [...basePython.argsPrefix, "-m", "venv", resolveVenvDir(config)],
    120_000,
  );

  if (result.status !== 0 || !fs.existsSync(venvPython)) {
    return {
      ok: false,
      error: result.stderr || result.stdout || "Failed to create Python venv.",
    };
  }

  cachedPythonPath = venvPython;
  return { ok: true, pythonPath: venvPython };
}

function getMissingPackages(pythonPath: string, packages: string[]): string[] {
  if (packages.length === 0) return [];

  const script = `
import importlib.util
packages = ${JSON.stringify(packages)}
missing = [p for p in packages if importlib.util.find_spec(p) is None]
print("\\n".join(missing))
`;

  const result = run(pythonPath, ["-c", script], 30_000);
  if (result.status !== 0) return packages;
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function installPackages(
  pythonPath: string,
  packages: string[],
  config: AppConfig,
): PythonEnvironmentResult {
  if (packages.length === 0) return { ok: true, pythonPath };

  if (!config.python.autoInstall) {
    return {
      ok: false,
      error: `Missing Python packages: ${packages.join(", ")}. Auto install is disabled. Run /config to enable it.`,
    };
  }

  const pipArgs = ["-m", "pip", "install", ...packages];
  if (config.python.pip.indexUrl) {
    pipArgs.push("--index-url", config.python.pip.indexUrl);
  }
  if (config.python.pip.trustedHost) {
    pipArgs.push("--trusted-host", config.python.pip.trustedHost);
  }

  const result = run(pythonPath, pipArgs, 180_000);
  if (result.status !== 0) {
    return {
      ok: false,
      error:
        result.stderr || result.stdout || "Failed to install Python packages.",
    };
  }

  return { ok: true, pythonPath };
}

export function ensurePythonEnvironment(
  packages: string[],
  config: AppConfig,
): PythonEnvironmentResult {
  const venvResult = ensureVenv(config);
  if (!venvResult.ok || !venvResult.pythonPath) return venvResult;

  const missing = getMissingPackages(venvResult.pythonPath, packages);
  return installPackages(venvResult.pythonPath, missing, config);
}

export function detectRequiredPackages(code: string): string[] {
  const packages = new Set<string>();

  if (/\b(?:import|from)\s+pandas\b/.test(code)) {
    packages.add("pandas");
    packages.add("openpyxl");
  }
  if (/\b(?:import|from)\s+numpy\b/.test(code)) {
    packages.add("numpy");
  }
  if (/\b(?:import|from)\s+openpyxl\b/.test(code)) {
    packages.add("openpyxl");
  }

  return [...packages];
}

export function getPythonForCode(
  code: string,
  config: AppConfig,
): PythonEnvironmentResult {
  const requiredPackages = detectRequiredPackages(code);
  if (requiredPackages.length > 0) {
    return ensurePythonEnvironment(requiredPackages, config);
  }

  const venvPython = getVenvPythonPath(config);
  if (fs.existsSync(venvPython)) {
    cachedPythonPath = venvPython;
    return { ok: true, pythonPath: venvPython };
  }

  if (cachedPythonPath) return { ok: true, pythonPath: cachedPythonPath };

  const basePython = findBasePython();
  if (!basePython) {
    return {
      ok: false,
      error: "Python 3 is not installed or not available in PATH.",
    };
  }

  if (basePython.argsPrefix.length === 0) {
    cachedPythonPath = basePython.command;
  }
  return {
    ok: true,
    pythonPath: basePython.command,
    argsPrefix: basePython.argsPrefix,
  };
}
