import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import env from "@/env";

// This script runs migrations on the database
async function runMigration() {
    const client = createClient({
        url: env.TURSO_DATABASE_URL,
        authToken: env.TURSO_AUTH_TOKEN,
    });

    const db = drizzle(client);

    // console.log("Running migrations...");

    try {
        await migrate(db, { migrationsFolder: "./src/lib/api/db/migrations" });
        // console.log("Migrations completed successfully");
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        client.close();
    }
}

runMigration();
