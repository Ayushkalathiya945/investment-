import { eq } from "drizzle-orm";

import type { TransactionType } from "../index";
import type { NewAmountUsage } from "../schema";

import { getDB } from "../index";
import { amountUsage } from "../schema";

export async function create(data: NewAmountUsage, tx?: TransactionType) {
    const db = tx ?? getDB();
    return (await db.insert(amountUsage).values(data).returning())[0];
}

export async function findByBuyTrade(buyTradeId: number, tx?: TransactionType) {
    const db = tx ?? getDB();
    return await db.query.amountUsage.findMany({
        where: eq(amountUsage.buyTradeId, buyTradeId),
    });
}

export async function deleteByBuyTrade(buyTradeId: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return await db_.delete(amountUsage).where(eq(amountUsage.buyTradeId, buyTradeId));
}

export async function findByUnusedAmount(unusedAmountId: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return await db_.query.amountUsage.findMany({
        where: eq(amountUsage.unusedAmountId, unusedAmountId),
    });
}

export async function deleteById(id: number, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return await db_.delete(amountUsage).where(eq(amountUsage.id, id));
}

export async function updateById(id: number, data: Partial<NewAmountUsage>, tx?: TransactionType) {
    const db_ = tx ?? getDB();
    return (await db_.update(amountUsage).set(data).where(eq(amountUsage.id, id)).returning())[0];
}
