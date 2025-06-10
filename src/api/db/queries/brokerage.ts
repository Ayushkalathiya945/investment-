import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { TransactionType } from "@/api/db";
import type { NewBrokerage } from "@/api/db/schema";

import { getDB } from "@/api/db";
import { brokerages } from "@/api/db/schema";

export async function create(data: NewBrokerage, tx?: TransactionType) {
    const [brokerage] = await getDB(tx).insert(brokerages).values(data).returning();

    return brokerage ?? null;
}

export async function update(data: Partial<NewBrokerage>, tx?: TransactionType) {
    const [brokerage] = await getDB(tx).update(brokerages).set(data).returning();

    return brokerage ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [brokerage] = await getDB(tx).delete(brokerages).where(eq(brokerages.id, id)).returning();

    return brokerage ?? null;
}

export async function findOne(data: { id: number }, tx?: TransactionType) {
    return getDB(tx).query.brokerages.findFirst({
        where: eq(brokerages.id, data.id),
    });
}

export async function findAllWithPagination(data: { page: number; limit: number; clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.clientId)
        conditions.push(eq(brokerages.clientId, data.clientId));
    if (data.from)
        conditions.push(gte(brokerages.createdAt, data.from));
    if (data.to)
        conditions.push(lte(brokerages.createdAt, data.to));

    if (conditions.length === 0)
        return { brokerage: [], count: 0 };

    const brokerageData = await getDB(tx).query.brokerages.findMany({
        where: and(...conditions),
        orderBy: [desc(brokerages.createdAt)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const brokerageCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(brokerages)
        .where(and(...conditions));

    return { brokerage: brokerageData, count: brokerageCount && brokerageCount.length > 0 ? brokerageCount[0].count : 0 };
}

// help me to create a query to calculate the total brokerage amount of particular client
// do the calculation in database
export async function calculateTotalbrokerageAmount(data: { clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];

    if (data.clientId)
        conditions.push(eq(brokerages.clientId, data.clientId));
    if (data.from)
        conditions.push(gte(brokerages.createdAt, data.from));
    if (data.to)
        conditions.push(lte(brokerages.createdAt, data.to));

    if (conditions.length === 0)
        return 0;

    const totalbrokerageAmount = await getDB(tx)
        .select({ totalAmount: sql<number>`sum(brokerage_amount)` })
        .from(brokerages)
        .where(and(...conditions));

    return totalbrokerageAmount && totalbrokerageAmount.length > 0 ? totalbrokerageAmount[0].totalAmount : 0;
}
