import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { createRestRouter } from "../api/rest.js";
import { readFileSync } from "fs";
import { join } from "path";

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

  // OpenAPI spec - serve with dynamic server URL
  app.get("/openapi.json", (req, res) => {
    try {
      const proto = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const baseUrl = `${proto}://${host}/api`;
      const raw = readFileSync(join(process.cwd(), "openapi.json"), "utf-8");
      const spec = JSON.parse(raw);
      spec.servers = [{ url: baseUrl }];
      res.json(spec);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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
