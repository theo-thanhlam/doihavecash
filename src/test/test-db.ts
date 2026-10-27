import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

/**
 * Creates a throwaway schema in DATABASE_URL, applies the migrations to it, and
 * points DATABASE_URL at it. Call before importing "@/db". Drop it in afterAll.
 */
export async function createTestSchema() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for database tests");
  const schema = `test_${randomBytes(6).toString("hex")}`;

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  const files = readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const text = readFileSync(`drizzle/${file}`, "utf8").replaceAll(
      '"public".',
      "",
    );
    for (const statement of text.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.query(statement);
    }
  }

  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = scoped.toString();

  return {
    async drop() {
      const { pool } = await import("@/db");
      await pool.end();
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    },
  };
}
