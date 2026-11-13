import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const owner = "utils/systemScreens.ts";
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.ts", "*.tsx"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter((file) => file && existsSync(new URL(file, root)));

assert.ok(files.includes(owner), `${owner} is missing from the source files`);

const packages = ["expo-document-picker", "expo-image-picker", "expo-sharing"];
const quoted = packages.map((name) => `["']${name}["']`).join("|");
const importsPackage = new RegExp(`\\bfrom\\s*(?:${quoted})|\\b(?:import|require)\\s*\\(\\s*(?:${quoted})`);

const offenders = files.filter((file) => {
  if (file === owner) {
    return false;
  }
  const source = readFileSync(new URL(file, root), "utf8");
  return importsPackage.test(source) || source.includes("requestPermissionsAsync");
});

assert.deepEqual(
  offenders,
  [],
  `${offenders.join(", ")} opens a picker, share sheet or permission dialog outside ${owner}; open the screen through ${owner} so App lock gives it its grace minute`,
);

console.log("system-screens-check: ok");
