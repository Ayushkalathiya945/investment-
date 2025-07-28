import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import type { DailyBrokerage } from "@/types/brokerage";

import type { TransactionType } from "../index";

import { getDB } from "../index";
import { clients, dailyBrokerage } from "../schema";

// Daily Brokerage Functions
export async function createDailyBrokerage(data: Partial<DailyBrokerage>, tx?: TransactionType) {
    const [daily] = await getDB(tx).insert(dailyBrokerage).values(data).returning();
    return daily ?? null;
}

export async function findDailyBrokerages(clientId: number, fromDate: Date, toDate: Date, tx?: TransactionType) {
    return getDB(tx).query.dailyBrokerage.findMany({
        where: and(
            eq(dailyBrokerage.clientId, clientId),
            gte(dailyBrokerage.date, fromDate),
            lte(dailyBrokerage.date, toDate),
        ),
        orderBy: [desc(dailyBrokerage.date)],
    });
}

// Daily Brokerage Pagination
type DailyBrokerageSummary = {
    id: number;
    clientId: number;
    clientName: string;
    date: Date;
    totalDailyBrokerage: number;
};

export async function findAllDailyBrokerages(data: {
    page: number;
    limit: number;
    clientId?: string;
    from?: Date;
    to?: Date;
}, tx?: TransactionType): Promise<{
        data: DailyBrokerageSummary[];
        pagination: {
            page: number;
            limit: number;
            total: number;
        };
    }> {
    const conditions = [];

    if (data.clientId) {
        conditions.push(eq(dailyBrokerage.clientId, Number(data.clientId)));
    }

    // Only apply date range filters if explicitly provided
    if (data.from) {
        conditions.push(gte(dailyBrokerage.date, data.from));
    }
    if (data.to) {
        conditions.push(lte(dailyBrokerage.date, data.to));
    }

    // Get daily brokerage data with only necessary fields
    const result = await getDB(tx).select({
        id: dailyBrokerage.id,
        clientId: dailyBrokerage.clientId,
        clientName: clients.name,
        date: dailyBrokerage.date,
        totalDailyBrokerage: dailyBrokerage.totalDailyBrokerage,
    }).from(dailyBrokerage).leftJoin(clients, eq(dailyBrokerage.clientId, clients.id)).where(and(...conditions)).orderBy(desc(dailyBrokerage.date)).limit(data.limit).offset((data.page - 1) * data.limit);

    const [{ count }] = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(dailyBrokerage)
        .where(and(...conditions));

    return {
        data: result.map((row: { id: number; clientId: number; clientName?: string; date: Date; totalDailyBrokerage: number | string }) => ({
            id: row.id,
            clientId: row.clientId,
            clientName: row.clientName || "Unknown",
            date: row.date,
            totalDailyBrokerage: Number.parseFloat((Number(row.totalDailyBrokerage) || 0).toFixed(2)),
        })),
        pagination: {
            page: data.page,
            limit: data.limit,
            total: Number(count) || 0,
        },
    };
}

type MonthlyBrokerageSummary = {
    clientId: number;
    clientName: string;
    period: {
        month: number;
        year: number;
    };
    brokerageAmount: number; // This is now an alias for totalDailyBrokerage for backward compatibility
};

