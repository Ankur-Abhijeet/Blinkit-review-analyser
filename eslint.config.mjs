import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          basePath: "./",
          zones: [
            // Rule 1: L1 domain module imports nothing from app/ or components/
            {
              target: "./lib/taxonomy.ts",
              from: "./app"
            },
            {
              target: "./lib/taxonomy.ts",
              from: "./components"
            },
            {
              target: "./lib/research-questions.ts",
              from: "./app"
            },
            {
              target: "./lib/research-questions.ts",
              from: "./components"
            },
            {
              target: "./lib/categories.ts",
              from: "./app"
            },
            {
              target: "./lib/categories.ts",
              from: "./components"
            },
            {
              target: "./lib/collectors/keyword-filter.ts",
              from: "./app"
            },
            {
              target: "./lib/collectors/keyword-filter.ts",
              from: "./components"
            },

            // Rule 2: L2 domain logic never imports L3 (transport / app/api) or L5 (UI / components)
            {
              target: "./lib",
              from: "./app/api",
              except: ["./lib/taxonomy.ts", "./lib/research-questions.ts", "./lib/categories.ts"]
            },
            {
              target: "./lib",
              from: "./components"
            },

            // Rule 3: L4 orchestrator (app/page.tsx) never imports L2 directly (except types + limits)
            {
              target: "./app/page.tsx",
              from: "./lib",
              except: [
                "types.ts",
                "types",
                "llm/limits.ts",
                "llm/limits",
                "ingest/parse.ts",
                "ingest/parse",
                "findings.ts",
                "findings",
                "synthesis.ts",
                "synthesis",
                "aggregate.ts",
                "aggregate"
              ]
            },
            {
              target: "./app/runs/**",
              from: "./lib",
              except: [
                "types.ts",
                "types",
                "llm/limits.ts",
                "llm/limits"
              ]
            }
          ]
        }
      ]
    }
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
  ]),
]);

export default eslintConfig;
