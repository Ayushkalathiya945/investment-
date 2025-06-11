/* eslint-disable ts/no-use-before-define */
import { relations } from "drizzle-orm";
import { int, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Admin table for authentication
export const admins = sqliteTable("admins", {
    id: int("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    createdAt: int().notNull().$default(() => Date.now()),
    updatedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
    lastLogin: int(),
});

// Clients table
export const clients = sqliteTable("clients", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    pan: text("pan").notNull().unique(),
    email: text("email").notNull().unique(),
    mobile: text("mobile").notNull().unique(),
    address: text("address").notNull(),
    createdAt: int().notNull().$default(() => Date.now()),
    updatedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});
export const clientRelations = relations(clients, ({ many }) => ({
    trades: many(trades),
    clientHoldings: many(clientHoldings),
    payments: many(payments),
    brokerage: many(brokerages),
}));

export enum Exchange {
    NSE = "NSE",
    BSE = "BSE",
}

// Stocks table for Indian stock market
export const stocks = sqliteTable("stocks", {
    id: int("id").primaryKey({ autoIncrement: true }),
    symbol: text("symbol").notNull().unique(),
    name: text("name").notNull(),
    exchange: text("exchange", { enum: [Exchange.NSE, Exchange.BSE] }).notNull(),
    isin: text("isin").notNull().unique(),
    sector: text("sector"),
    currentPrice: real("current_price").default(0),
    createdAt: int().notNull().$default(() => Date.now()),
    updatedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});
export const stockRelations = relations(stocks, ({ many }) => ({
    trades: many(trades),
}));

export enum TradeType {
    BUY = "buy",
    SELL = "sell",
}

// Trades table for buy/sell transactions
export const trades = sqliteTable("trades", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
    stockId: int("stock_id").notNull().references(() => stocks.id, { onDelete: "restrict" }),
    type: text("type", { enum: [TradeType.BUY, TradeType.SELL] }).notNull(),
    quantity: int("quantity").notNull(),
    price: real("price").notNull(),
    tradeDate: int().notNull(),
    netAmount: real("net_amount").notNull(),
    notes: text("notes"),
    createdAt: int().notNull().$default(() => Date.now()),
    updatedAt: int().notNull().$default(() => Date.now()).$onUpdate(() => Date.now()),
});
export const tradeRelations = relations(trades, ({ one }) => ({
    client: one(clients, {
        fields: [trades.clientId],
        references: [clients.id],
    }),
    stock: one(stocks, {
        fields: [trades.stockId],
        references: [stocks.id],
    }),
}));

// Client holdings table for current portfolio positions
export const clientHoldings = sqliteTable("client_holdings", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
    stockId: int("stock_id").notNull().references(() => stocks.id, { onDelete: "restrict" }),
    cronJobId: int("cron_job_id").notNull().references(() => cronJobs.id, { onDelete: "restrict" }),
    quantity: int("quantity").notNull(),
    currentValue: real("current_value"),
    createdAt: int().notNull().$default(() => Date.now()),
}, table => [
    unique().on(table.clientId, table.stockId, table.cronJobId),
]);
export const clientHoldingsRelations = relations(clientHoldings, ({ one }) => ({
    client: one(clients, {
        fields: [clientHoldings.clientId],
        references: [clients.id],
    }),
    stock: one(stocks, {
        fields: [clientHoldings.stockId],
        references: [stocks.id],
    }),
    cronJob: one(cronJobs, {
        fields: [clientHoldings.cronJobId],
        references: [cronJobs.id],
    }),
}));

// Brokerage calculations table for monthly brokerage
export const brokerages = sqliteTable("brokerage_calculations", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
    month: int("month").notNull(), // 1-12
    year: int("year").notNull(),
    totalTrades: int("total_trades").notNull(),
    totalTurnover: real("total_turnover").notNull(),
    cronJobId: int("cron_job_id").notNull().references(() => cronJobs.id, { onDelete: "restrict" }),
    brokerageAmount: real("brokerage_amount").notNull(),
    createdAt: int().notNull().$default(() => Date.now()),
}, table => [
    unique().on(table.clientId, table.month, table.year),
]);
export const brokerageCalculationRelations = relations(brokerages, ({ one }) => ({
    client: one(clients, {
        fields: [brokerages.clientId],
        references: [clients.id],
    }),
    cronJob: one(cronJobs, {
        fields: [brokerages.cronJobId],
        references: [cronJobs.id],
    }),
}));

// Payments table for tracking payments
export const payments = sqliteTable("payments", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "restrict" }),
    amount: real("amount").notNull(),
    description: text("description"),
    paymentDate: int().notNull(),
    notes: text("notes"),
    createdAt: int().notNull().$default(() => Date.now()),
});
export const paymentRelations = relations(payments, ({ one }) => ({
    client: one(clients, {
        fields: [payments.clientId],
        references: [clients.id],
    }),
}));

export enum CronJobStatus {
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed",
}

// Cron jobs table
export const cronJobs = sqliteTable("cron_jobs", {
    id: int("id").primaryKey({ autoIncrement: true }),
    jobName: text("job_name").notNull().unique(),
    status: text("status", { enum: [CronJobStatus.IN_PROGRESS, CronJobStatus.COMPLETED, CronJobStatus.FAILED] }).notNull(),
    createdAt: int().notNull().$default(() => Date.now()),
});
export const cronJobRelations = relations(cronJobs, ({ many }) => ({
    clientHoldings: many(clientHoldings),
    brokerage: many(brokerages),
}));

// Export all tables for use in the application
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type ClientHolding = typeof clientHoldings.$inferSelect;
export type NewClientHolding = typeof clientHoldings.$inferInsert;

export type Brokerage = typeof brokerages.$inferSelect;
export type NewBrokerage = typeof brokerages.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;
