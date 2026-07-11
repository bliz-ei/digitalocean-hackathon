import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const candidates = process.platform === "win32"
  ? [path.join(root, ".venv", "Scripts", "python.exe"), "python", "py"]
  : [path.join(root, ".venv", "bin", "python"), "python3", "python"];
const executable = candidates.find((candidate) =>
  candidate.includes(path.sep) ? existsSync(candidate) : true,
);

if (!executable) {
  console.error("No Python interpreter found. Create .venv or install Python 3.11+.");
  process.exit(1);
}

const args = executable === "py" ? ["-3", ...process.argv.slice(2)] : process.argv.slice(2);
const pythonPath = path.join(root, "services", "api");
const result = spawnSync(executable, args, {
  cwd: root,
  env: {
    ...process.env,
    PYTHONPATH: process.env.PYTHONPATH
      ? `${pythonPath}${path.delimiter}${process.env.PYTHONPATH}`
      : pythonPath,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
