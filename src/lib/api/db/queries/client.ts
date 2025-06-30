import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";

import type { TransactionType } from "../index";
import type { NewClient } from "../schema";

import { getDB } from "../index";
import { brokerages, clients, payments, trades, TradeType } from "../schema";

export async function create(data: NewClient, tx?: TransactionType) {
    const [client] = await getDB(tx).insert(clients).values(data).returning();
    return client ?? null;
}

export async function update(data: Partial<NewClient> & { id: number }, tx?: TransactionType) {
    const [client] = await getDB(tx).update(clients).set(data).where(eq(clients.id, data.id)).returning();

    return client ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [client] = await getDB(tx).delete(clients).where(eq(clients.id, id)).returning();

    return client ?? null;
}

export async function findOne_And(data: { id?: number; email?: string; pan?: string; mobile?: string }, tx?: TransactionType) {
    const conditions = [];
    if (data.id)
        conditions.push(eq(clients.id, data.id));
    if (data.email)
        conditions.push(eq(clients.email, data.email));
    if (data.pan)
        conditions.push(eq(clients.pan, data.pan ? data.pan.toUpperCase() : data.pan));
    if (data.mobile)
        conditions.push(eq(clients.mobile, data.mobile));

    if (conditions.length === 0)
        return null;

    return getDB(tx).query.clients.findFirst({
        where: and(...conditions),
    });
}

export async function findOne_Or(data: { id?: number; email?: string; pan?: string; mobile?: string }, tx?: TransactionType) {
    const conditions = [];
    if (data.id)
        conditions.push(eq(clients.id, data.id));
    if (data.email)
        conditions.push(eq(clients.email, data.email));
    if (data.pan)
        conditions.push(eq(clients.pan, data.pan ? data.pan.toUpperCase() : data.pan));
    if (data.mobile)
        conditions.push(eq(clients.mobile, data.mobile));

    if (conditions.length === 0)
        return null;

    return getDB(tx).query.clients.findFirst({
        where: or(...conditions),
    });
}

export async function findAllWithPagination(data: { page: number; limit: number; search?: string; id?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.id)
        conditions.push(eq(clients.id, data.id));
    if (data.search) {
        const searchTerm = `%${data.search}%`;
        conditions.push(or(
            sql`${clients.name} LIKE ${searchTerm}`,
            sql`${clients.email} LIKE ${searchTerm}`,
            sql`${clients.pan} LIKE ${searchTerm}`,
            sql`${clients.mobile} LIKE ${searchTerm}`,
        ));
    }

    const clientsData = await getDB(tx).query.clients.findMany({
        where: and(...conditions),
        orderBy: [desc(clients.createdAt)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const clientCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(clients)
        .where(and(...conditions));

    return {
        clients: clientsData,
        count: clientCount && clientCount.length > 0 ? clientCount[0].count : 0,
    };
}

export async function calculateTotalClient(data: { from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.from)
        conditions.push(gte(clients.createdAt, new Date(data.from)));
    if (data.to)
        conditions.push(lte(clients.createdAt, new Date(data.to)));

    const totalClient = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(clients)
        .where(and(...conditions));

    return totalClient && totalClient.length > 0 ? totalClient[0].count : 0;
}

// Get all clients id and name
export async function getAllClientsIdAndName(tx?: TransactionType) {
    const clientsData = await getDB(tx)
        .select({ id: clients.id, name: clients.name })
        .from(clients);

    return clientsData;
}

export async function calculateFinancialTotalsByDateRange(
    data: { from?: Date; to?: Date },
    tx?: TransactionType,
) {
    const db = getDB(tx);
    const { from, to } = data;

    try {
        const endOfDayTo = to
            ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)
            : null;

        // Total client count
        const clientCountQuery = db
            .select({ count: sql<number>`COUNT(${clients.id})` })
            .from(clients);

        if (from)
            clientCountQuery.where(gte(clients.createdAt, from));
        if (to)
            clientCountQuery.where(lte(clients.createdAt, endOfDayTo!));

        // Portfolio Value
        const portfolioValueQuery = db
            .select({
                totalValue: sql<number>`COALESCE(
          SUM(
            CASE 
              WHEN ${trades.type} = 'BUY' AND ${trades.isFullySold} = 0 
              THEN ${trades.remainingQuantity} * ${trades.price}
              ELSE 0 
            END
          ), 0)`,
            })
            .from(trades)
            .where(
                and(eq(trades.type, TradeType.BUY), eq(trades.isFullySold, 0)),
            );

        if (from)
            portfolioValueQuery.where(gte(trades.createdAt, from));
        if (to)
            portfolioValueQuery.where(lte(trades.createdAt, endOfDayTo!));

        // Brokerage
        const brokerageQuery = db
            .select({
                totalBrokerage: sql<number>`COALESCE(SUM(${brokerages.brokerageAmount}), 0)`,
            })
            .from(brokerages);

        // if (from) brokerageQuery.where(gte(brokerages.calculatedAt, new Date(from)));
        // if (to) brokerageQuery.where(lte(brokerages.calculatedAt, endOfDayTo!));

        // Payment
        const paymentsQuery = db
            .select({
                totalPayments: sql<number>`COALESCE(SUM(${payments.amount}), 0)`,
            })
            .from(payments);

        if (from)
            paymentsQuery.where(gte(payments.paymentDate, from));
        if (to)
            paymentsQuery.where(lte(payments.paymentDate, endOfDayTo!));

        const [clientCount, portfolioResult, brokerageResult, paymentsResult]
      = await Promise.all([
          clientCountQuery.execute(),
          portfolioValueQuery.execute(),
          brokerageQuery.execute(),
          paymentsQuery.execute(),
      ]);

        const result = {
            totalClient: Number(clientCount[0]?.count || 0),
            totalPortfolioValue: Number(portfolioResult[0]?.totalValue || 0),
            totalBrokerage: Number(brokerageResult[0]?.totalBrokerage || 0),
            totalPayments: Number(paymentsResult[0]?.totalPayments || 0),
        };

        // console.log("Financial totals calculated:", result);
        return result;
    } catch (error) {
        console.error("Error calculating financial totals:", error);

        return {
            totalClient: 0,
            totalPortfolioValue: 0,
            totalBrokerage: 0,
            totalPayments: 0,
        };
    }
}
