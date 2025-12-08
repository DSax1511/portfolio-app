const { spawnSync } = require("child_process");

try {
  require.resolve("vitest");
} catch (error) {
  console.error("Vitest is not installed. Run 'npm install' to install dependencies.");
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync("npx", ["vitest", ...args], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 0);
