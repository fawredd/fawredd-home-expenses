import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const server = new Server(
  { name: "agile-orchestrator", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// 1. DEFINE THE TOOLS (What VS Code / Claude sees)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "update_backlog",
        description:
          "Updates the status of a specific task in agents-backlog.md",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The ID of the task, e.g., TASK-031",
            },
            status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
          },
          required: ["taskId", "status"],
        },
      },
      {
        name: "update_state",
        description:
          "Appends a new task completion block to .agents/artifacts/STATE.md",
        inputSchema: {
          type: "object",
          properties: {
            taskId: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            decisions: { type: "string" },
            pending: { type: "string" },
          },
          required: ["taskId", "title", "summary", "decisions", "pending"],
        },
      },
      {
        name: "run_lint_and_typecheck",
        description:
          "Runs pnpm lint and typescript type checking to validate the code.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// 2. EXECUTE THE LOGIC (What happens when the tool is called)
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "update_backlog") {
      const backlogPath = path.resolve(process.cwd(), "agents-backlog.md");

      console.error(`[BACKLOG] Starting update`);
      console.error(`[BACKLOG] File: ${backlogPath}`);
      console.error(`[BACKLOG] Task: ${args.taskId}`);
      console.error(`[BACKLOG] New Status: ${args.status}`);

      if (!fs.existsSync(backlogPath)) {
        throw new Error(`Backlog file not found: ${backlogPath}`);
      }

      const originalContent = fs.readFileSync(backlogPath, "utf-8");

      // Matches:
      // | TASK-031 | .... | **IN_PROGRESS** |
      const regex = new RegExp(
        `(\\|\\s*${args.taskId}\\s*\\|[^\\n]*?\\|\\s*\\*\\*)(.*?)(\\*\\*\\s*\\|)`,
        "g",
      );

      const matches = [...originalContent.matchAll(regex)];

      console.error(`[BACKLOG] Matches found: ${matches.length}`);

      if (matches.length === 0) {
        throw new Error(`Task ${args.taskId} not found in agents-backlog.md`);
      }

      const previousStatus = matches[0][2];

      const updatedContent = originalContent.replace(
        regex,
        `$1${args.status}$3`,
      );

      if (updatedContent === originalContent) {
        throw new Error(
          `Task ${args.taskId} found but no modification occurred`,
        );
      }

      fs.writeFileSync(backlogPath, updatedContent, "utf-8");

      console.error(
        `[BACKLOG] Updated ${args.taskId}: ${previousStatus} -> ${args.status}`,
      );

      return {
        content: [
          {
            type: "text",
            text:
              `Backlog updated successfully.\n` +
              `Task: ${args.taskId}\n` +
              `Old Status: ${previousStatus}\n` +
              `New Status: ${args.status}`,
          },
        ],
      };
    }

    if (name === "update_state") {
      const statePath = path.resolve(
        process.cwd(),
        ".agents/artifacts/STATE.md",
      );

      console.error(`[STATE] Starting update`);
      console.error(`[STATE] File: ${statePath}`);
      console.error(`[STATE] Task: ${args.taskId}`);

      if (!fs.existsSync(statePath)) {
        throw new Error(`STATE file not found: ${statePath}`);
      }

      const content = fs.readFileSync(statePath, "utf-8");

      const existingTaskRegex = new RegExp(
        `## \\[${args.taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`,
        "m",
      );

      if (existingTaskRegex.test(content)) {
        throw new Error(`Task ${args.taskId} already exists in STATE.md`);
      }

      const date = new Date().toISOString().split("T")[0];

      const block = `
---

## [${args.taskId}] — ${args.title}
- Status: DONE
- Date: ${date}
- Summary: ${args.summary}
- Decisions: ${args.decisions}
- Pending: ${args.pending}
`;

      fs.appendFileSync(statePath, block, "utf-8");

      console.error(`[STATE] Added entry for ${args.taskId}`);

      return {
        content: [
          {
            type: "text",
            text:
              `STATE updated successfully.\n` +
              `Task: ${args.taskId}\n` +
              `Date: ${date}`,
          },
        ],
      };
    }

    if (name === "run_lint_and_typecheck") {
      console.error("[VALIDATION] Starting validation");

      try {
        console.error("[VALIDATION] Running lint...");
        const lintOutput = execSync("pnpm run lint", {
          encoding: "utf-8",
          stdio: "pipe",
        });

        console.error("[VALIDATION] Lint passed");

        console.error("[VALIDATION] Running typecheck...");
        const typecheckOutput = execSync("pnpm run typecheck", {
          encoding: "utf-8",
          stdio: "pipe",
        });

        console.error("[VALIDATION] Typecheck passed");

        return {
          content: [
            {
              type: "text",
              text:
                `Validation successful.\n\n` +
                `=== LINT ===\n${lintOutput}\n\n` +
                `=== TYPECHECK ===\n${typecheckOutput}`,
            },
          ],
        };
      } catch (err) {
        console.error("[VALIDATION] Failed");

        return {
          content: [
            {
              type: "text",
              text:
                `Validation failed.\n\n` +
                `STDOUT:\n${err.stdout ?? ""}\n\n` +
                `STDERR:\n${err.stderr ?? ""}`,
            },
          ],
          isError: true,
        };
      }
    }

    throw new Error("Tool not found");
  } catch (error) {
    return {
      content: [
        { type: "text", text: `Error executing tool: ${error.message}` },
      ],
      isError: true,
    };
  }
});

// 3. START THE SERVER OVER STDIO
const transport = new StdioServerTransport();
await server.connect(transport);
