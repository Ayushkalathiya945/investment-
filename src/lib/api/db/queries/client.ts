import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";

import type { TransactionType } from "../index";
import type { NewClient } from "../schema";

import { getDB } from "../index";
import { clients, dailyBrokerage, holdings, payments, stocks, trades, TradeType } from "../schema";

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

export async function getAllClientsIdAndName(tx?: TransactionType) {
    const clientsData = await getDB(tx)
        .select({ id: clients.id, name: clients.name })
        .from(clients);

    return clientsData;
}

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

        // Total client count
        const clientCountQuery = db
            .select({ count: sql<number>`COUNT(${clients.id})` })
            .from(clients);

        if (from)
            clientCountQuery.where(gte(clients.createdAt, from));
        if (to)
            clientCountQuery.where(lte(clients.createdAt, endOfDayTo!));

        //  Portfolio value take price from stock table
        const portfolioValueQuery = await db
            .select({
                totalPortfolioValue: sql<number>`COALESCE(SUM(${holdings.holding} * ${stocks.currentPrice}), 0)`,
            })
            .from(holdings)
            .innerJoin(
                stocks,
                and(
                    eq(holdings.symbol, stocks.symbol),
                    eq(holdings.exchange, stocks.exchange),
                ),
            );

        const totalProfit = await db
            .select({
                totalProfit: sql<number>`COALESCE(SUM(${trades.profit}), 0)`,
            })
            .from(trades)
            .where(eq(trades.type, TradeType.SELL));

        const fees = db.select({
            totalFees: sql<number>`COALESCE(SUM(${dailyBrokerage.totalDailyBrokerage}), 0)`,
        }).from(dailyBrokerage);

        if (from)
            fees.where(gte(dailyBrokerage.date, from));
        if (to)
            fees.where(lte(dailyBrokerage.date, endOfDayTo!));

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

        const buyTradesQuery = db
            .select({
                totalBuyTrades: sql<number>`COALESCE(SUM(${trades.netAmount}), 0)`,
            })
            .from(trades)
            .where(eq(trades.type, TradeType.BUY));

        const sellTradesQuery = db
            .select({
                totalSellTrades: sql<number>`COALESCE(SUM(${trades.netAmount}), 0)`,
            })
            .from(trades)
            .where(eq(trades.type, TradeType.SELL));

        const purseAmountQuery = db
            .select({
                totalPurseAmount: sql<number>`COALESCE(SUM(${clients.purseAmount}), 0)`,
            })
            .from(clients);

        const [clientCount, paymentsResult, buyTradesResult, sellTradesResult, purseAmountResult, feesResult]
            = await Promise.all([
                clientCountQuery.execute(),
                paymentsQuery.execute(),
                buyTradesQuery.execute(),
                sellTradesQuery.execute(),
                purseAmountQuery.execute(),
                fees.execute(),
            ]);

        const result = {
            totalClient: Number(clientCount[0]?.count || 0),
            totalPortfolioValue: Number(portfolioValueQuery[0]?.totalPortfolioValue || 0),
            totalProfit: Number(totalProfit[0]?.totalProfit || 0),
            totalPayments: Number(paymentsResult[0]?.totalPayments || 0),
            totalBuyTrades: Number(buyTradesResult[0]?.totalBuyTrades || 0),
            totalSellTrades: Number(sellTradesResult[0]?.totalSellTrades || 0),
            totalPurseAmount: Number(purseAmountResult[0]?.totalPurseAmount || 0),
            totalFees: Number(feesResult[0]?.totalFees || 0),
        };

        return result;
    } catch (error) {
        console.error("Error calculating financial totals:", error);

        return {
            totalClient: 0,
            totalPortfolioValue: 0,
            totalProfit: 0,
            totalFees: 0,
            totalPayments: 0,
            totalBuyTrades: 0,
            totalSellTrades: 0,
            totalPurseAmount: 0,
        };
    }
}

export async function updateCurrentHoldingAmount(clientId: number, amount: number, tx?: TransactionType) {
    const db = getDB(tx);

    await db
        .update(clients)
        .set({
            usedAmount: sql<number>`used_amount + ${amount}`,
        })
        .where(eq(clients.id, clientId))
        .returning();
}

// calculte current holding amount from tread table
export async function getAndUpdateCurrentTotalHoldingAmount(clientId: number, tx?: TransactionType) {
    const db = getDB(tx);

    const currentHoldingAmount = await db
        .select({
            currentHoldingAmount: sql<number>`
      COALESCE(SUM(
        CASE 
          WHEN ${trades.type} = 'SELL' THEN ${trades.netAmount}
          WHEN ${trades.type} = 'BUY' THEN -${trades.netAmount}
          ELSE 0
        END
      ), 0)
    `,
        })
        .from(trades)
        .where(eq(trades.clientId, clientId));

    const amount = currentHoldingAmount[0]?.currentHoldingAmount || 0;

    await db.update(clients)
        .set({
            usedAmount: amount,
        })
        .where(eq(clients.id, clientId));
}
