import { readFileSync } from "fs";
import path from "path";
import { defineConfig } from "vitest/config";

// Map every tsconfig.json path alias to src/, never to dist/.
// "@services/*": ["src/services/*"] → /^@services\/(.*)$/ → <root>/src/services/$1
// "@types": ["src/types"] → /^@types$/ → <root>/src/types
const tsconfig = JSON.parse(
  readFileSync(path.join(__dirname, "tsconfig.json"), "utf8"),
) as {
  compilerOptions: { paths: Record<string, string[]> };
};

const alias = Object.entries(tsconfig.compilerOptions.paths).map(
  ([key, [target]]) => {
    if (key.endsWith("/*")) {
      return {
        find: new RegExp(`^${key.slice(0, -2)}/(.*)$`),
        replacement: path.join(__dirname, target.slice(0, -2), "$1"),
      };
    }
    return {
      find: new RegExp(`^${key}$`),
      replacement: path.join(__dirname, target),
    };
  },
);

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup/global.ts"],
    testTimeout: 15000,
    hookTimeout: 60000,
  },
});
