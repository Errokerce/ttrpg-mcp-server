import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is required");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || "ttrpg");
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Database not connected. Set MONGODB_URI and ensure connectDb() is called.");
  return db;
}

export async function disconnectDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
