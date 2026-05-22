import { Router, Request, Response } from "express";
import { DiceRoll } from "@dice-roller/rpg-dice-roller";
import { getDb } from "../db/connection.js";
import { ObjectId } from "mongodb";

let activeCampaignId: string | null = null;

function campaignId(): string {
  if (!activeCampaignId) throw new Error("No active campaign");
  return activeCampaignId;
}

function json(res: Response, data: any, status = 200) {
  res.status(status).json(data);
}

function err(res: Response, msg: string, status = 400) {
  res.status(status).json({ error: msg });
}

export function createRestRouter(): Router {
  const r = Router();

  // Dice
  r.post("/roll_dice", (req: Request, res: Response) => {
    try {
      const { notation, reason } = req.body;
      const roll = new DiceRoll(notation);
      json(res, { notation: roll.notation, output: roll.output, total: roll.total, reason });
    } catch (e: any) { err(res, e.message); }
  });

  // Campaigns
  r.post("/campaigns", async (req: Request, res: Response) => {
    const { name, description, setting } = req.body;
    const doc = { name, description: description || "", setting: setting || "", createdAt: new Date() };
    const result = await getDb().collection("campaigns").insertOne(doc);
    activeCampaignId = result.insertedId.toHexString();
    json(res, { id: activeCampaignId, ...doc }, 201);
  });

  r.get("/campaigns", async (_req: Request, res: Response) => {
    const campaigns = await getDb().collection("campaigns").find().project({ name: 1, description: 1, createdAt: 1 }).toArray();
    json(res, campaigns);
  });

  r.post("/campaigns/:id/switch", async (req: Request, res: Response) => {
    const campaign = await getDb().collection("campaigns").findOne({ _id: new ObjectId(req.params.id) });
    if (!campaign) return err(res, "Campaign not found", 404);
    activeCampaignId = req.params.id;
    json(res, { message: `Switched to: ${campaign.name}`, campaign });
  });

  r.get("/campaigns/current", async (_req: Request, res: Response) => {
    if (!activeCampaignId) return err(res, "No active campaign", 404);
    const campaign = await getDb().collection("campaigns").findOne({ _id: new ObjectId(activeCampaignId) });
    json(res, campaign);
  });

  // Players
  r.post("/players", async (req: Request, res: Response) => {
    const { name, hp = 10, maxHp = 10, attributes = {}, skills = [], inventory = [], customFields = {} } = req.body;
    const doc = { campaignId: campaignId(), name, hp, maxHp, attributes, skills, inventory, customFields, createdAt: new Date() };
    await getDb().collection("players").insertOne(doc);
    json(res, doc, 201);
  });

  r.get("/players", async (_req: Request, res: Response) => {
    const players = await getDb().collection("players").find({ campaignId: campaignId() }).toArray();
    json(res, players);
  });

  r.get("/players/:name", async (req: Request, res: Response) => {
    const player = await getDb().collection("players").findOne({ campaignId: campaignId(), name: req.params.name });
    if (!player) return err(res, "Player not found", 404);
    json(res, player);
  });

  r.patch("/players/:name", async (req: Request, res: Response) => {
    const { attributes, customFields, ...flat } = req.body;
    const setOps: Record<string, any> = { ...flat };
    if (attributes) for (const [k, v] of Object.entries(attributes)) setOps[`attributes.${k}`] = v;
    if (customFields) for (const [k, v] of Object.entries(customFields)) setOps[`customFields.${k}`] = v;
    const result = await getDb().collection("players").findOneAndUpdate(
      { campaignId: campaignId(), name: req.params.name },
      { $set: setOps },
      { returnDocument: "after" }
    );
    if (!result) return err(res, "Player not found", 404);
    json(res, result);
  });

  // Progress
  r.post("/progress", async (req: Request, res: Response) => {
    const { title, summary, newDay = false } = req.body;
    const cid = campaignId();
    const latest = await getDb().collection("progress").findOne({ campaignId: cid }, { sort: { day: -1, sequence: -1 } });
    const day = newDay ? (latest?.day || 0) + 1 : (latest?.day || 1);
    const sequence = newDay ? 1 : (latest && latest.day === day ? latest.sequence + 1 : 1);
    const doc = { campaignId: cid, day, sequence, title, summary, timestamp: new Date() };
    await getDb().collection("progress").insertOne(doc);
    json(res, doc, 201);
  });

  r.get("/progress/current", async (_req: Request, res: Response) => {
    const latest = await getDb().collection("progress").findOne({ campaignId: campaignId() }, { sort: { day: -1, sequence: -1 } });
    if (!latest) return json(res, { message: "No progress yet" });
    json(res, latest);
  });

  r.get("/progress", async (req: Request, res: Response) => {
    const filter: any = { campaignId: campaignId() };
    if (req.query.day) filter.day = Number(req.query.day);
    const entries = await getDb().collection("progress").find(filter).sort({ day: 1, sequence: 1 }).limit(Number(req.query.limit) || 20).toArray();
    json(res, entries);
  });

  // World entities
  r.put("/world/entities", async (req: Request, res: Response) => {
    const { type, name, properties = {}, relationships = [] } = req.body;
    const result = await getDb().collection("world_states").findOneAndUpdate(
      { campaignId: campaignId(), type, name },
      { $set: { properties, relationships, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: "after" }
    );
    json(res, result);
  });

  r.get("/world/entities/:name", async (req: Request, res: Response) => {
    const filter: any = { campaignId: campaignId(), name: req.params.name };
    if (req.query.type) filter.type = req.query.type;
    const entity = await getDb().collection("world_states").findOne(filter);
    if (!entity) return err(res, "Entity not found", 404);
    json(res, entity);
  });

  r.get("/world/entities", async (req: Request, res: Response) => {
    const filter: any = { campaignId: campaignId() };
    if (req.query.type) filter.type = req.query.type;
    const entities = await getDb().collection("world_states").find(filter).limit(Number(req.query.limit) || 50).toArray();
    json(res, entities);
  });

  // Events
  r.post("/events", async (req: Request, res: Response) => {
    const { description, involvedEntities = [], tags = [] } = req.body;
    const cid = campaignId();
    const latest = await getDb().collection("progress").findOne({ campaignId: cid }, { sort: { day: -1, sequence: -1 } });
    const doc = { campaignId: cid, description, involvedEntities, tags, progressRef: latest ? { day: latest.day, sequence: latest.sequence } : null, timestamp: new Date() };
    await getDb().collection("events").insertOne(doc);
    json(res, doc, 201);
  });

  r.get("/events", async (req: Request, res: Response) => {
    const filter: any = { campaignId: campaignId() };
    if (req.query.entity) filter.involvedEntities = req.query.entity;
    if (req.query.tag) filter.tags = req.query.tag;
    const events = await getDb().collection("events").find(filter).sort({ timestamp: -1 }).limit(Number(req.query.limit) || 30).toArray();
    json(res, events);
  });

  // Rules
  r.put("/rules", async (req: Request, res: Response) => {
    const { category, title, content } = req.body;
    await getDb().collection("rules").updateOne(
      { campaignId: campaignId(), category, title },
      { $set: { content, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    json(res, { message: `Rule set: [${category}] ${title}` });
  });

  r.delete("/rules", async (req: Request, res: Response) => {
    const { category, title } = req.body;
    const result = await getDb().collection("rules").deleteOne({ campaignId: campaignId(), category, title });
    if (result.deletedCount === 0) return err(res, "Rule not found", 404);
    json(res, { message: `Deleted: [${category}] ${title}` });
  });

  r.get("/rules", async (req: Request, res: Response) => {
    const filter: any = { campaignId: campaignId() };
    if (req.query.category) filter.category = req.query.category;
    const rules = await getDb().collection("rules").find(filter).toArray();
    json(res, rules);
  });

  return r;
}
