import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { TransactionType } from "@/api/db";
import type { NewTrade, TradeType } from "@/api/db/schema";

import { getDB } from "@/api/db";
import { trades } from "@/api/db/schema";

export async function create(data: NewTrade, tx?: TransactionType) {
    const [trade] = await getDB(tx).insert(trades).values(data).returning();

    return trade ?? null;
}

export async function update(data: Partial<NewTrade> & { id: number }, tx?: TransactionType) {
    const [trade] = await getDB(tx).update(trades).set(data).where(eq(trades.id, data.id)).returning();

    return trade ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [trade] = await getDB(tx).delete(trades).where(eq(trades.id, id)).returning();

    return trade ?? null;
}

export async function findOne(data: { id: number }, tx?: TransactionType) {
    return getDB(tx).query.trades.findFirst({
        where: eq(trades.id, data.id),
    });
}

export async function findOneWithRelations(data: { id: number }, tx?: TransactionType) {
    return getDB(tx).query.trades.findFirst({
        where: eq(trades.id, data.id),
        with: {
            client: true,
            stock: true,
        },
    });
}

export async function findAllWithPagination(data: { page: number; limit: number; type?: TradeType; stockId?: number; clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.type)
        conditions.push(eq(trades.type, data.type));
    if (data.stockId)
        conditions.push(eq(trades.stockId, data.stockId));
    if (data.clientId)
        conditions.push(eq(trades.clientId, data.clientId));
    if (data.from)
        conditions.push(gte(trades.createdAt, data.from));
    if (data.to)
        conditions.push(lte(trades.createdAt, data.to));

    if (conditions.length === 0)
        return { trades: [], count: 0 };

    const tradesData = await getDB(tx).query.trades.findMany({
        with: {
            client: true,
            stock: true,
        },
        where: and(...conditions),
        orderBy: [desc(trades.createdAt)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const tradeCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(trades)
        .where(and(...conditions));

    return { trades: tradesData, count: tradeCount && tradeCount.length > 0 ? tradeCount[0].count : 0 };
}

// help me to create a query to calculate the total trade amount of particular client
// if trade type is buy the net amount is incre ase
// if trade type is sell the net amount is decrease
// do the calculation in database
export async function calculateTotalTradeAmount(data: { clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];

    if (data.clientId)
        conditions.push(eq(trades.clientId, data.clientId));
    if (data.from)
        conditions.push(gte(trades.createdAt, data.from));
    if (data.to)
        conditions.push(lte(trades.createdAt, data.to));

    if (conditions.length === 0)
        return 0;

    const totalTradeAmount = await getDB(tx)
        .select({ totalAmount: sql<number>`CASE WHEN type = 'buy' THEN sum(net_amount) ELSE -sum(net_amount) END` })
        .from(trades)
        .where(and(...conditions));

    return totalTradeAmount && totalTradeAmount.length > 0 ? totalTradeAmount[0].totalAmount : 0;
}
