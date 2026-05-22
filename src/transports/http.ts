import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { createRestRouter } from "../api/rest.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createHttpTransport(server: McpServer) {
  const port = parseInt(process.env.PORT || "3000", 10);
  const app = express();

  app.use(express.json());
  app.use(cors());

  // Health check (no auth)
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // API Key auth middleware
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    app.use((req, res, next) => {
      if (req.path === "/health" || req.path === "/openapi.json") return next();
      const token = req.headers.authorization?.replace("Bearer ", "") || req.query.api_key;
      if (token !== apiKey) return res.status(401).json({ error: "Unauthorized" });
      next();
    });
  }

  // OpenAPI spec (dynamically set server URL)
  app.get("/openapi.json", (_req, res) => {
    const specPath = resolve(__dirname, "../openapi.json");
    const spec = JSON.parse(readFileSync(specPath, "utf-8"));
    const host = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${port}`;
    spec.servers = [{ url: `${host}/api` }];
    res.json(spec);
  });

  // REST API for GPT Actions
  app.use("/api", createRestRouter());

  // MCP Streamable HTTP endpoint
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  app.listen(port, () => {
    console.error(`TTRPG MCP Server listening on port ${port}`);
    console.error(`  MCP endpoint: POST /mcp`);
    console.error(`  REST API:     /api/*`);
    console.error(`  OpenAPI spec: GET /openapi.json`);
  });

  return null;
}
