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
    const db = getDB(tx);

    const [client] = await db.delete(clients).where(eq(clients.id, id)).returning();

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

export async function findAllWithPagination(data: {
    page: number;
    limit: number;
    search?: string;
    id?: number;
    from?: Date;
    to?: Date;
}, tx?: TransactionType) {
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

    // Filter by creation date if provided
    if (data.from) {
        conditions.push(gte(clients.createdAt, data.from));
    }

    if (data.to) {
        // Set end of day for the "to" date
        const endDate = new Date(data.to);
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(clients.createdAt, endDate));
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

/**
 * Get all clients (optimized for brokerage calculation)
 * @returns All clients in the database
 */
export async function getAllClients(tx?: TransactionType) {
    return getDB(tx).query.clients.findMany();
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

        // console.log("Calculating financial totals for date range:", { from, to, endOfDayTo });

        // Total client count
        const clientCountQuery = db
            .select({ count: sql<number>`COUNT(${clients.id})` })
            .from(clients);

        if (from)
            clientCountQuery.where(gte(clients.createdAt, from));
        if (to)
            clientCountQuery.where(lte(clients.createdAt, endOfDayTo!));

        const baseConditions = [
            eq(trades.type, TradeType.BUY),
            eq(trades.isFullySold, 0),
        ];

        if (from && to) {
            baseConditions.push(
                gte(trades.tradeDate, new Date(from).getTime()),
                lte(trades.tradeDate, endOfDayTo!.getTime()),
            );
        }

        const portfolioValueQuery = db
            .select({
                totalValue: sql<number>`COALESCE(SUM(
      CASE 
        WHEN ${trades.type} = 'BUY' AND ${trades.isFullySold} = 0 
        THEN ${trades.remainingQuantity} * ${trades.price}
        ELSE 0
      END
    ), 0)`,
            })
            .from(trades)
            .where(and(...baseConditions));

        // Brokerage
        const brokerageQuery = db
            .select({
                totalBrokerage: sql<number>`COALESCE(SUM(${brokerages.brokerageAmount}), 0)`,
            })
            .from(brokerages);

        if (from) {
            const fromMonth = from.getMonth() + 1;
            if (fromMonth !== null) {
                brokerageQuery.where(gte(brokerages.month, fromMonth));
            }
        }
        if (to) {
            const toMonth = to.getMonth() + 1;
            if (toMonth !== null) {
                brokerageQuery.where(lte(brokerages.month, toMonth));
            }
        }

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

        // Get total BUY trades value up to the end date (not limited by start date)
        // For accurate purse amount calculation, we need ALL buy trades up to the end date
        const buyTradesQuery = db
            .select({
                totalBuyTrades: sql<number>`COALESCE(SUM(${trades.netAmount}), 0)`,
            })
            .from(trades)
            .where(eq(trades.type, TradeType.BUY));

        // Only apply the end date filter
        // We don't filter by from date because we need all BUY transactions up to the end date
        if (to)
            buyTradesQuery.where(lte(trades.tradeDate, endOfDayTo!.getTime()));

        // Get total SELL trades value up to the end date (not limited by start date)
        // For accurate purse amount calculation, we need ALL sell trades up to the end date
        const sellTradesQuery = db
            .select({
                totalSellTrades: sql<number>`COALESCE(SUM(${trades.netAmount}), 0)`,
            })
            .from(trades)
            .where(eq(trades.type, TradeType.SELL));

        // Only apply the end date filter
        // We don't filter by from date because we need all SELL transactions up to the end date
        if (to)
            sellTradesQuery.where(lte(trades.tradeDate, endOfDayTo!.getTime()));

        // Get total purse amount (initial value from all clients)
        // We don't filter the purse amount by date because it represents the initial amount
        // The remaining amount will be calculated by adjusting this with buy/sell trades
        const purseAmountQuery = db
            .select({
                totalPurseAmount: sql<number>`COALESCE(SUM(${clients.purseAmount}), 0)`,
            })
            .from(clients);

        const [clientCount, portfolioResult, brokerageResult, paymentsResult, buyTradesResult, sellTradesResult, purseAmountResult]
            = await Promise.all([
                clientCountQuery.execute(),
                portfolioValueQuery.execute(),
                brokerageQuery.execute(),
                paymentsQuery.execute(),
                buyTradesQuery.execute(),
                sellTradesQuery.execute(),
                purseAmountQuery.execute(),
            ]);

        const result = {
            totalClient: Number(clientCount[0]?.count || 0),
            totalPortfolioValue: Number(portfolioResult[0]?.totalValue || 0),
            totalBrokerage: Number(brokerageResult[0]?.totalBrokerage || 0),
            totalPayments: Number(paymentsResult[0]?.totalPayments || 0),
            totalBuyTrades: Number(buyTradesResult[0]?.totalBuyTrades || 0),
            totalSellTrades: Number(sellTradesResult[0]?.totalSellTrades || 0),
            totalPurseAmount: Number(purseAmountResult[0]?.totalPurseAmount || 0),
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
            totalBuyTrades: 0,
            totalSellTrades: 0,
            totalPurseAmount: 0,
        };
    }
}
