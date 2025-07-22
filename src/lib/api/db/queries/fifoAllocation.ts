import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

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
    const db = getDB(tx);
    return await db.select().from(fifoAllocations).where(eq(fifoAllocations.buyTradeId, buyTradeId));
}

/**
 * Delete FIFO allocations by sell trade ID
 */
export async function deleteBySellTradeId(sellTradeId: number, tx?: TransactionType) {
    const db = getDB(tx);
    await db.delete(fifoAllocations).where(eq(fifoAllocations.sellTradeId, sellTradeId));
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

/**
 * Get all FIFO allocations for a client within a date range
 * Returns allocations where the sell date is within the given range
 * @param clientId Client ID to search for
 * @param startDate Start date (timestamp) for range search
 * @param endDate End date (timestamp) for range search
 * @returns Array of FIFO allocation records
 */
export async function getFifoAllocationsByDateRange(
    clientId: number,
    startDate: number,
    endDate: number,
    tx?: TransactionType,
) {
    return getDB(tx).select().from(fifoAllocations).where(
        and(
            eq(fifoAllocations.clientId, clientId),
            gte(fifoAllocations.sellDate, new Date(startDate)),
            lte(fifoAllocations.sellDate, new Date(endDate)),
        ),
    );
}
