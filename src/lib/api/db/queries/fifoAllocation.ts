import { and, desc, eq, sql } from "drizzle-orm";

import type { TransactionType } from "../index";
import type { ExchangeType, NewFifoAllocation } from "../schema";

import { getDB } from "../index";
import { fifoAllocations } from "../schema";

/**
 * Create a new FIFO allocation record
 */
export async function create(data: NewFifoAllocation, tx?: TransactionType) {
    const [allocation] = await getDB(tx).insert(fifoAllocations).values(data).returning();
    return allocation ?? null;
}

/**
 * Find FIFO allocations by sell trade ID
 */
export async function findBySellTradeId(sellTradeId: number, tx?: TransactionType) {
    return getDB(tx).query.fifoAllocations.findMany({
        where: eq(fifoAllocations.sellTradeId, sellTradeId),
        orderBy: [desc(fifoAllocations.createdAt)],
    });
}

/**
 * Find FIFO allocations by buy trade ID
 */
export async function findByBuyTradeId(buyTradeId: number, tx?: TransactionType) {
    return getDB(tx).query.fifoAllocations.findMany({
        where: eq(fifoAllocations.buyTradeId, buyTradeId),
        orderBy: [desc(fifoAllocations.createdAt)],
    });
}

/**
 * Find FIFO allocations by client and symbol
 */
export async function findByClientSymbol(clientId: number, symbol: string, exchange: string, tx?: TransactionType) {
    return getDB(tx).query.fifoAllocations.findMany({
        where: and(
            eq(fifoAllocations.clientId, clientId),
            eq(fifoAllocations.symbol, symbol),
            eq(fifoAllocations.exchange, exchange as ExchangeType),
        ),
        orderBy: [desc(fifoAllocations.createdAt)],
    });
}

/**
 * Calculate total profit/loss for a client
 */
export async function calculateTotalProfitLoss(clientId: number, tx?: TransactionType): Promise<number> {
    const result = await getDB(tx)
        .select({ totalPnL: sql<number>`sum(${fifoAllocations.profitLoss})` })
        .from(fifoAllocations)
        .where(eq(fifoAllocations.clientId, clientId));

    return result[0]?.totalPnL || 0;
}
