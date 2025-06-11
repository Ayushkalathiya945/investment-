import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { TransactionType } from "@/api/db";
import type { NewStock } from "@/api/db/schema";

import { getDB } from "@/api/db";
import { stocks } from "@/api/db/schema";

export async function create(data: NewStock, tx?: TransactionType) {
    const [trade] = await getDB(tx).insert(stocks).values(data).returning();

    return trade ?? null;
}

export async function update(data: Partial<NewStock>, tx?: TransactionType) {
    const [trade] = await getDB(tx).update(stocks).set(data).returning();

    return trade ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [trade] = await getDB(tx).delete(stocks).where(eq(stocks.id, id)).returning();

    return trade ?? null;
}

export async function findOne(data: { id: number }, tx?: TransactionType) {
    return getDB(tx).query.stocks.findFirst({
        where: eq(stocks.id, data.id),
    });
}

export async function findAllWithPagination(data: { page: number; limit: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.from)
        conditions.push(gte(stocks.createdAt, data.from));
    if (data.to)
        conditions.push(lte(stocks.createdAt, data.to));

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
