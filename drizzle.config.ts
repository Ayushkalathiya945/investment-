import type { Config } from "drizzle-kit";

import env from "@/env";

export default {
    schema: "./src/lib/api/db/schema.ts",
    out: "./src/lib/api/db/migrations",
    dialect: "turso",
    casing: "snake_case",
    dbCredentials: {
        url: env.TURSO_DATABASE_URL,
        authToken: env.TURSO_AUTH_TOKEN,
    },
} satisfies Config;
