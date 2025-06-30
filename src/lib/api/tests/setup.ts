import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs"; // Changed to bcryptjs to match your project
import { drizzle } from "drizzle-orm/libsql";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import * as schema from "../db/schema";

// Create an in-memory database for testing
const testClient = createClient({
    url: "file::memory:",
});

// Create Drizzle ORM instance with schema
export const testDb = drizzle(testClient, { schema });

// Setup function to create tables and seed test data
export async function setupTestDb() {
    // Create tables
    await testClient.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_login INTEGER
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      mobile TEXT NOT NULL UNIQUE,
      pan TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      exchange TEXT NOT NULL,
      isin TEXT NOT NULL UNIQUE,
      sector TEXT,
      current_price REAL DEFAULT 0,
      last_updated INTEGER,
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      trade_date INTEGER NOT NULL,
      settlement_date INTEGER NOT NULL,
      brokerage_fee REAL NOT NULL,
      gst REAL NOT NULL,
      stt REAL NOT NULL,
      stamp_duty REAL NOT NULL,
      exchange_fee REAL NOT NULL,
      sebi_fee REAL NOT NULL,
      total_charges REAL NOT NULL,
      net_amount REAL NOT NULL,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (stock_id) REFERENCES stocks (id)
    );

    CREATE TABLE IF NOT EXISTS client_holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      stock_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      average_price REAL NOT NULL,
      current_value REAL,
      last_updated INTEGER DEFAULT (strftime('%s', 'now')),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (stock_id) REFERENCES stocks (id),
      UNIQUE (client_id, stock_id)
    );

    CREATE TABLE IF NOT EXISTS brokerage_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      total_trades INTEGER NOT NULL,
      total_turnover REAL NOT NULL,
      brokerage_amount REAL NOT NULL,
      gst_amount REAL NOT NULL,
      total_amount REAL NOT NULL,
      paid INTEGER DEFAULT 0,
      calculation_date INTEGER DEFAULT (strftime('%s', 'now')),
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (client_id) REFERENCES clients (id),
      UNIQUE (client_id, month, year)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      brokerage_calculation_id INTEGER,
      amount REAL NOT NULL,
      payment_date INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      reference_number TEXT,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (client_id) REFERENCES clients (id),
      FOREIGN KEY (brokerage_calculation_id) REFERENCES brokerage_calculations (id)
    );
  `);

    // Seed admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await testDb.insert(schema.admins).values({
        email: "admin@investasure.com",
        password: hashedPassword,
    });

    // Seed test client
    await testDb.insert(schema.clients).values({
        name: "Test Client",
        email: "test@example.com",
        mobile: "9876543210",
        pan: "ABCDE1234F",
        address: "123 Test Street",
    });

    // Seed test stock
    await testDb.insert(schema.stocks).values({
        symbol: "TESTCO",
        name: "Test Company Ltd",
        exchange: "NSE",
        sector: "Technology",
        currentPrice: 100.50,
    });
}

// Mock the database in the API
vi.mock("../db", () => ({
    getDB: () => testDb,
}));

// Setup and teardown for tests
beforeAll(async () => {
    await setupTestDb();
});

afterAll(async () => {
    await testClient.close();
});

afterEach(async () => {
    // Clean up tables after each test except for the schema tables
    // Only delete tables that exist in your current schema
    await testDb.delete(schema.payments).catch(() => {});
    await testDb.delete(schema.brokerages).catch(() => {});
    await testDb.delete(schema.trades).catch(() => {});

    // Reset auto-increment for these tables
    await testClient.execute("DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?, ?)", [
        "payments",
        "brokerage_calculations",
        "client_holdings",
        "trades",
    ]);
});
