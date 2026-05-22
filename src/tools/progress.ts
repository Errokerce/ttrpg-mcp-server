import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../db/connection.js";
import { getActiveCampaignId } from "./campaign.js";

export function registerProgressTools(server: McpServer) {
  server.registerTool(
    "advance_progress",
    {
      description: "Record a new progress entry. LLM decides when to call this.",
      inputSchema: {
        title: z.string().describe("Title of this progress segment"),
        summary: z.string().describe("Summary of what happened"),
        newDay: z.boolean().optional().default(false).describe("Whether this starts a new in-game day"),
      },
    },
    async ({ title, summary, newDay }) => {
      const db = getDb();
      const campaignId = getActiveCampaignId();
      const latest = await db.collection("progress")
        .findOne({ campaignId }, { sort: { day: -1, sequence: -1 } });
      const day = newDay ? (latest?.day || 0) + 1 : (latest?.day || 1);
      const sequence = newDay ? 1 : (latest && latest.day === day ? latest.sequence + 1 : 1);
      const doc = { campaignId, day, sequence, title, summary, timestamp: new Date() };
      await db.collection("progress").insertOne(doc);
      return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
    }
  );

  server.registerTool(
    "get_current_progress",
    { description: "Get the latest progress entry for the active campaign" },
    async () => {
      const db = getDb();
      const latest = await db.collection("progress")
        .findOne({ campaignId: getActiveCampaignId() }, { sort: { day: -1, sequence: -1 } });
      if (!latest) return { content: [{ type: "text", text: "No progress recorded yet" }] };
      return { content: [{ type: "text", text: JSON.stringify(latest, null, 2) }] };
    }
  );

  server.registerTool(
    "get_progress_history",
    {
      description: "Get progress history for the active campaign",
      inputSchema: {
        day: z.number().optional().describe("Filter by specific day"),
        limit: z.number().optional().default(20),
      },
    },
    async ({ day, limit }) => {
      const db = getDb();
      const filter: any = { campaignId: getActiveCampaignId() };
      if (day !== undefined) filter.day = day;
      const entries = await db.collection("progress")
        .find(filter).sort({ day: 1, sequence: 1 }).limit(limit).toArray();
      return { content: [{ type: "text", text: JSON.stringify(entries, null, 2) }] };
    }
  );
}
