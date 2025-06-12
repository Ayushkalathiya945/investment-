import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { TransactionType } from "@/api/db";
import type { NewPayment } from "@/api/db/schema";

import { getDB } from "@/api/db";
import { payments } from "@/api/db/schema";

export async function create(data: NewPayment, tx?: TransactionType) {
    const [payment] = await getDB(tx).insert(payments).values(data).returning();

    return payment ?? null;
}

export async function update(data: Partial<NewPayment> & { id: number }, tx?: TransactionType) {
    const [payment] = await getDB(tx).update(payments).set(data).where(eq(payments.id, data.id)).returning();

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
        conditions.push(gte(payments.createdAt, data.from));
    if (data.to)
        conditions.push(lte(payments.createdAt, data.to));

    const paymentsData = await getDB(tx).query.payments.findMany({
        where: and(...conditions),
        orderBy: [desc(payments.createdAt)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const paymentsCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(payments)
        .where(and(...conditions));

    return { payments: paymentsData, count: paymentsCount && paymentsCount.length > 0 ? paymentsCount[0].count : 0 };
}

// help me to create a query to calculate the total payment amount of particular client
// do the calculation in database
export async function calculateTotalPaymentAmount(data: { clientId?: number; from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];

    if (data.clientId)
        conditions.push(eq(payments.clientId, data.clientId));
    if (data.from)
        conditions.push(gte(payments.createdAt, data.from));
    if (data.to)
        conditions.push(lte(payments.createdAt, data.to));

    if (conditions.length === 0)
        return 0;

    const totalPaymentAmount = await getDB(tx)
        .select({ totalAmount: sql<number>`sum(amount)` })
        .from(payments)
        .where(and(...conditions));

    return totalPaymentAmount && totalPaymentAmount.length > 0 ? totalPaymentAmount[0].totalAmount : 0;
}
