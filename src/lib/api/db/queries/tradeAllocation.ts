import { eq } from "drizzle-orm";

import type { TransactionType } from "..";
import type { NewTradeAllocation } from "../schema";

import { getDB } from "../";
import { tradeAllocations } from "../schema";

export const tradeAllocationQueries = {
    async create(
        data: NewTradeAllocation,
        tx?: TransactionType,
    ) {
        const db = getDB(tx);
        const [newAllocation] = await db
            .insert(tradeAllocations)
            .values({
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            .returning();
        return newAllocation;
    },

    async findByBuyTradeId(buyTradeId: number, tx?: TransactionType) {
        const db = getDB(tx);
        return await db
            .select()
            .from(tradeAllocations)
            .where(eq(tradeAllocations.buyTradeId, buyTradeId));
    },

    async findBySellTradeId(sellTradeId: number, tx?: TransactionType) {
        const db = getDB(tx);
        return await db
            .select()
            .from(tradeAllocations)
            .where(eq(tradeAllocations.sellTradeId, sellTradeId));
    },

    async deleteByBuyTradeId(buyTradeId: number, tx?: TransactionType) {
        const db = getDB(tx);
        await db
            .delete(tradeAllocations)
            .where(eq(tradeAllocations.buyTradeId, buyTradeId));
    },

    async deleteBySellTradeId(sellTradeId: number, tx?: TransactionType) {
        const db = getDB(tx);
        await db
            .delete(tradeAllocations)
            .where(eq(tradeAllocations.sellTradeId, sellTradeId));
    },
};
