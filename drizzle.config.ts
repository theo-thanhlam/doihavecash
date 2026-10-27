import { defineConfig } from "drizzle-kit";

// Local dev reads .env; in containers the variables come from the environment.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
