import { isNull, relations } from "drizzle-orm";
import { index, int, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Admin table for authentication
export const admins = sqliteTable("admins", {
    id: int("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
    lastLogin: int("last_login"),
});

// Clients table
export const clients = sqliteTable("clients", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    pan: text("pan").notNull().unique(),
    email: text("email").notNull().unique(),
    mobile: text("mobile").notNull().unique(),
    address: text("address"),
    purseAmount: real("purse_amount").notNull().default(0),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

// Stocks table
export const stocks = sqliteTable(
    "stocks",
    {
        id: int("id").primaryKey({ autoIncrement: true }),
        symbol: text("symbol").notNull(),
        name: text("name"),
        exchange: text("exchange", { enum: ["NSE", "BSE"] }).notNull(),
        sector: text("sector"),
        currentPrice: real("current_price").default(0),
        createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
        updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
    },
    table => [
        unique().on(table.symbol, table.exchange),
    ],
);

// Trade types
export enum TradeType {
    BUY = "BUY",
    SELL = "SELL",
}

// Exchange types
export enum ExchangeType {
    NSE = "NSE",
    BSE = "BSE",
}

// Trades table
export const trades = sqliteTable("trades", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    exchange: text("exchange", { enum: ["NSE", "BSE"] }).notNull(),
    type: text("type", { enum: [TradeType.BUY, TradeType.SELL] }).notNull(),
    quantity: int("quantity").notNull(),
    price: real("price").notNull(),
    tradeDate: int("trade_date", { mode: "timestamp" }).notNull(),
    netAmount: real("net_amount").notNull(),

    // FIFO tracking for BUY trades
    originalQuantity: int("original_quantity").notNull(),
    remainingQuantity: int("remaining_quantity").notNull(),
    isFullySold: int("is_fully_sold").notNull().default(0),

    // For SELL trades
    sellProcessed: int("sell_processed").notNull().default(0),
    notes: text("notes"),

    // Brokerage calculation tracking
    brokerageCalculatedDate: int("brokerage_calculated_date", { mode: "timestamp" }),

    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, table => [
    index("client_symbol_idx").on(table.clientId, table.symbol, table.exchange),
    index("trade_date_idx").on(table.tradeDate),
    index("fifo_idx").on(table.type, table.isFullySold, table.tradeDate),
]);

// FIFO Allocation table
export const fifoAllocations = sqliteTable("fifo_allocations", {
    id: int("id").primaryKey({ autoIncrement: true }),
    sellTradeId: int("sell_trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
    buyTradeId: int("buy_trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    exchange: text("exchange", { enum: ["NSE", "BSE"] }).notNull(),
    quantityAllocated: int("quantity_allocated").notNull(),
    buyPrice: real("buy_price").notNull(),
    sellPrice: real("sell_price").notNull(),
    buyDate: int("buy_date", { mode: "timestamp" }).notNull(),
    sellDate: int("sell_date", { mode: "timestamp" }).notNull(),
    buyValue: real("buy_value").notNull(),
    sellValue: real("sell_value").notNull(),
    profitLoss: real("profit_loss").notNull(),
    holdingDays: int("holding_days").notNull(),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    index("fifo_client_symbol_idx").on(table.clientId, table.symbol, table.exchange),
    index("sell_trade_idx").on(table.sellTradeId),
    index("buy_trade_idx").on(table.buyTradeId),
]);

// Unused Amount Tracking (cash from sales not reinvested)
export const unusedAmounts = sqliteTable("unused_amounts", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    sourceTradeId: int("source_trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    remainingAmount: real("remaining_amount").notNull(),
    startDate: int("start_date", { mode: "timestamp" }).notNull(),
    endDate: int("end_date", { mode: "timestamp" }),
    lastBrokerageDate: int("last_brokerage_date", { mode: "timestamp" }),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, table => [
    index("unused_client_idx").on(table.clientId),
    index("unused_active_idx").on(table.clientId).where(isNull(table.endDate)),
]);

// Track usage of sold amounts (when cash is reinvested)
export const amountUsage = sqliteTable("amount_usage", {
    id: int("id").primaryKey({ autoIncrement: true }),
    unusedAmountId: int("unused_amount_id").notNull().references(() => unusedAmounts.id, { onDelete: "cascade" }),
    buyTradeId: int("buy_trade_id").notNull().references(() => trades.id, { onDelete: "cascade" }),
    amountUsed: real("amount_used").notNull(),
    usageDate: int("usage_date", { mode: "timestamp" }).notNull(),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Daily Brokerage Tracking
export const dailyBrokerage = sqliteTable("daily_brokerage", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    date: int("date", { mode: "timestamp" }).notNull(),
    holdingAmount: real("holding_amount").notNull().default(0),
    unusedAmount: real("unused_amount").notNull().default(0),
    dailyRate: real("daily_rate"), // Kept for backward compatibility
    dailyHoldingRate: real("daily_holding_rate").notNull(),
    dailyUnusedRate: real("daily_unused_rate").notNull(),
    daysInQuarter: int("days_in_quarter"),
    holdingBrokerage: real("holding_brokerage").notNull(),
    unusedBrokerage: real("unused_brokerage").notNull(),
    totalDailyBrokerage: real("total_daily_brokerage").notNull(),
    notes: text("notes"),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    index("daily_client_date_idx").on(table.clientId, table.date),
    unique().on(table.clientId, table.date),
]);

// Payments table
export const payments = sqliteTable("payments", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    paymentType: text("payment_type", { enum: ["brokerage", "other"] }).notNull().default("other"),
    description: text("description"),
    paymentDate: int("payment_date", { mode: "timestamp" }).notNull(),
    notes: text("notes"),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    index("payment_client_date_idx").on(table.clientId, table.paymentDate),
]);

// Cron Job Tracking tables
export const cronJobs = sqliteTable("cron_jobs", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    description: text("description"),
    schedule: text("schedule").notNull(),
    command: text("command").notNull(),
    isActive: int("is_active").notNull().default(1),
    lastRun: int("last_run", { mode: "timestamp" }),
    nextRun: int("next_run", { mode: "timestamp" }),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

export const cronJobExecutions = sqliteTable("cron_job_executions", {
    id: int("id").primaryKey({ autoIncrement: true }),
    jobId: int("job_id").notNull().references(() => cronJobs.id, { onDelete: "cascade" }),
    startedAt: int("started_at", { mode: "timestamp" }).notNull(),
    completedAt: int("completed_at", { mode: "timestamp" }),
    status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
    executionTimeMs: int("execution_time_ms"),
    error: text("error"),
    logs: text("logs"),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    index("job_execution_idx").on(table.jobId, table.startedAt),
]);

// ===== RELATIONS =====

export const clientRelations = relations(clients, ({ many }) => ({
    trades: many(trades),
    unusedAmounts: many(unusedAmounts),
    dailyBrokerages: many(dailyBrokerage),
    payments: many(payments),
}));

export const stockRelations = relations(stocks, ({ many }) => ({
    trades: many(trades),
}));

export const tradeRelations = relations(trades, ({ one, many }) => ({
    client: one(clients, { fields: [trades.clientId], references: [clients.id] }),
    stock: one(stocks, { fields: [trades.symbol, trades.exchange], references: [stocks.symbol, stocks.exchange] }),
    fifoAllocations: many(fifoAllocations),
    sourceUnusedAmount: one(unusedAmounts, { fields: [trades.id], references: [unusedAmounts.sourceTradeId] }),
    amountUsages: many(amountUsage),
}));

export const fifoAllocationRelations = relations(fifoAllocations, ({ one }) => ({
    sellTrade: one(trades, { fields: [fifoAllocations.sellTradeId], references: [trades.id] }),
    buyTrade: one(trades, { fields: [fifoAllocations.buyTradeId], references: [trades.id] }),
    client: one(clients, { fields: [fifoAllocations.clientId], references: [clients.id] }),
}));

export const unusedAmountRelations = relations(unusedAmounts, ({ one, many }) => ({
    client: one(clients, { fields: [unusedAmounts.clientId], references: [clients.id] }),
    sourceTrade: one(trades, { fields: [unusedAmounts.sourceTradeId], references: [trades.id] }),
    usages: many(amountUsage),
}));

export const amountUsageRelations = relations(amountUsage, ({ one }) => ({
    unusedAmount: one(unusedAmounts, { fields: [amountUsage.unusedAmountId], references: [unusedAmounts.id] }),
    buyTrade: one(trades, { fields: [amountUsage.buyTradeId], references: [trades.id] }),
}));

export const dailyBrokerageRelations = relations(dailyBrokerage, ({ one }) => ({
    client: one(clients, { fields: [dailyBrokerage.clientId], references: [clients.id] }),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
    client: one(clients, { fields: [payments.clientId], references: [clients.id] }),
}));

export const cronJobRelations = relations(cronJobs, ({ many }) => ({
    executions: many(cronJobExecutions),
}));

export const cronJobExecutionRelations = relations(cronJobExecutions, ({ one }) => ({
    job: one(cronJobs, { fields: [cronJobExecutions.jobId], references: [cronJobs.id] }),
}));

// ===== TYPE DEFINITIONS =====

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type FifoAllocation = typeof fifoAllocations.$inferSelect;
export type NewFifoAllocation = typeof fifoAllocations.$inferInsert;

export type UnusedAmount = typeof unusedAmounts.$inferSelect;
export type NewUnusedAmount = typeof unusedAmounts.$inferInsert;

export type AmountUsage = typeof amountUsage.$inferSelect;
export type NewAmountUsage = typeof amountUsage.$inferInsert;

export type DailyBrokerage = typeof dailyBrokerage.$inferSelect;
export type NewDailyBrokerage = typeof dailyBrokerage.$inferInsert;

// Type for inserting daily brokerage records (excludes auto-increment id and auto-generated createdAt)
export type InsertDailyBrokerage = Omit<NewDailyBrokerage, "id" | "createdAt">;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type CronJob = typeof cronJobs.$inferSelect;
export type NewCronJob = typeof cronJobs.$inferInsert;

export type CronJobExecution = typeof cronJobExecutions.$inferSelect;
export type NewCronJobExecution = typeof cronJobExecutions.$inferInsert;
