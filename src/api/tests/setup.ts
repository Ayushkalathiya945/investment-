import { beforeAll, afterAll, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';
import bcrypt from 'bcrypt';

// Create an in-memory database for testing
const testClient = createClient({
  url: 'file::memory:',
});

// Create Drizzle ORM instance with schema
export const testDb = drizzle(testClient, { schema });

// Setup function to create tables and seed test data
export async function setupTestDb() {
  // Create tables
  await testClient.execute(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      last_login INTEGER
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      mobile TEXT NOT NULL,
      pan TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      date_of_birth INTEGER NOT NULL,
      kyc_verified INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now')),
      deleted_at INTEGER
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
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await testDb.insert(schema.admins).values({
    username: 'admin',
    password: hashedPassword,
    email: 'admin@investasure.com',
  });

  // Seed test client
  await testDb.insert(schema.clients).values({
    name: 'Test Client',
    email: 'test@example.com',
    mobile: '9876543210',
    pan: 'ABCDE1234F',
    address: '123 Test Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    date_of_birth: Math.floor(new Date('1990-01-01').getTime() / 1000),
    kyc_verified: 1,
  });

  // Seed test stock
  await testDb.insert(schema.stocks).values({
    symbol: 'TESTCO',
    name: 'Test Company Ltd',
    exchange: 'NSE',
    isin: 'IN1234567890',
    sector: 'Technology',
    current_price: 100.50,
    last_updated: Math.floor(Date.now() / 1000),
  });
}

// Mock the database in the API
jest.mock('../db', () => ({
  db: testDb,
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
  await testDb.delete(schema.payments);
  await testDb.delete(schema.brokerage);
  await testDb.delete(schema.clientHoldings);
  await testDb.delete(schema.trades);
  
  // Reset auto-increment for these tables
  await testClient.execute('DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?, ?)', [
    'payments',
    'brokerage_calculations',
    'client_holdings',
    'trades',
  ]);
});