export async function getMonthlyBrokerageSummary(
    { from, to, clientId }: { from: Date; to: Date; clientId?: string },
    tx?: TransactionType,
): Promise<MonthlyBrokerageSummary[]> {
    // Input validation
    if (!(from instanceof Date) || !(to instanceof Date) || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new TypeError("Invalid date range provided");
    }
    if (from > to) {
        throw new Error("Start date cannot be after end date");
    }

    const db = getDB(tx);

    try {
        // Get all clients for name lookup (only if we're not filtering by clientId)
        let clientsMap: Record<number, string> = {};
        if (!clientId) {
            const clients = await db.query.clients.findMany({
                columns: { id: true, name: true },
            });
            clientsMap = Object.fromEntries(clients.map((c: { id: number; name: string }) => [c.id, c.name]));
        } else {
            // If filtering by clientId, just get that client's name
            const client = await db.query.clients.findFirst({
                where: (clients: { id: any }, { eq }: { eq: (column: any, value: any) => any }) => eq(clients.id, clientId),
                columns: { id: true, name: true },
            });
            if (client) {
                clientsMap[client.id] = client.name;
            }
        }

        // Convert dates to timestamps for the query
        // const fromTimestamp = from.getTime() / 1000;
        // const toTimestamp = to.getTime() / 1000;

        // Debug logging
        // console.log("Monthly Summary Query:");
        // console.log("- From:", from, "(", fromTimestamp, ")");
        // console.log("- To:", to, "(", toTimestamp, ")");
        // console.log("- Client ID:", clientId || "All clients");

        // Calculate date range for the query
        const startOfMonth = new Date(from.getFullYear(), from.getMonth(), 1);
        const endOfMonth = new Date(to.getFullYear(), to.getMonth() + 1, 0, 23, 59, 59, 999);

        // Query and aggregate monthly data using Drizzle ORM
        const rows = await db.query.dailyBrokerage.findMany({
            with: {
                client: true,
            },
            where: and(
                gte(dailyBrokerage.date, startOfMonth),
                lte(dailyBrokerage.date, endOfMonth),
                clientId ? eq(dailyBrokerage.clientId, Number(clientId)) : undefined,
            ),
            orderBy: [desc(dailyBrokerage.date)],
        });

        // Create a map to store monthly summaries by client and period
        const monthlySummaries = new Map<string, MonthlyBrokerageSummary>();

        // Process each row and aggregate by month and client
        for (const row of rows) {
            const date = new Date(row.date);
            const month = date.getMonth() + 1; // getMonth() returns 0-11
            const year = date.getFullYear();
            const clientId = row.clientId;
            const clientName = row.client?.name || "Unknown";

            // Create a unique key for this client and period
            const periodKey = `${clientId}-${year}-${month}`;

            // Get or create the summary for this period
            let summary = monthlySummaries.get(periodKey);
            if (!summary) {
                summary = {
                    clientId,
                    clientName,
                    period: { month, year },
                    brokerageAmount: 0, // This will store the sum of totalDailyBrokerage
                };
                monthlySummaries.set(periodKey, summary);
            }

            // Add to the total daily brokerage amount
            summary.brokerageAmount += Number(row.totalDailyBrokerage) || 0;
        }

        // change brokrage amount to 2 decimal places
        monthlySummaries.forEach((summary) => {
            summary.brokerageAmount = Number.parseFloat(summary.brokerageAmount.toFixed(2));
        });

        // Convert the map values to an array and sort by year and month (newest first)
        return Array.from(monthlySummaries.values()).sort((a, b) => {
            // Sort by year descending, then by month descending

            if (a.period.year !== b.period.year) {
                return b.period.year - a.period.year;
            }
            return b.period.month - a.period.month;
        });
    } catch (error) {
        console.error("Error in getMonthlyBrokerageSummary:", error);
        throw new Error("Failed to generate monthly brokerage summary");
    }
}

type QuarterlyBrokerageSummary = {
    clientId: number;
    clientName: string;
    period: {
        quarter: number;
        year: number;
    };
    brokerageAmount: number;
};

