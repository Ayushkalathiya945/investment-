import { and, asc, eq, gt, isNull, sum } from "drizzle-orm";

import type { TransactionType } from "..";
import type { NewUnusedAmount } from "../schema";

import { db, getDB } from "..";
import { unusedAmounts } from "../schema";

export async function getTotalUnusedAmount(clientId: number): Promise<number> {
    const result = await db
        .select({
            total: sum(unusedAmounts.remainingAmount),
        })
        .from(unusedAmounts)
        .where(and(eq(unusedAmounts.clientId, clientId), isNull(unusedAmounts.endDate)));

    return Number(result[0]?.total || 0);
}

export async function create(data: NewUnusedAmount, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return (await db_.insert(unusedAmounts).values(data).returning())[0];
}

export async function getActive(clientId: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return await db_.query.unusedAmounts.findMany({
        where: and(eq(unusedAmounts.clientId, clientId), gt(unusedAmounts.remainingAmount, 0)),
        orderBy: asc(unusedAmounts.startDate),
    });
}

export async function updateById(id: number, data: Partial<NewUnusedAmount>, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return (await db_.update(unusedAmounts).set(data).where(eq(unusedAmounts.id, id)).returning())[0];
}

export async function findBySourceTrade(sourceTradeId: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return await db_.query.unusedAmounts.findFirst({
        where: eq(unusedAmounts.sourceTradeId, sourceTradeId),
    });
}

export async function findById(id: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return await db_.query.unusedAmounts.findFirst({
        where: eq(unusedAmounts.id, id),
    });
}

export async function deleteBySourceTrade(sourceTradeId: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return await db_.delete(unusedAmounts).where(eq(unusedAmounts.sourceTradeId, sourceTradeId));
}

export async function restoreAmount(unusedAmountId: number, amountToRestore: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    const unused = await db_.query.unusedAmounts.findFirst({ where: eq(unusedAmounts.id, unusedAmountId) });
    if (!unused)
        return;

    const newRemainingAmount = unused.remainingAmount + amountToRestore;
    await db_.update(unusedAmounts)
        .set({ remainingAmount: newRemainingAmount, endDate: null })
        .where(eq(unusedAmounts.id, unusedAmountId));
}
