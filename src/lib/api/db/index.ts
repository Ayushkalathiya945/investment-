import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import env from "@/env";

import * as schema from "./schema";

// Database connection configuration
const tursoClient = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
});

// Create Drizzle ORM instance with schema
export const db = drizzle(tursoClient, { schema, casing: "snake_case" });

// Export schema for use in the application
export { schema };

export type DBType = LibSQLDatabase<typeof schema> & {
    $client: LibSQLDatabase<typeof schema>;
};

export function getDB(tx?: TransactionType): DBType | TransactionType {
    return tx || db;
}

export type SchemaType = typeof schema;

// This is a simplification - it should be compatible with both the transaction and DB types
export type TransactionType = any;
