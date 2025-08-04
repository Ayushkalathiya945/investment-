import { and, desc, eq, gt, gte, lte, sql } from "drizzle-orm";

import type { TransactionType } from "../";
import type { NewTrade } from "../schema";

import { getDB } from "../index";
import { trades, TradeType } from "../schema";

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

export async function findAllWithPagination(data: { page: number; limit: number; type?: TradeType; symbol?: string; clientId?: number; From?: number; To?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.type)
        conditions.push(eq(trades.type, data.type));
    if (data.symbol)
        conditions.push(eq(trades.symbol, data.symbol));
    if (data.clientId)
        conditions.push(eq(trades.clientId, data.clientId));
    if (data.From)
        conditions.push(gte(trades.tradeDate, new Date(data.From)));
    if (data.To)
        conditions.push(lte(trades.tradeDate, new Date(data.To)));

    const tradesData = await getDB(tx).query.trades.findMany({
        where: and(...conditions),
        orderBy: [desc(trades.createdAt)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
        with: {
            client: {
                columns: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    const tradesWithClientName = tradesData.map((trade: any) => ({
        ...trade,
        clientName: trade.client?.name || "Unknown Client",
        client: undefined,
    }));

    const tradeCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(trades)
        .where(and(...conditions));

    return { trades: tradesWithClientName, count: tradeCount && tradeCount.length > 0 ? tradeCount[0].count : 0 };
}

export async function calculateTotalTradeAmount(data: { clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];

    if (data.clientId)
        conditions.push(eq(trades.clientId, data.clientId));
    if (data.from)
        conditions.push(gte(trades.tradeDate, new Date(data.from)));
    if (data.to)
        conditions.push(lte(trades.tradeDate, new Date(data.to)));

    if (conditions.length === 0)
        return 0;

    const totalTradeAmount = await getDB(tx)
        .select({ totalAmount: sql<number>`CASE WHEN type = 'BUY' THEN sum(net_amount) ELSE -sum(net_amount) END` })
        .from(trades)
        .where(and(...conditions));

    return totalTradeAmount && totalTradeAmount.length > 0 ? totalTradeAmount[0].totalAmount : 0;
}

export async function calculateTotalSoldAmount(data: { clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];

    if (data.clientId)
        conditions.push(eq(trades.clientId, data.clientId));

    conditions.push(eq(trades.type, TradeType.SELL));

    if (data.from)
        conditions.push(gte(trades.tradeDate, new Date(data.from)));
    if (data.to)
        conditions.push(lte(trades.tradeDate, new Date(data.to)));

    if (conditions.length === 0)
        return 0;

    const totalSoldAmount = await getDB(tx)
        .select({ totalAmount: sql<number>`COALESCE(SUM(${trades.netAmount}), 0)` })
        .from(trades)
        .where(and(...conditions));

    return totalSoldAmount && totalSoldAmount.length > 0 ? totalSoldAmount[0].totalAmount : 0;
}

export async function findBuyTradesWithRemainingQuantity(data: {
    clientId: number;
    symbol: string;
    exchange: "NSE" | "BSE";
    tradeDate: number;
}, tx?: TransactionType) {
    return getDB(tx).query.trades.findMany({
        where: and(
            eq(trades.clientId, data.clientId),
            eq(trades.symbol, data.symbol),
            eq(trades.exchange, data.exchange),
            eq(trades.type, TradeType.BUY),
            gt(trades.remainingQuantity, 0),
            lte(trades.tradeDate, new Date(data.tradeDate)),
        ),
        orderBy: [trades.tradeDate, trades.id],
    });
}

export async function getActiveBuyTrades(clientId: number, tx?: TransactionType) {
    return getDB(tx).query.trades.findMany({
        where: and(
            eq(trades.clientId, clientId),
            eq(trades.type, TradeType.BUY),
            gt(trades.remainingQuantity, 0),
        ),
    });
}

export async function getTradesByDateRange(
    clientId: number,
    startDate: number,
    endDate: number,
    tx?: TransactionType,
) {
    return getDB(tx).query.trades.findMany({
        where: and(
            eq(trades.clientId, clientId),
            gte(trades.tradeDate, new Date(startDate)),
            lte(trades.tradeDate, new Date(endDate)),
        ),
    });
}

export async function getTradeById(tradeId: number, tx?: TransactionType) {
    return getDB(tx).query.trades.findFirst({
        where: eq(trades.id, tradeId),
    });
}

export async function currentHoldingAmount(clientId: number, tx?: TransactionType) {
    const db = getDB(tx);

    const currentHoldingAmount = await db
        .select({
            currentHoldingAmount: sql<number>`COALESCE(SUM(
                CASE 
                  WHEN ${trades.type} = 'BUY' THEN ${trades.remainingQuantity} * ${trades.price}
                  ELSE 0
                END
              ), 0)`,
        })
        .from(trades)
        .where(eq(trades.clientId, clientId));

    return currentHoldingAmount[0]?.currentHoldingAmount || 0;
}
