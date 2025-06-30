import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { TransactionType } from "../index";
import type { NewStock } from "../schema";

import { getDB } from "../index";
import { stocks } from "../schema";

export async function create(data: NewStock, tx?: TransactionType) {
    const [trade] = await getDB(tx).insert(stocks).values(data).returning();

    return trade ?? null;
}

export async function update(data: Partial<NewStock> & { id: number }, tx?: TransactionType) {
    const [trade] = await getDB(tx).update(stocks).set(data).where(eq(stocks.id, data.id)).returning();

    return trade ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [trade] = await getDB(tx).delete(stocks).where(eq(stocks.id, id)).returning();

    return trade ?? null;
}

export async function findOne(data: { symbol: string }, tx?: TransactionType) {
    return getDB(tx).query.stocks.findFirst({
        where: eq(stocks.symbol, data.symbol),
    });
}

export async function findAllWithPagination(data: { page: number; limit: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.from) {
        const fromDate = new Date(data.from);
        conditions.push(gte(stocks.createdAt, fromDate));
    }
    if (data.to) {
        const toDate = new Date(data.to);
        conditions.push(lte(stocks.createdAt, toDate));
    }

    if (conditions.length === 0)
        return { stocks: [], count: 0 };

    const stocksData = await getDB(tx).query.stocks.findMany({
        where: and(...conditions),
        orderBy: [desc(stocks.createdAt)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const tradeCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(stocks)
        .where(and(...conditions));

    return { stocks: stocksData, count: tradeCount && tradeCount.length > 0 ? tradeCount[0].count : 0 };
}

// get all stocks symbols
export async function getAllSymbols(tx?: TransactionType) {
    const nse = await getDB(tx)
        .select({ symbol: stocks.symbol })
        .from(stocks)
        .where(eq(stocks.exchange, "NSE"));

    const bse = await getDB(tx)
        .select({ symbol: stocks.symbol })
        .from(stocks)
        .where(eq(stocks.exchange, "BSE"));

    // Flatten and extract symbols only
    const symbols = {
        nse: nse.map((stock: { symbol: string }) => stock.symbol),
        bse: bse.map((stock: { symbol: string }) => stock.symbol),
    };

    return symbols;
}
