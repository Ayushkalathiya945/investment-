import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { PeriodType } from "@/types/brokerage";

import type { TransactionType } from "../index";
import type { Brokerage, Client, NewBrokerage, NewBrokerageDetail } from "../schema";

import { getDB } from "../index";
import { brokerageDetails, brokerages, clients } from "../schema";

export async function create(data: NewBrokerage, tx?: TransactionType) {
    const [brokerage] = await getDB(tx).insert(brokerages).values(data).returning();

    return brokerage ?? null;
}

export async function update(data: Partial<NewBrokerage> & { id: number }, tx?: TransactionType) {
    const [brokerage] = await getDB(tx).update(brokerages).set(data).where(eq(brokerages.id, data.id)).returning();

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

export async function findAllWithPagination(data: { page: number; limit: number; clientId?: number; from?: number; to?: number; month?: number; quarter?: number; year?: number }, tx?: TransactionType) {
    const conditions = [];

    if (data.clientId) {
        console.log(`Filtering by client ID: ${data.clientId}`);
        conditions.push(eq(brokerages.clientId, data.clientId));
    }

    let isQuarterlyFilter = false;
    let quarterValue = 0;
    let quarterYear = 0;

    if (data.from && data.to) {
        const fromMonth = new Date(data.from).getMonth() + 1;
        const toMonth = new Date(data.to).getMonth() + 1;

        console.log(`Month filter only: ${fromMonth} to ${toMonth}`);

        conditions.push(gte(brokerages.month, fromMonth));
        conditions.push(lte(brokerages.month, toMonth));
    } else if (data.quarter && data.year) {
        const quarter = Math.max(1, Math.min(4, data.quarter));

        if (quarter !== data.quarter) {
            console.warn(`Invalid quarter value ${data.quarter} provided, using ${quarter} instead`);
        }

        isQuarterlyFilter = true;
        quarterValue = quarter;
        quarterYear = data.year;

        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = quarter * 3;

        console.log(`Quarter filter: Q${quarter} ${data.year} (months ${startMonth}-${endMonth})`);

        conditions.push(eq(brokerages.year, data.year));
        conditions.push(gte(brokerages.month, startMonth));
        conditions.push(lte(brokerages.month, endMonth));
    } else if (data.month && data.year) {
        conditions.push(eq(brokerages.month, data.month));
        conditions.push(eq(brokerages.year, data.year));
    }

    const brokerageData = await getDB(tx).query.brokerages.findMany({
        with: {
            client: true,
        },
        where: and(...conditions),
        orderBy: [desc(brokerages.year), desc(brokerages.month)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const brokerageCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(brokerages)
        .where(and(...conditions));

    let count = brokerageCount && brokerageCount.length > 0 ? brokerageCount[0].count : 0;
    let resultBrokerage = brokerageData;

    if (isQuarterlyFilter && brokerageData.length === 0) {
        console.log(`No brokerage data found for quarter ${quarterValue} ${quarterYear}. Getting all clients with zero amounts...`);

        // Get all clients
        const allClients = await getDB(tx).query.clients.findMany();
        console.log(`Found ${allClients.length} clients to create zero brokerage records for`);

        // If we have a client filter, apply it here too
        const filteredClients = data.clientId
            ? allClients.filter((client: { id: number; name: string }) => client.id === data.clientId)
            : allClients;

        const syntheticRecords = filteredClients.map((client: { id: number; name: string }) => {
            const startMonth = (quarterValue - 1) * 3 + 1;
            const currentTimestamp = Date.now();
            const currentDate = new Date();

            return {
                id: 0,
                clientId: client.id,
                client,
                month: startMonth,
                year: quarterYear,
                calculationPeriod: Number.parseInt(`${quarterYear}${startMonth.toString().padStart(2, "0")}`),
                brokerageRate: 10,
                totalDaysInMonth: 0,
                totalHoldingValue: 0,
                totalHoldingDays: 0,
                brokerageAmount: 0,
                isPaid: 0,
                paidAmount: 0,
                totalPositions: 0,
                calculatedAt: currentTimestamp,
                createdAt: currentDate,
            };
        });

        resultBrokerage = syntheticRecords;
        count = filteredClients.length;

        console.log(`Created ${syntheticRecords.length} synthetic records with zero brokerage amounts`);
    }

    return { brokerage: resultBrokerage, count };
}

// Calculate the total brokerage amount for a client or time period
export async function calculateTotalbrokerageAmount(data: {
    clientId?: number;
    from?: number;
    to?: number;
    month?: number;
    quarter?: number;
    year?: number;
}, tx?: TransactionType) {
    const conditions = [];
    console.log("[DEBUG] Total brokerage calculation params:", data);

    // Format readable dates for logging if available
    const fromDate = data.from ? new Date(data.from * 1000).toISOString() : "all time";
    const toDate = data.to ? new Date(data.to * 1000).toISOString() : "present";
    console.log("[DEBUG] Date range:", { fromDate, toDate });

    // Client filter
    if (data.clientId) {
        console.log(`[DEBUG] Filtering totals by client ID: ${data.clientId}`);
        conditions.push(eq(brokerages.clientId, data.clientId));
    }

    // Date range filter (from/to)
    if (data.from && data.to) {
        conditions.push(gte(brokerages.calculatedAt, data.from));
        conditions.push(lte(brokerages.calculatedAt, data.to));
    } else if (data.quarter && data.year) { // Quarter filter
        // Validate quarter input (must be 1-4)
        const quarter = Math.max(1, Math.min(4, data.quarter));

        const startMonth = (quarter - 1) * 3 + 1; // 1, 4, 7, 10
        const endMonth = quarter * 3; // 3, 6, 9, 12

        conditions.push(eq(brokerages.year, data.year));
        conditions.push(gte(brokerages.month, startMonth));
        conditions.push(lte(brokerages.month, endMonth));
    } else if (data.month && data.year) {
        conditions.push(eq(brokerages.month, data.month));
        conditions.push(eq(brokerages.year, data.year));
    }

    try {
        // Build the query to get total brokerage
        const query = getDB(tx)
            .select({
                totalAmount: sql<number>`COALESCE(SUM(${brokerages.brokerageAmount}), 0)`,
            })
            .from(brokerages);

        // Apply conditions if we have any
        if (conditions.length > 0) {
            query.where(and(...conditions));
        }

        // Execute the query
        const totalbrokerageAmount = await query;

        // Get the result, ensuring it's a number (not null)
        const result = Number(totalbrokerageAmount[0]?.totalAmount || 0);

        return result;
    } catch (error) {
        console.error("[ERROR] Failed to calculate total brokerage amount:", error);
        return 0;
    }
}

export async function getAllPeriodicBrokerage(
    periodType: PeriodType,
    tx?: TransactionType,
    specificQuarter?: number,
    specificYear?: number,
): Promise<Array<{
        id: number;
        clientId: number;
        clientName: string;
        brokerageAmount: number;
        period: {
            month?: number;
            quarter?: number;
            year: number;
        };
        date: string;
        periodType: PeriodType;
        calculatedAt: number;
    }>> {
    const db = getDB(tx);

    // Join brokerage records with clients to get client names
    const baseQuery = db.select({
        id: brokerages.id,
        clientId: brokerages.clientId,
        clientName: clients.name,
        brokerageAmount: brokerages.brokerageAmount,
        month: brokerages.month,
        year: brokerages.year,
        calculatedAt: brokerages.calculatedAt,
    })
        .from(brokerages)
        .innerJoin(clients, eq(brokerages.clientId, clients.id));

    let result;

    // First, get all clients to ensure we return data for all clients even if they have no brokerage
    const allClients = await db.query.clients.findMany({
        columns: {
            id: true,
            name: true,
        },
    });

    const currentYear = specificYear || new Date().getFullYear();

    switch (periodType) {
        case PeriodType.QUARTER:
            try {
                let queryBuilder = db.select({
                    id: sql`MIN(${brokerages.id})`,
                    clientId: brokerages.clientId,
                    clientName: clients.name,
                    brokerageAmount: sql`SUM(${brokerages.brokerageAmount})`,
                    quarter: sql`
                        CASE 
                            WHEN ${brokerages.month} BETWEEN 1 AND 3 THEN 1
                            WHEN ${brokerages.month} BETWEEN 4 AND 6 THEN 2 
                            WHEN ${brokerages.month} BETWEEN 7 AND 9 THEN 3
                            WHEN ${brokerages.month} BETWEEN 10 AND 12 THEN 4
                            ELSE NULL
                        END
                    `,
                    year: brokerages.year,
                    calculatedAt: sql`MAX(${brokerages.calculatedAt})`,
                })
                    .from(brokerages)
                    .innerJoin(clients, eq(brokerages.clientId, clients.id));

                // Apply year filter if provided
                if (specificYear) {
                    queryBuilder = queryBuilder.where(eq(brokerages.year, specificYear));
                }

                // Apply quarter filter if provided (filter months based on quarter)
                if (specificQuarter) {
                    if (specificQuarter < 1 || specificQuarter > 4) {
                        console.error(`Invalid quarter: ${specificQuarter}, must be between 1 and 4`);
                        specificQuarter = Math.max(1, Math.min(4, specificQuarter)); // Ensure valid quarter
                    }

                    const startMonth = (specificQuarter - 1) * 3 + 1; // 1, 4, 7, 10
                    const endMonth = specificQuarter * 3; // 3, 6, 9, 12

                    queryBuilder = queryBuilder.where(
                        and(
                            gte(brokerages.month, startMonth),
                            lte(brokerages.month, endMonth),
                        ),
                    );
                }

                result = await queryBuilder
                    .groupBy(brokerages.clientId, clients.name, brokerages.year, sql`quarter`)
                    .orderBy(desc(brokerages.year), sql`quarter DESC`);

                const existingRecords = new Map();
                for (const record of result) {
                    if (!record.quarter)
                        continue;
                    const key = `${record.clientId}-${record.year}-${record.quarter}`;
                    existingRecords.set(key, true);
                }

                const years = specificYear
                    ? [specificYear]
                    : [...new Set(result.map((r: { year: number }) => r.year))];

                if (years.length === 0) {
                    years.push(currentYear);
                }

                const quartersToProcess = specificQuarter
                    ? [specificQuarter]
                    : [1, 2, 3, 4];

                const quarterEntriesToAdd = [];

                if (result.length === 0 || !specificQuarter) {
                    // For all clients
                    for (const client of allClients) {
                        for (const year of years) {
                            for (const quarter of quartersToProcess) {
                                const key = `${client.id}-${year}-${quarter}`;
                                if (!existingRecords.has(key)) {
                                    quarterEntriesToAdd.push({
                                        id: 0,
                                        clientId: client.id,
                                        clientName: client.name,
                                        brokerageAmount: 0,
                                        quarter,
                                        year,
                                        calculatedAt: Date.now(),
                                    });
                                }
                            }
                        }
                    }
                } else { // Otherwise, just fill in the gaps for clients that have some data
                    for (const client of allClients) {
                        for (const year of years) {
                            for (const quarter of quartersToProcess) {
                                const key = `${client.id}-${year}-${quarter}`;
                                if (!existingRecords.has(key)) {
                                    quarterEntriesToAdd.push({
                                        id: 0,
                                        clientId: client.id,
                                        clientName: client.name,
                                        brokerageAmount: 0,
                                        quarter,
                                        year,
                                        calculatedAt: Date.now(),
                                    });
                                }
                            }
                        }
                    }
                }

                // Add the zero entries to the result
                result = [...result, ...quarterEntriesToAdd];

                console.log(`Added ${quarterEntriesToAdd.length} zero entries for missing client/quarter combinations`);
                console.log(`Total result count: ${result.length}`);

                // Sort by year desc, quarter desc, client name asc
                result.sort((a, b) => {
                    if (a.year !== b.year)
                        return b.year - a.year;
                    if (a.quarter !== b.quarter)
                        return b.quarter - a.quarter;
                    return a.clientName.localeCompare(b.clientName);
                });
            } catch (error) {
                console.error("Error in quarterly SQL query:", error);
                // Fallback to a simpler query without grouping
                result = await baseQuery.orderBy(desc(brokerages.year), desc(brokerages.month));
            }
            break;

        case PeriodType.MONTH:
        default:
            try {
                console.log("Performing monthly brokerage calculation...");

                // Build a query to get monthly brokerage data
                let monthlyQuery = db.select({
                    id: brokerages.id,
                    clientId: brokerages.clientId,
                    clientName: clients.name,
                    brokerageAmount: brokerages.brokerageAmount,
                    month: brokerages.month,
                    year: brokerages.year,
                    calculatedAt: brokerages.calculatedAt,
                })
                    .from(brokerages)
                    .innerJoin(clients, eq(brokerages.clientId, clients.id));

                // Apply year filter if provided
                if (specificYear) {
                    monthlyQuery = monthlyQuery.where(eq(brokerages.year, specificYear));
                }

                // Apply month filter if provided
                if (specificQuarter) { // We're actually using specificQuarter as month here
                    const month = specificQuarter;
                    if (month >= 1 && month <= 12) {
                        console.log(`Filtering for month: ${month}`);
                        monthlyQuery = monthlyQuery.where(eq(brokerages.month, month));
                    }
                }

                // Execute the query
                result = await monthlyQuery.orderBy(desc(brokerages.year), desc(brokerages.month));
                console.log(`Found ${result.length} monthly brokerage records`);

                // Build a map of existing client/month/year entries
                const existingMonthlyRecords = new Map();
                for (const record of result) {
                    const key = `${record.clientId}-${record.year}-${record.month}`;
                    existingMonthlyRecords.set(key, true);
                }

                // Get years to process
                const years = specificYear
                    ? [specificYear]
                    : [...new Set(result.map((r: { year: number }) => r.year))];

                // If no years, use current year
                if (years.length === 0) {
                    years.push(currentYear);
                }

                // Get months to process
                const monthsToProcess = specificQuarter && specificQuarter >= 1 && specificQuarter <= 12
                    ? [specificQuarter]
                    : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

                console.log(`Processing years: [${years.join(", ")}], months: [${monthsToProcess.join(", ")}]`);

                // Add zero entries for months where clients have no data
                const monthEntriesToAdd = [];

                // If no results found or no specific month/year provided, ensure all clients have entries
                if (result.length === 0 || !specificQuarter) {
                    console.log("No brokerage data found in database or no specific month requested.");
                    console.log("Generating entries for all clients with zero brokerage amounts.");
                }

                // Always process all clients to ensure complete data
                for (const client of allClients) {
                    for (const year of years) {
                        // If we're limiting to a specific month, only process that month
                        // Otherwise, generate data for all months or for filtered months
                        for (const month of monthsToProcess) {
                            const key = `${client.id}-${year}-${month}`;
                            if (!existingMonthlyRecords.has(key)) {
                                console.log(`Adding zero entry for client ${client.id} (${client.name}), ${month}/${year}`);
                                monthEntriesToAdd.push({
                                    id: 0,
                                    clientId: client.id,
                                    clientName: client.name,
                                    brokerageAmount: 0, // Zero amount for no data
                                    month,
                                    year,
                                    calculatedAt: Date.now(),
                                });
                            }
                        }
                    }
                }

                // Add the zero entries to the result
                result = [...result, ...monthEntriesToAdd];

                console.log(`Added ${monthEntriesToAdd.length} zero entries for missing client/month combinations`);
                console.log(`Total monthly result count: ${result.length}`);

                // Sort by year desc, month desc, client name asc
                result.sort((a, b) => {
                    if (a.year !== b.year)
                        return b.year - a.year;
                    if (a.month !== b.month)
                        return b.month - a.month;
                    return a.clientName.localeCompare(b.clientName);
                });
            } catch (error) {
                console.error("Error in monthly brokerage calculation:", error);
                // Fallback to a simple query
                result = await baseQuery.orderBy(desc(brokerages.year), desc(brokerages.month));
            }
            break;
    }

    // Format the results to include a proper date string
    return (result || []).map((record: {
        id?: number;
        clientId?: number;
        clientName?: string;
        brokerageAmount?: number;
        month?: number;
        quarter?: number | string;
        year?: number | string;
        calculatedAt?: number;
    }) => {
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        const quarterNames = ["Q1", "Q2", "Q3", "Q4"];

        // Ensure all fields exist
        if (!record) {
            console.error("Empty record in getAllPeriodicBrokerage");
            return null;
        }

        // Ensure year exists and is a number
        const year = typeof record.year === "number"
            ? record.year
            : typeof record.year === "string" ? Number.parseInt(record.year) : currentYear;

        let date = "";
        const periodObj: { month?: number; quarter?: number; year: number } = { year };

        if (periodType === PeriodType.QUARTER) {
            // Ensure quarter exists and is a number between 1-4
            const quarter = typeof record.quarter === "number"
                ? record.quarter
                : typeof record.quarter === "string" ? Number.parseInt(record.quarter) : 1;
            const safeQuarter = Math.max(1, Math.min(4, quarter)); // Ensure between 1-4

            // Map quarter to its corresponding months for display
            const startMonth = (safeQuarter - 1) * 3 + 1;
            const endMonth = safeQuarter * 3;
            const startMonthName = monthNames[startMonth - 1];
            const endMonthName = monthNames[endMonth - 1];

            if (startMonthName && endMonthName) {
                // Format as "Q1 2023 (Jan-Mar)"
                date = `${quarterNames[safeQuarter - 1]} ${year} (${startMonthName.substring(0, 3)}-${endMonthName.substring(0, 3)})`;
            } else {
                // Fallback if month names are undefined
                date = `${quarterNames[safeQuarter - 1]} ${year}`;
            }
            periodObj.quarter = safeQuarter;
        } else {
            // Ensure month exists and is a number between 1-12
            const month = typeof record.month === "number"
                ? record.month
                : typeof record.month === "string" ? Number.parseInt(record.month) : 1;
            const safeMonth = Math.max(1, Math.min(12, month)); // Ensure between 1-12

            const monthName = monthNames[safeMonth - 1] || "Unknown";
            date = `${monthName} ${year}`;
            periodObj.month = safeMonth;
        }

        return {
            id: record.id || 0,
            clientId: record.clientId || 0,
            clientName: record.clientName || "Unknown Client",
            brokerageAmount: typeof record.brokerageAmount === "number" ? record.brokerageAmount : 0,
            period: periodObj,
            date,
            periodType,
            calculatedAt: record.calculatedAt || Date.now(),
        };
    }).filter(Boolean);
}

export async function getAllMonthlyBrokerage(tx?: TransactionType): Promise<{
    id: number;
    clientId: number;
    clientName: string;
    brokerageAmount: number;
    month: number;
    year: number;
    date: string;
    calculatedAt: number;
}[]> {
    const db = getDB(tx);

    // Join brokerage records with clients to get client names
    const result = await db.select({
        id: brokerages.id,
        clientId: brokerages.clientId,
        clientName: clients.name, // Join with clients table to get names
        brokerageAmount: brokerages.brokerageAmount,
        month: brokerages.month,
        year: brokerages.year,
        calculatedAt: brokerages.calculatedAt,
    })
        .from(brokerages)
        .innerJoin(clients, eq(brokerages.clientId, clients.id))
        .orderBy(desc(brokerages.year), desc(brokerages.month));

    // Format the results to include a month-year date string
    return result.map((record: {
        id: number;
        clientId: number;
        clientName: string;
        brokerageAmount: number;
        month: number;
        year: number;
        calculatedAt: number;
    }) => {
        type BrokerageRecord = {
            id: number;
            clientId: number;
            clientName: string;
            brokerageAmount: number;
            month: number;
            year: number;
            calculatedAt: number;
            date: string;
        };

        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];

        // Handle potentially invalid month values
        const monthIndex = typeof record.month === "number" ? Math.max(0, Math.min(11, record.month - 1)) : 0;
        const monthName = monthNames[monthIndex] || "Unknown";

        return {
            ...record,
            date: `${monthName} ${record.year}`,
        } as BrokerageRecord;
    });
}

export async function saveBrokerageDetails(
    brokerageId: number,
    details: Array<Partial<NewBrokerageDetail>>,
    tx?: TransactionType,
): Promise<void> {
    const db = getDB(tx);

    try {
        // Delete any existing details for this brokerage to prevent duplicates
        await db.delete(brokerageDetails).where(eq(brokerageDetails.brokerageId, brokerageId));

        // Only proceed with insert if there are details to save
        if (details.length > 0) {
            // Use map to transform all details in a single pass
            const detailsToInsert = details.map((detail) => {
                // Ensure totalDaysInMonth is not zero to prevent division by zero
                const totalDays = detail.totalDaysInMonth && detail.totalDaysInMonth > 0 ? detail.totalDaysInMonth : 30;

                // Safely access symbol with a fallback for type safety
                const symbol = detail.symbol || "unknown";

                // Handle all date fields safely with detailed context - convert to Date objects
                const dateFields = {
                    buyDate: safeDate(detail.buyDate, `Symbol: ${symbol} - buyDate`),
                    holdingStartDate: safeDate(detail.holdingStartDate, `Symbol: ${symbol} - holdingStartDate`),
                    holdingEndDate: safeDate(detail.holdingEndDate, `Symbol: ${symbol} - holdingEndDate`),
                    sellDate: detail.sellDate ? safeDate(detail.sellDate, `Symbol: ${symbol} - sellDate`) : null,
                };

                try {
                    return {
                        brokerageId,
                        tradeId: detail.tradeId,
                        symbol: detail.symbol,
                        exchange: detail.exchange,
                        quantity: detail.quantity,
                        buyPrice: detail.buyPrice ? Number(detail.buyPrice.toFixed(2)) : 0,
                        // Convert all date fields to Date objects
                        buyDate: dateFields.buyDate,
                        holdingStartDate: dateFields.holdingStartDate,
                        holdingEndDate: dateFields.holdingEndDate,
                        holdingDays: detail.holdingDays,
                        totalDaysInMonth: totalDays,
                        positionValue: detail.positionValue ? Number(detail.positionValue.toFixed(2)) : 0,
                        monthlyBrokerageRate: 10, // 10% per month (fixed rate)
                        dailyBrokerageRate: Number((10 / totalDays).toFixed(2)),
                        brokerageAmount: detail.brokerageAmount ? Number(detail.brokerageAmount.toFixed(2)) : 0,
                        calculationFormula: detail.calculationFormula,
                        // Handle optional fields for sold positions
                        isSoldInMonth: detail.isSoldInMonth || 0,
                        sellDate: dateFields.sellDate,
                        sellPrice: detail.sellPrice ? Number(detail.sellPrice.toFixed(2)) : null,
                        sellValue: detail.sellValue ? Number(detail.sellValue.toFixed(2)) : null,
                        createdAt: new Date(), // Use Date object for createdAt as well
                    };
                } catch (err) {
                    // Minimal error logging
                    console.error(`${err} :  Error creating brokerage detail record for ${detail.symbol}`);
                    // Return a safe fallback record in case of errors
                    const now = new Date();
                    return {
                        brokerageId,
                        tradeId: detail.tradeId,
                        symbol: detail.symbol,
                        exchange: detail.exchange,
                        quantity: detail.quantity,
                        buyPrice: detail.buyPrice ? Number(detail.buyPrice.toFixed(2)) : 0,
                        buyDate: now,
                        holdingStartDate: now,
                        holdingEndDate: now,
                        holdingDays: detail.holdingDays,
                        totalDaysInMonth: totalDays,
                        positionValue: detail.positionValue ? Number(detail.positionValue.toFixed(2)) : 0,
                        monthlyBrokerageRate: 10,
                        dailyBrokerageRate: Number((10 / totalDays).toFixed(2)),
                        brokerageAmount: detail.brokerageAmount ? Number(detail.brokerageAmount.toFixed(2)) : 0,
                        calculationFormula: detail.calculationFormula,
                        isSoldInMonth: 0,
                        sellDate: null,
                        sellPrice: null,
                        sellValue: null,
                        createdAt: now,
                    };
                }
            });

            try {
                // Insert all details in a single batch operation
                await db.insert(brokerageDetails).values(detailsToInsert);

                // Minimal logging
                // console.log(`Saved ${detailsToInsert.length} brokerage details`);
            } catch (insertError) {
                // Detailed error logging
                console.error(`    ❌ Database insert error: ${insertError}`);

                // Try to insert one by one to isolate the problematic record
                console.error(`    🔄 Attempting individual record inserts to isolate problematic records...`);
            }
        } else {
            console.error(`    ⚠️ No brokerage details to save for brokerage ID ${brokerageId}`);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ❌Error saving brokerage details: ${errorMessage}`);
        throw new Error(`Failed to save brokerage details: ${errorMessage}`);
    }
}

export async function createWithDetails(
    brokerageData: NewBrokerage,
    detailsList: Array<Partial<NewBrokerageDetail>>,
    tx?: TransactionType,
) {
    const db = getDB(tx);
    const [brokerage] = await db.insert(brokerages).values(brokerageData).returning();

    if (detailsList.length > 0) {
        await saveBrokerageDetails(brokerage.id, detailsList, tx);
    }

    return brokerage;
}
export async function batchSaveClientBrokerages(
    clientBrokerages: Array<{
        clientData: Partial<Client>;
        brokerageData: NewBrokerage;
        detailsData: Array<Partial<NewBrokerageDetail>>;
    }>,
    tx?: TransactionType,
) {
    const db = getDB(tx);

    // Collect all brokerage data and format numeric values to 2 decimal places
    const brokerageDataList = clientBrokerages.map((c) => {
        // Format numeric values to 2 decimal places
        const formattedData = {
            ...c.brokerageData,
            brokerageAmount: c.brokerageData.brokerageAmount ? Number(c.brokerageData.brokerageAmount.toFixed(2)) : 0,
            totalHoldingValue: c.brokerageData.totalHoldingValue ? Number(c.brokerageData.totalHoldingValue.toFixed(2)) : 0,
            brokerageRate: c.brokerageData.brokerageRate ? Number(c.brokerageData.brokerageRate.toFixed(2)) : 10,
        };
        return formattedData;
    });

    // Batch insert brokerages with conflict update
    const insertedBrokerages = await db.insert(brokerages)
        .values(brokerageDataList)
        .onConflictDoUpdate({
            target: [brokerages.clientId, brokerages.calculationPeriod],
            set: {
                totalHoldingValue: sql`ROUND(excluded.total_holding_value, 2)`,
                totalHoldingDays: sql`excluded.total_holding_days`,
                brokerageAmount: sql`ROUND(excluded.brokerage_amount, 2)`,
                totalPositions: sql`excluded.total_positions`,
                calculatedAt: sql`excluded.calculated_at`,
            },
        })
        .returning();

    // Prepare all brokerage details for batch insert
    const allDetailsToInsert: Array<Omit<NewBrokerageDetail, "id">> = [];

    // Process batch details - first delete existing details for all brokerages
    const brokerageIds = insertedBrokerages.map((b: Brokerage) => b.id);

    if (brokerageIds.length > 0) {
        try {
            // Delete existing details for these brokerages
            await db.delete(brokerageDetails)
                .where(inArray(brokerageDetails.brokerageId, brokerageIds));

            // Process each brokerage's details
            insertedBrokerages.forEach((insertedBrokerage: Brokerage, index: number) => {
                const original = clientBrokerages[index];

                if (original.detailsData.length === 0) {
                    return; // Skip if no details
                }

                const brokerageId = insertedBrokerage.id;

                // Process each detail - prepare for batch insert
                original.detailsData.forEach((detail) => {
                    // Ensure totalDaysInMonth is not zero to prevent division by zero
                    const totalDays = detail.totalDaysInMonth && detail.totalDaysInMonth > 0
                        ? detail.totalDaysInMonth
                        : 30;

                    // Safely access symbol with a fallback for type safety
                    const symbol = detail.symbol || "unknown";

                    try {
                        // Convert dates to numeric timestamps as required by the schema
                        const buyDateObj = safeDate(detail.buyDate, `Symbol: ${symbol} - buyDate`);
                        const holdingStartDateObj = safeDate(detail.holdingStartDate, `Symbol: ${symbol} - holdingStartDate`);
                        const holdingEndDateObj = safeDate(detail.holdingEndDate, `Symbol: ${symbol} - holdingEndDate`);
                        const sellDateObj = detail.sellDate ? safeDate(detail.sellDate, `Symbol: ${symbol} - sellDate`) : null;

                        // Timestamp conversion - SQLite expects integers for dates
                        const buyDate = buyDateObj.getTime();
                        const holdingStartDate = holdingStartDateObj.getTime();
                        const holdingEndDate = holdingEndDateObj.getTime();
                        const sellDate = sellDateObj ? sellDateObj.getTime() : null;
                        const createdAt = new Date();

                        // Add to batch array
                        allDetailsToInsert.push({
                            brokerageId,
                            tradeId: detail.tradeId!,
                            symbol,
                            exchange: detail.exchange!,
                            quantity: detail.quantity!,
                            buyPrice: detail.buyPrice!,
                            buyDate,
                            holdingStartDate,
                            holdingEndDate,
                            holdingDays: detail.holdingDays!,
                            totalDaysInMonth: totalDays,
                            positionValue: detail.positionValue ? Number(detail.positionValue.toFixed(2)) : 0,
                            monthlyBrokerageRate: 10, // 10% per month (fixed rate)
                            dailyBrokerageRate: Number((10 / totalDays).toFixed(2)),
                            brokerageAmount: detail.brokerageAmount ? Number(detail.brokerageAmount.toFixed(2)) : 0,
                            calculationFormula: detail.calculationFormula,
                            isSoldInMonth: detail.isSoldInMonth || 0,
                            sellDate,
                            sellPrice: detail.sellPrice ? Number(detail.sellPrice.toFixed(2)) : null,
                            sellValue: detail.sellValue ? Number(detail.sellValue.toFixed(2)) : null,
                            createdAt,
                        });
                    } catch (err) {
                        console.error(`Error preparing detail for ${symbol}: ${err}`);
                    }
                });
            });

            // Then insert all details in one batch if we have any
            if (allDetailsToInsert.length > 0) {
                try {
                    await db.insert(brokerageDetails).values(allDetailsToInsert);
                    console.log(`Successfully batch inserted ${allDetailsToInsert.length} brokerage details`);
                } catch (insertError) {
                    console.error(`Error batch inserting brokerage details: ${insertError}`);
                }
            }
        } catch (err) {
            console.error(`Error in batch saving process: ${err}`);
        }
    }

    return insertedBrokerages;
}

function safeDate(value: Date | number | string | undefined | null, debugContext: string = ""): Date {
    // For null or undefined, return current date
    if (value === undefined || value === null) {
        console.error(`${debugContext}: Null or undefined date value, using current date`);
        return new Date();
    }

    // If already a Date object, return as is (after validation)
    if (value instanceof Date) {
        if (!Number.isNaN(value.getTime())) {
            return value;
        } else {
            console.error(`${debugContext}: Invalid Date object, using current date`);
            return new Date();
        }
    }

    // If it's a number, treat as timestamp and convert to Date
    if (typeof value === "number") {
        // Check if it's a reasonable timestamp (after 1980)
        if (value > 315532800000) { // Jan 1, 1980
            return new Date(value);
        } else {
            console.error(`${debugContext}: Unlikely timestamp value: ${value}, using current date`);
            return new Date();
        }
    }

    // If it's a string, try to parse it
    if (typeof value === "string") {
        const parsedDate = new Date(value);
        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate;
        } else {
            console.error(`${debugContext}: Could not parse date string: ${value}, using current date`);
            return new Date();
        }
    }

    // For all other types, log the type and use current date
    console.error(`${debugContext}: Unexpected date value type: ${typeof value}, value: ${String(value)}, using current date`);
    return new Date();
}
