/* eslint-disable ts/no-use-before-define */
import { relations } from "drizzle-orm";
import { index, int, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// Admin table for authentication
export const admins = sqliteTable("admins", {
    id: int("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
    lastLogin: int(),
});

// Clients table - simplified
export type Exchange = "NSE" | "BSE";
export const clients = sqliteTable("clients", {
    id: int("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    pan: text("pan").notNull().unique(),
    email: text("email").notNull().unique(),
    mobile: text("mobile").notNull().unique(),
    address: text("address"),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
});

export const clientRelations = relations(clients, ({ many }) => {
    return {
        trades: many(trades),
        brokerages: many(brokerages),
        payments: many(payments),
    };
});

// Stocks table
export const stocks = sqliteTable(
    "stocks",
    {
        id: int("id").primaryKey({ autoIncrement: true }),
        symbol: text("symbol").notNull(),
        name: text("name").notNull(),
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

export const stockRelations = relations(stocks, ({ many }) => {
    return {
        trades: many(trades),
    };
});

// Trade types
export enum TradeType {
    BUY = "BUY",
    SELL = "SELL",
}

export enum ExchangeType {
    NSE = "NSE",
    BSE = "BSE",
}

// Enhanced Trades table - FIXED the typo in isFullySold
export const trades = sqliteTable("trades", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id),
    symbol: text("symbol").notNull(),
    exchange: text("exchange", {}).notNull(),
    type: text("type", { enum: [TradeType.BUY, TradeType.SELL] }).notNull(),
    quantity: int("quantity").notNull(),
    price: real("price").notNull(),
    tradeDate: int("trade_date").notNull(),
    netAmount: real("net_amount").notNull(),

    // FIFO tracking for BUY trades
    originalQuantity: int("original_quantity").notNull(),
    remainingQuantity: int("remaining_quantity").notNull(),
    isFullySold: int("is_fully_sold").notNull().default(0), // FIXED: removed space

    // For SELL trades
    sellProcessed: int("sell_processed").notNull().default(0),

    // Brokerage tracking - simplified
    lastBrokerageCalculated: int("last_brokerage_calculated"), // YYYYMM format

    notes: text("notes"),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
    updatedAt: int("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date()),
}, table => [
    // Added indexes for better performance
    index("client_symbol_idx").on(table.clientId, table.symbol, table.exchange),
    index("trade_date_idx").on(table.tradeDate),
    index("fifo_idx").on(table.type, table.isFullySold, table.tradeDate),
]);

export const tradeRelations = relations(trades, ({ one, many }) => {
    return {
        client: one(clients, { fields: [trades.clientId], references: [clients.id] }),
        stock: one(stocks, { fields: [trades.symbol, trades.exchange], references: [stocks.symbol, stocks.exchange] }),
        fifoAllocations: many(fifoAllocations),
    };
});

// FIFO Allocation table - Enhanced for better tracking
export const fifoAllocations = sqliteTable("fifo_allocations", {
    id: int("id").primaryKey({ autoIncrement: true }),
    sellTradeId: int("sell_trade_id").notNull().references(() => trades.id),
    buyTradeId: int("buy_trade_id").notNull().references(() => trades.id),

    // Quick access fields (denormalized for performance)
    clientId: int("client_id").notNull(),
    symbol: text("symbol").notNull(),
    exchange: text("exchange", { enum: ["NSE", "BSE"] }).notNull(),

    // Allocation details
    quantityAllocated: int("quantity_allocated").notNull(),
    buyPrice: real("buy_price").notNull(),
    sellPrice: real("sell_price").notNull(),
    buyDate: int("buy_date").notNull(),
    sellDate: int("sell_date").notNull(),

    // Calculation fields
    buyValue: real("buy_value").notNull(),
    sellValue: real("sell_value").notNull(),
    profitLoss: real("profit_loss").notNull(),
    holdingDays: int("holding_days").notNull(),

    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    // Indexes for quick queries
    index("fifo_client_symbol_idx").on(table.clientId, table.symbol, table.exchange),
    index("sell_trade_idx").on(table.sellTradeId),
    index("buy_trade_idx").on(table.buyTradeId),
]);

export const fifoAllocationRelations = relations(fifoAllocations, ({ one }) => ({
    sellTrade: one(trades, { fields: [fifoAllocations.sellTradeId], references: [trades.id] }),
    buyTrade: one(trades, { fields: [fifoAllocations.buyTradeId], references: [trades.id] }),
    client: one(clients, { fields: [fifoAllocations.clientId], references: [clients.id] }),
}));

// Monthly brokerage calculations - Enhanced
export const brokerages = sqliteTable("brokerages", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id),
    month: int("month").notNull(), // 1-12
    year: int("year").notNull(),
    calculationPeriod: int("calculation_period").notNull(), // YYYYMM format

    // Calculation parameters
    brokerageRate: real("brokerage_rate").notNull().default(10), // 10% per month
    totalDaysInMonth: int("total_days_in_month").notNull(), // Actual days in month

    // Summary fields
    totalHoldingValue: real("total_holding_value").notNull(),
    totalHoldingDays: int("total_holding_days").notNull(),
    brokerageAmount: real("brokerage_amount").notNull(),

    // Payment tracking
    isPaid: int("is_paid").notNull().default(0),
    paidAmount: real("paid_amount").default(0),

    // Metadata
    totalPositions: int("total_positions").notNull(),
    calculatedAt: int("calculated_at").notNull(),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    unique().on(table.clientId, table.calculationPeriod),
    index("period_idx").on(table.calculationPeriod),
]);

export const brokerageRelations = relations(brokerages, ({ one, many }) => {
    return {
        client: one(clients, { fields: [brokerages.clientId], references: [clients.id] }),
        details: many(brokerageDetails),
    };
});

// Detailed brokerage breakdown - Enhanced with better calculation tracking
export const brokerageDetails = sqliteTable("brokerage_details", {
    id: int("id").primaryKey({ autoIncrement: true }),
    brokerageId: int("brokerage_id").notNull().references(() => brokerages.id),
    tradeId: int("trade_id").notNull().references(() => trades.id),

    // Position details
    symbol: text("symbol").notNull(),
    exchange: text("exchange", { enum: ["NSE", "BSE"] }).notNull(),
    quantity: int("quantity").notNull(),
    buyPrice: real("buy_price").notNull(),
    buyDate: int("buy_date").notNull(),

    // Holding period calculation - KEY for accurate brokerage
    holdingStartDate: int("holding_start_date").notNull(), // First day of month OR buy date
    holdingEndDate: int("holding_end_date").notNull(), // Last day of month OR sell date
    holdingDays: int("holding_days").notNull(), // Actual days held in this month
    totalDaysInMonth: int("total_days_in_month").notNull(),

    // Value and brokerage calculation
    positionValue: real("position_value").notNull(), // quantity * buyPrice
    monthlyBrokerageRate: real("monthly_brokerage_rate").notNull().default(10),
    dailyBrokerageRate: real("daily_brokerage_rate").notNull(), // monthlyRate / totalDaysInMonth
    brokerageAmount: real("brokerage_amount").notNull(), // positionValue * dailyRate * holdingDays

    // Sale information (if sold in this month)
    isSoldInMonth: int("is_sold_in_month").notNull().default(0),
    sellDate: int("sell_date"),
    sellPrice: real("sell_price"),
    sellValue: real("sell_value"),
    partialSaleQuantity: int("partial_sale_quantity"), // If only part of position was sold

    // Calculation transparency
    calculationFormula: text("calculation_formula"), // "₹10000 * 10% * 15/31 days = ₹483.87"
    notes: text("notes"),

    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    index("brokerage_trade_idx").on(table.brokerageId, table.tradeId),
]);

export const brokerageDetailsRelations = relations(brokerageDetails, ({ one }) => {
    return {
        brokerage: one(brokerages, { fields: [brokerageDetails.brokerageId], references: [brokerages.id] }),
        trade: one(trades, { fields: [brokerageDetails.tradeId], references: [trades.id] }),
    };
});

// Payments table - simplified
export const payments = sqliteTable("payments", {
    id: int("id").primaryKey({ autoIncrement: true }),
    clientId: int("client_id").notNull().references(() => clients.id),
    amount: real("amount").notNull(),
    paymentType: text("payment_type", { enum: ["brokerage", "other"] }).notNull().default("other"),
    description: text("description"),
    paymentDate: int("payment_date", { mode: "timestamp" }).notNull(),
    brokerageId: int("brokerage_id"), // Reference to brokerage payment
    notes: text("notes"),
    createdAt: int("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
}, table => [
    index("payment_client_date_idx").on(table.clientId, table.paymentDate),
]);

export const paymentRelations = relations(payments, ({ one }) => {
    return {
        client: one(clients, { fields: [payments.clientId], references: [clients.id] }),
        brokerage: one(brokerages, { fields: [payments.brokerageId], references: [brokerages.id] }),
    };
});

// Export all types
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Stock = typeof stocks.$inferSelect;
export type NewStock = typeof stocks.$inferInsert;

export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;

export type Brokerage = typeof brokerages.$inferSelect;
export type NewBrokerage = typeof brokerages.$inferInsert;

export type BrokerageDetail = typeof brokerageDetails.$inferSelect;
export type NewBrokerageDetail = typeof brokerageDetails.$inferInsert;

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export type FifoAllocation = typeof fifoAllocations.$inferSelect;
export type NewFifoAllocation = typeof fifoAllocations.$inferInsert;

// Helper types for brokerage calculations
export type HoldingPosition = {
    tradeId: number;
    clientId: number;
    symbol: string;
    exchange: ExchangeType;
    quantity: number;
    buyPrice: number;
    buyDate: number;
    positionValue: number;
    isSold: boolean;
    soldDate?: number;
    soldPrice?: number;
};

export type MonthlyBrokerageCalculation = {
    clientId: number;
    month: number;
    year: number;
    totalDaysInMonth: number;
    positions: HoldingPosition[];
    totalBrokerage: number;
    totalHoldingValue: number;
    totalHoldingDays: number;
};

// Key calculation interfaces
export type BrokerageCalculationInput = {
    clientId: number;
    month: number;
    year: number;
    brokerageRate?: number; // Default 10%
};

export type BrokerageCalculationResult = {
    brokerage: NewBrokerage;
    details: NewBrokerageDetail[];
    totalAmount: number;
    positionsCount: number;
};

export type FifoProcessingResult = {
    allocations: NewFifoAllocation[];
    updatedBuyTrades: Array<{
        tradeId: number;
        remainingQuantity: number;
        isFullySold: boolean;
    }>;
    totalPnl: number;
};
