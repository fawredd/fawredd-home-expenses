import type { Config } from "drizzle-kit";

export default {
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
schemaFilter: ['fawredd_home_expenses'],
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/fawredd_local",
  },
} satisfies Config;