export async function getQuarterlyBrokerageSummary(
    { from, to, clientId }: { from: Date; to: Date; clientId?: string },
    tx?: TransactionType,
): Promise<QuarterlyBrokerageSummary[]> {
    // Input validation
    if (!(from instanceof Date) || !(to instanceof Date) || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new TypeError("Invalid date range provided");
    }
    if (from > to) {
        throw new Error("Start date cannot be after end date");
    }

    const db = getDB(tx);

    try {
        // Get all clients for name lookup (only if we're not filtering by clientId)
        let clientsMap: Record<number, string> = {};
        if (!clientId) {
            const clients = await db.query.clients.findMany({
                columns: { id: true, name: true },
            });
            clientsMap = Object.fromEntries(clients.map((c: { id: number; name: string }) => [c.id, c.name]));
        } else {
            // If filtering by clientId, just get that client's name
            const client = await db.query.clients.findFirst({
                where: (clients: { id: any }, { eq }: { eq: (column: any, value: any) => any }) => eq(clients.id, clientId),
                columns: { id: true, name: true },
            });
            if (client) {
                clientsMap[client.id] = client.name;
            }
        }

        // Convert dates to timestamps for the query
        // const fromTimestamp = from.getTime();
        // const toTimestamp = to.getTime();

        // Debug logging
        // console.log("Quarterly Summary Query:");
        // console.log("- From:", from, "(", fromTimestamp, ")");
        // console.log("- To:", to, "(", toTimestamp, ")");
        // console.log("- Client ID:", clientId || "All clients");

        // Calculate date range for the query
        const startOfQuarter = new Date(from.getFullYear(), from.getMonth(), 1);
        const endOfQuarter = new Date(to.getFullYear(), to.getMonth() + 1, 0, 23, 59, 59, 999);

        // Query all daily brokerage records for the quarter
        const dailyRecords = await db.query.dailyBrokerage.findMany({
            with: {
                client: true,
            },
            where: and(
                gte(dailyBrokerage.date, startOfQuarter),
                lte(dailyBrokerage.date, endOfQuarter),
                clientId ? eq(dailyBrokerage.clientId, Number(clientId)) : undefined,
            ),
            orderBy: [desc(dailyBrokerage.date)],
        });

        // Create a map to store quarterly summaries by client and quarter
        const quarterlyMap = new Map<string, {
            clientId: number;
            clientName: string;
            quarter: number;
            year: number;
            brokerageAmount: number;
        }>();

        // Process each daily record
        for (const record of dailyRecords) {
            const date = new Date(record.date);
            const year = date.getFullYear();
            const month = date.getMonth() + 1; // 1-12
            const quarter = Math.ceil(month / 3); // 1-4

            const key = `${record.clientId}-${year}-${quarter}`;
            const clientName = record.client?.name || "Unknown";

            if (!quarterlyMap.has(key)) {
                quarterlyMap.set(key, {
                    clientId: record.clientId,
                    clientName,
                    quarter,
                    year,
                    brokerageAmount: 0,
                });
            }

            const quarterData = quarterlyMap.get(key)!;
            quarterData.brokerageAmount += Number(record.totalDailyBrokerage) || 0;
        }

        // Convert the map to an array and format the response
        return Array.from(quarterlyMap.values()).map(quarterData => ({
            clientId: quarterData.clientId,
            clientName: quarterData.clientName,
            period: {
                quarter: quarterData.quarter,
                year: quarterData.year,
            },
            brokerageAmount: Number.parseFloat((quarterData.brokerageAmount || 0).toFixed(2)),
        }));
    } catch (error) {
        console.error("Error in getQuarterlyBrokerageSummary:", error);
        throw new Error("Failed to generate quarterly brokerage summary");
    }
}

// Calculate the total brokerage amount for a client or time period
export async function calculateTotalbrokerageAmount(data: {
    clientId: number;
}, tx?: TransactionType) {
    // console.log("[DEBUG] Total brokerage calculation params:", data);

    try {
        const db = getDB(tx);

        const dailyBrokerageResult = await db
            .select({
                totalAmount: sql<number>`SUM(${dailyBrokerage.totalDailyBrokerage})`.as("totalAmount"),
            })
            .from(dailyBrokerage)
            .where(eq(dailyBrokerage.clientId, data.clientId));

        // Extract totalAmount or default to 0
        return dailyBrokerageResult[0]?.totalAmount ?? 0;
    } catch (error) {
        console.error("[ERROR] Failed to calculate total brokerage amount:", error);
        return 0;
    }
}
