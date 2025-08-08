import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { TransactionType } from "../index";
import type { NewPayment } from "../schema";

import { getDB } from "../index";
import { payments } from "../schema";

export async function create(data: NewPayment, tx?: TransactionType) {
    const [payment] = await getDB(tx).insert(payments).values(data).returning();

    return payment ?? null;
}

export async function update(data: Partial<NewPayment> & { id: number }, tx?: TransactionType) {
    const { id, ...updateFields } = data;

    const [payment] = await getDB(tx)
        .update(payments)
        .set(updateFields)
        .where(eq(payments.id, id))
        .returning();

    return payment ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [payment] = await getDB(tx).delete(payments).where(eq(payments.id, id)).returning();

    return payment ?? null;
}

export async function findOne(data: { id: number }, tx?: TransactionType) {
    return getDB(tx).query.payments.findFirst({
        where: eq(payments.id, data.id),
    });
}

export async function findAllWithPagination(data: { page: number; limit: number; clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.clientId)
        conditions.push(eq(payments.clientId, data.clientId));
    if (data.from)
        conditions.push(gte(payments.paymentDate, new Date(data.from)));
    if (data.to)
        conditions.push(lte(payments.paymentDate, new Date (data.to)));

    const paymentsData = await getDB(tx).query.payments.findMany({
        where: and(...conditions),
        orderBy: [desc(payments.paymentDate)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const paymentsCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .where(and(...conditions));

    return { payments: paymentsData, count: paymentsCount && paymentsCount.length > 0 ? paymentsCount[0].count : 0 };
}

export async function calculateTotalPaymentAmount(
    data: { clientId?: number; from?: number; to?: number },
    tx?: TransactionType,
) {
    const conditions = [];

    if (data.clientId) {
        conditions.push(eq(payments.clientId, data.clientId));
    }

    if (data.from) {
        conditions.push(gte(payments.paymentDate, new Date(data.from)));
    }

    if (data.to) {
        const endOfDayTimestamp = data.to + 86399;
        conditions.push(lte(payments.paymentDate, new Date(endOfDayTimestamp)));
    }

    try {
        const query = getDB(tx)
            .select({ totalAmount: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
            .from(payments);

        if (conditions.length > 0) {
            query.where(and(...conditions));
        }

        const totalPaymentAmount = await query;

        const result = Number(totalPaymentAmount[0]?.totalAmount || 0);

        return result;
    } catch (error) {
        console.error("[ERROR] Failed to calculate total payment amount:", error);
        return 0;
    }
}
