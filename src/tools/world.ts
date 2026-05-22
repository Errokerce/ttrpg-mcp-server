import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../db/connection.js";
import { getActiveCampaignId } from "./campaign.js";

export function registerWorldTools(server: McpServer) {
  server.registerTool(
    "upsert_world_entity",
    {
      description: "Create or update a world entity (NPC, Location, Faction, Item)",
      inputSchema: {
        type: z.enum(["NPC", "Location", "Faction", "Item"]),
        name: z.string(),
        properties: z.record(z.string(), z.unknown()).optional().default({}),
        relationships: z.array(z.object({
          target: z.string(),
          relation: z.string(),
        })).optional().default([]),
      },
    },
    async ({ type, name, properties, relationships }) => {
      const db = getDb();
      const campaignId = getActiveCampaignId();
      const result = await db.collection("world_states").findOneAndUpdate(
        { campaignId, type, name },
        { $set: { properties, relationships, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, returnDocument: "after" }
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "get_world_entity",
    {
      description: "Get a specific world entity by type and name",
      inputSchema: {
        type: z.enum(["NPC", "Location", "Faction", "Item"]).optional(),
        name: z.string(),
      },
    },
    async ({ type, name }) => {
      const db = getDb();
      const filter: any = { campaignId: getActiveCampaignId(), name };
      if (type) filter.type = type;
      const entity = await db.collection("world_states").findOne(filter);
      if (!entity) return { content: [{ type: "text", text: `Entity "${name}" not found` }], isError: true };
      return { content: [{ type: "text", text: JSON.stringify(entity, null, 2) }] };
    }
  );

  server.registerTool(
    "query_world_entities",
    {
      description: "Query world entities by type or search term",
      inputSchema: {
        type: z.enum(["NPC", "Location", "Faction", "Item"]).optional(),
        limit: z.number().optional().default(50),
      },
    },
    async ({ type, limit }) => {
      const db = getDb();
      const filter: any = { campaignId: getActiveCampaignId() };
      if (type) filter.type = type;
      const entities = await db.collection("world_states").find(filter).limit(limit).toArray();
      return { content: [{ type: "text", text: JSON.stringify(entities, null, 2) }] };
    }
  );

  server.registerTool(
    "log_event",
    {
      description: "Log a world event",
      inputSchema: {
        description: z.string().describe("What happened"),
        involvedEntities: z.array(z.string()).optional().default([]),
        tags: z.array(z.string()).optional().default([]),
      },
    },
    async ({ description, involvedEntities, tags }) => {
      const db = getDb();
      const campaignId = getActiveCampaignId();
      const latest = await db.collection("progress")
        .findOne({ campaignId }, { sort: { day: -1, sequence: -1 } });
      const doc = {
        campaignId,
        description,
        involvedEntities,
        tags,
        progressRef: latest ? { day: latest.day, sequence: latest.sequence } : null,
        timestamp: new Date(),
      };
      await db.collection("events").insertOne(doc);
      return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
    }
  );

  server.registerTool(
    "get_event_history",
    {
      description: "Get event history, optionally filtered by entity or tag",
      inputSchema: {
        entity: z.string().optional().describe("Filter by involved entity name"),
        tag: z.string().optional().describe("Filter by tag"),
        limit: z.number().optional().default(30),
      },
    },
    async ({ entity, tag, limit }) => {
      const db = getDb();
      const filter: any = { campaignId: getActiveCampaignId() };
      if (entity) filter.involvedEntities = entity;
      if (tag) filter.tags = tag;
      const events = await db.collection("events")
        .find(filter).sort({ timestamp: -1 }).limit(limit).toArray();
      return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
    }
  );
}
