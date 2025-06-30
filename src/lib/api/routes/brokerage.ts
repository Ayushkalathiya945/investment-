import { zValidator } from "@hono/zod-validator";
import { and, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { PeriodType } from "@/types/brokerage";

import type { TransactionType } from "../db";
import type {
    ExchangeType,
} from "../db/schema";

import { getDB } from "../db";
import * as brokerageQueries from "../db/queries/brokerage";
import {
    brokerages,
    clients,
    fifoAllocations,
    trades,
    TradeType,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { brokerageFilterSchema, brokerageSchema } from "../utils/validation-schemas";

// Create a new Hono router for brokerage routes
const brokerageRouter = new Hono();

// Apply authentication middleware to all brokerage routes
brokerageRouter.use("*", authMiddleware);

// Get all brokerage calculations with filters
brokerageRouter.post("/get-all", zValidator("json", brokerageFilterSchema), async (c) => {
    const { page, limit, clientId, month, quarter, year, from: fromDate, to: toDate } = c.req.valid("json");

    console.log("\nGetting all brokerage calculations with filters...");
    console.log("Filter params:", { page, limit, clientId, month, quarter, year, fromDate, toDate });

    try {
        let from: number | undefined, to: number | undefined;
        let periodType = PeriodType.MONTH;

        if (fromDate && toDate) {
            // Custom date range
            from = new Date(fromDate).getTime();
            to = new Date(toDate).getTime();
            periodType = PeriodType.CUSTOM;
            console.log(`Using custom date range: ${new Date(from).toLocaleDateString()} to ${new Date(to).toLocaleDateString()}`);
        } else if (quarter && year) {
            // Quarterly date range - let the query handle this directly
            periodType = PeriodType.QUARTER;
            console.log(`Using quarter filter: Q${quarter} ${year}`);

            // For quarterly data, make sure the query gets the right months
            if (quarter < 1 || quarter > 4) {
                console.log(`Invalid quarter value ${quarter} provided, will be adjusted to valid range`);
            }
        } else if (month && year) {
            // Monthly date range - let the query handle this directly
            periodType = PeriodType.MONTH;
            console.log(`Using month filter: ${month}/${year}`);
        } else {
            periodType = PeriodType.MONTH;
        }

        let { brokerage, count } = await brokerageQueries.findAllWithPagination({
            page,
            limit,
            clientId,
            from,
            to,
            month,
            quarter,
            year,
        });

        if (clientId && brokerage.length === 0) {
            console.log(`No brokerage records found for client ${clientId}, creating placeholder record`);

            const client = await getDB().query.clients.findFirst({
                where: eq(clients.id, clientId),
            });

            if (client) {
                brokerage = [{
                    id: 0, // Placeholder ID
                    clientId: client.id,
                    client,
                    brokerageAmount: 0,
                    month: month || (quarter ? (quarter - 1) * 3 + 1 : new Date().getMonth() + 1),
                    year: year || new Date().getFullYear(),
                    calculatedAt: Date.now(),
                    calculationPeriod: 0,
                    totalBrokerage: 0,
                    totalHoldingDays: 0,
                    totalHoldingValue: 0,
                    totalTrades: 0,
                    totalTurnover: 0,
                }];

                // Set count to 1 since we're returning one record
                count = 1;
            }
        }

        const formattedData = brokerage.map((record: any) => {
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

            let date = "";
            let formattedPeriodType = periodType;

            // Format the date string based on the period type
            if (periodType === PeriodType.QUARTER) {
                // Use provided quarter parameter or calculate from record.month
                const recordQuarter = quarter || (record.month ? Math.ceil(record.month / 3) : 1);
                // Ensure quarter is between 1-4
                const safeQuarter = Math.max(1, Math.min(4, recordQuarter));
                // Include month range in quarter display (e.g., "Q1 2025 (Jan-Mar)")
                const startMonth = (safeQuarter - 1) * 3;
                const endMonth = safeQuarter * 3 - 1;
                const startMonthName = monthNames[startMonth].substring(0, 3);
                const endMonthName = monthNames[endMonth].substring(0, 3);
                date = `${quarterNames[safeQuarter - 1]} ${record.year} (${startMonthName}-${endMonthName})`;
            } else if (month || record.month) {
                const monthIndex = (month || record.month) - 1;
                const monthName = monthNames[monthIndex] || "Unknown";
                date = `${monthName} ${record.year}`;
                formattedPeriodType = PeriodType.MONTH;
            } else if (from && to) {
                // For custom date ranges
                const fromDate = new Date(from);
                const toDate = new Date(to);
                date = `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
            }

            return {
                id: record.id,
                clientId: record.clientId,
                clientName: record.client ? record.client.name : "Unknown Client",
                brokerageAmount: record.brokerageAmount,
                month: record.month,
                quarter: quarter || Math.ceil(record.month / 3),
                year: record.year,
                date,
                periodType: formattedPeriodType,
                calculatedAt: record.calculatedAt,
            };
        });

        console.log(`Found ${formattedData.length} brokerage records, total: ${count}`);

        const totalPage = Math.ceil(count / limit);

        return c.json({
            success: true,
            data: formattedData,
            periodType,
            metadata: {
                total: count,
                hasNext: page < totalPage,
                totalPages: totalPage,
            },
        });
    } catch (error) {
        if (error === "Brokerage calculation not found") {
            throw new HTTPException(404, { message: error });
        }
        throw new HTTPException(500, { message: "Failed to fetch brokerage" });
    }
});

// Get all periodic brokerage records for all clients
brokerageRouter.get("/get-all-periodic", async (c) => {
    try {
        // Get the period type from query parameter, defaulting to 'month'
        const periodTypeParam = c.req.query("periodType") || "month";

        // Get optional quarter parameter (for filtering to specific quarter)
        const quarterParam = c.req.query("quarter");
        const yearParam = c.req.query("year");

        // Convert string parameter to PeriodType enum
        let periodType: PeriodType;
        let specificQuarter: number | undefined;
        let specificYear: number | undefined;

        if (periodTypeParam === "quarter") {
            periodType = PeriodType.QUARTER;

            // If specific quarter was requested, validate and parse it
            if (quarterParam) {
                specificQuarter = Number.parseInt(quarterParam);
                if (Number.isNaN(specificQuarter) || specificQuarter < 1 || specificQuarter > 4) {
                    throw new Error(`Invalid quarter value: ${quarterParam}. Must be between 1-4.`);
                }

                console.log(`Requesting data for quarter ${specificQuarter}`);
            } else {
                console.log("No specific quarter provided. Will return data for all quarters with all clients.");
                // Quarter is undefined - we'll get all quarters for all clients
            }

            // If specific year was requested, parse it
            if (yearParam) {
                specificYear = Number.parseInt(yearParam);
                if (Number.isNaN(specificYear) || specificYear < 2000 || specificYear > 2100) {
                    throw new Error(`Invalid year value: ${yearParam}. Must be a valid year.`);
                }

                console.log(`Requesting data for year ${specificYear}`);
            } else {
                console.log("No specific year provided. Will use current year.");
                // Year will default to current year in the query function
            }
        } else if (periodTypeParam === "custom") {
            periodType = PeriodType.CUSTOM;
        } else {
            periodType = PeriodType.MONTH;
        }

        // Get the brokerage data from the db queries - pass quarter and year filters directly to the function
        // This ensures zero entries are generated for all clients from the client table
        const brokerageData = await brokerageQueries.getAllPeriodicBrokerage(
            periodType,
            undefined, // tx
            specificQuarter, // Pass undefined if no quarter specified
            specificYear, // Pass undefined if no year specified
        );

        return c.json({
            success: true,
            data: brokerageData,
            periodType,
            filters: {
                quarter: specificQuarter,
                year: specificYear,
            },
        });
    } catch (error) {
        console.error("Error in get-all-periodic:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new HTTPException(500, { message: `Failed to fetch brokerage records: ${errorMessage}` });
    }
});

// For backward compatibility
brokerageRouter.get("/get-all-monthly", async (c) => {
    try {
        // Get optional month and year parameters
        const monthParam = c.req.query("month");
        const yearParam = c.req.query("year");

        let specificMonth: number | undefined;
        let specificYear: number | undefined;

        // Parse month if provided
        if (monthParam) {
            specificMonth = Number.parseInt(monthParam);
            if (Number.isNaN(specificMonth) || specificMonth < 1 || specificMonth > 12) {
                throw new Error(`Invalid month value: ${monthParam}. Must be between 1-12.`);
            }
        }

        // Parse year if provided
        if (yearParam) {
            specificYear = Number.parseInt(yearParam);
            if (Number.isNaN(specificYear) || specificYear < 2000 || specificYear > 2100) {
                throw new Error(`Invalid year value: ${yearParam}. Must be a valid year.`);
            }
        }

        // Reuse the getAllPeriodicBrokerage function with month type
        const allMonthlyBrokerage = await brokerageQueries.getAllPeriodicBrokerage(
            PeriodType.MONTH,
            undefined, // No transaction
            specificMonth, // Can pass month to filter (will be ignored for monthly type)
            specificYear, // Can pass year to filter
        );

        return c.json({
            success: true,
            data: allMonthlyBrokerage,
            periodType: PeriodType.MONTH,
            filters: {
                month: specificMonth,
                year: specificYear,
            },
        });
    } catch (error) {
        console.error("Error in get-all-monthly:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new HTTPException(500, { message: `Failed to fetch monthly brokerage records: ${errorMessage}` });
    }
});

// API endpoint to calculate monthly brokerage
brokerageRouter.post("/calculate", zValidator("json", brokerageSchema), async (c) => {
    const { month, year } = c.req.valid("json");
    try {
        await calculateAndSaveMonthlyBrokerage(month, year);
        return c.json({
            success: true,
            message: `Successfully calculated brokerage for ${month}/${year}`,
        });
    } catch (error) {
        console.error(`Error calculating brokerage: ${error}`);
        throw new HTTPException(500, { message: `Failed to calculate brokerage: ${error}` });
    }
});

export async function calculateAndSaveMonthlyBrokerage(
    month: number,
    year: number,
    tx?: TransactionType,
): Promise<void> {
    // Log start of calculation
    console.log(`\n🔍 Calculating brokerage for ${month}/${year}...`);

    // Validate input parameters
    if (month < 1 || month > 12) {
        throw new Error(`Invalid month: ${month}. Must be between 1 and 12.`);
    }

    if (year < 2000 || year > 2100) {
        throw new Error(`Invalid year: ${year}. Must be between 2000 and 2100.`);
    }

    // Create period identifier in YYYYMM format
    const calculationPeriod = Number.parseInt(`${year}${month.toString().padStart(2, "0")}`);
    const totalDaysInMonth = getDaysInMonth(month, year);

    // Get all clients from the database
    const allClients = await getDB(tx).query.clients.findMany();
    console.log(`👥 Processing ${allClients.length} clients`);

    let totalBrokerageAmount = 0;
    let processedClientsCount = 0;
    let errorClientsCount = 0;

    // Process each client one by one
    for (const client of allClients) {
        console.log(`\n📊 Client: ${client.name} (ID: ${client.id})`);

        try {
            // Calculate brokerage for this client
            const clientBrokerage = await calculateClientMonthlyBrokerage(client.id, month, year, tx);

            // Save main brokerage record to database
            const [brokerageRecord] = await getDB(tx).insert(brokerages).values({
                clientId: client.id,
                month,
                year,
                calculationPeriod,
                totalDaysInMonth,
                totalHoldingValue: clientBrokerage.totalHoldingValue,
                totalHoldingDays: clientBrokerage.totalHoldingDays,
                brokerageRate: 10, // 10% per month (fixed rate)
                brokerageAmount: clientBrokerage.totalBrokerage,
                totalPositions: clientBrokerage.details.length,
                isPaid: 0, // Not paid by default
                paidAmount: 0, // No payment by default
                calculatedAt: Date.now(),
            }).onConflictDoUpdate({
                target: [brokerages.clientId, brokerages.calculationPeriod],
                set: {
                    totalHoldingValue: clientBrokerage.totalHoldingValue,
                    totalHoldingDays: clientBrokerage.totalHoldingDays,
                    brokerageAmount: clientBrokerage.totalBrokerage,
                    totalPositions: clientBrokerage.details.length,
                    calculatedAt: Date.now(),
                },
            }).returning();

            // Save detailed brokerage records (line-item breakdown)
            await brokerageQueries.saveBrokerageDetails(brokerageRecord.id, clientBrokerage.details, tx);

            // Update statistics
            totalBrokerageAmount += clientBrokerage.totalBrokerage;
            processedClientsCount++;

            console.log(`  💰 Total Brokerage: ₹${clientBrokerage.totalBrokerage.toFixed(2)}`);
            console.log(`  🔢 Positions: ${clientBrokerage.details.length}`);
            console.log(`  ✅ Saved to database (ID: ${brokerageRecord.id})`);
        } catch (error) {
            errorClientsCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`  ❌ Error calculating brokerage for client ${client.id}: ${errorMessage}`);
        }
    }

    // Print summary information
    console.log(`\n📋 SUMMARY FOR ${month}/${year}:`);
    console.log(`Total Clients: ${allClients.length}`);
    console.log(`Successfully Processed: ${processedClientsCount}`);
    console.log(`Failed: ${errorClientsCount}`);
    console.log(`Total Brokerage Amount: ₹${totalBrokerageAmount.toFixed(2)}`);
}

function getDaysInMonth(month: number, year: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function calculateProRatedBrokerage(
    stockValue: number,
    daysHeld: number,
    totalDaysInMonth: number,
    rate: number = 10, // Default 10% monthly rate
): number {
    const fullMonthBrokerage = stockValue * (rate / 100); // Default 10% for full month
    return (fullMonthBrokerage * daysHeld) / totalDaysInMonth;
}

// Define the BrokerageDetailType interface based on the schema
type BrokerageDetailType = {
    tradeId: number;
    symbol: string;
    exchange: ExchangeType;
    quantity: number;
    buyPrice: number;
    buyDate: number | Date | null; // Allow various date formats
    holdingStartDate: number | Date | null;
    holdingEndDate: number | Date | null;
    holdingDays: number;
    totalDaysInMonth: number;
    positionValue: number;
    brokerageAmount: number;
    calculationFormula: string;
    isSoldInMonth?: number | null;
    sellDate?: number | Date | null;
    sellPrice?: number | null;
    sellValue?: number | Date | null;
};

async function calculateClientMonthlyBrokerage(
    clientId: number,
    month: number,
    year: number,
    tx?: TransactionType,
): Promise<{
        totalBrokerage: number;
        details: Array<BrokerageDetailType>;
        totalHoldingValue: number;
        totalHoldingDays: number;
        totalTrades: number;
        totalTurnover: number;
    }> {
    console.log(`\n  🔍 Calculating brokerage for client ${clientId}...`);

    try {
        // Define the period boundaries
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1)).getTime();
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59)).getTime();
        const daysInMonth = getDaysInMonth(month, year);

        console.log(`    📅 Period: ${new Date(startOfMonth).toLocaleDateString()} to ${new Date(endOfMonth).toLocaleDateString()} (${daysInMonth} days)`);

        // Calculate brokerage based on FIFO holdings
        const {
            totalBrokerage,
            details,
            totalHoldingValue,
            totalHoldingDays,
        } = await calculateFifoBrokerage(clientId, startOfMonth, endOfMonth, daysInMonth, tx);

        // Get trade statistics for the month
        const tradesData = await getMonthlyTradeStats(clientId, startOfMonth, endOfMonth, tx);

        console.log(`    📈 FIFO-Based Brokerage: ₹${totalBrokerage.toFixed(2)}`);
        console.log(`    📊 Trades: ${tradesData.totalTrades} (Turnover: ₹${tradesData.totalTurnover.toFixed(2)})`);

        // Inspect details array to ensure it has proper data structure
        console.log(`    🧮 Generated ${details.length} brokerage detail records`);

        return {
            totalBrokerage,
            details,
            totalHoldingValue,
            totalHoldingDays,
            totalTrades: tradesData.totalTrades,
            totalTurnover: tradesData.totalTurnover,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`    ❌ Error in calculateClientMonthlyBrokerage: ${errorMessage}`);
        throw new Error(`Failed to calculate monthly brokerage for client ${clientId}: ${errorMessage}`);
    }
}

async function getStockPrices(tx?: TransactionType): Promise<Map<string, number>> {
    const db = getDB(tx);
    const stockPrices = await db.query.stocks.findMany({
        columns: {
            symbol: true,
            exchange: true,
            currentPrice: true,
        },
    });

    // Create a map for fast lookups
    const priceMap = new Map<string, number>();
    stockPrices.forEach((stock: { symbol: string; exchange: string; currentPrice: number | null }) => {
        const key = `${stock.symbol}-${stock.exchange}`;
        priceMap.set(key, stock.currentPrice || 0);
    });

    return priceMap;
}

async function calculateFifoBrokerage(
    clientId: number,
    startOfMonth: number,
    endOfMonth: number,
    daysInMonth: number,
    tx?: TransactionType,
): Promise<{
        totalBrokerage: number;
        details: BrokerageDetailType[];
        totalHoldingValue: number;
        totalHoldingDays: number;
    }> {
    const db = getDB(tx);

    console.log(`\n    🔍 Calculating FIFO brokerage for client ${clientId} (${daysInMonth} days)`);

    let totalBrokerage = 0;
    let totalHoldingValue = 0;
    let totalHoldingDays = 0;
    const brokerageDetails = [];

    // Get current stock prices
    const stockPrices = await getStockPrices(tx);

    // 1. Get all BUY trades for the client that still have remaining quantity
    // These represent current holdings that need brokerage calculation
    const buyTrades = await db.query.trades.findMany({
        where: and(
            eq(trades.clientId, clientId),
            eq(trades.type, TradeType.BUY),
            eq(trades.isFullySold, 0), // Not fully sold
        ),
    });

    console.log(`    📊 Active BUY trades with remaining quantity: ${buyTrades.length}`);

    // Calculate brokerage for each buy trade with remaining shares
    for (const trade of buyTrades) {
        if (trade.remainingQuantity <= 0)
            continue;

        const stockKey = `${trade.symbol}-${trade.exchange}`;
        const currentPrice = stockPrices.get(stockKey) || trade.price; // fallback to purchase price

        // Calculate holding days in this month
        let holdingStartDate = trade.tradeDate;
        let holdingDays = daysInMonth;

        // If bought during this month, adjust days held
        if (holdingStartDate >= startOfMonth) {
            holdingDays = Math.ceil((endOfMonth - holdingStartDate) / (1000 * 60 * 60 * 24)) + 1;
            if (holdingDays > daysInMonth)
                holdingDays = daysInMonth;
        } else {
            // If bought before this month, use start of month
            holdingStartDate = startOfMonth;
        }

        // Calculate brokerage
        const positionValue = trade.remainingQuantity * currentPrice;
        const tradeBrokerage = calculateProRatedBrokerage(positionValue, holdingDays, daysInMonth);

        console.log(`      📈 ${trade.symbol} ${trade.exchange}: ${trade.remainingQuantity} @ ₹${currentPrice.toFixed(2)} × ${holdingDays}/${daysInMonth} days = ₹${tradeBrokerage.toFixed(2)}`);

        totalBrokerage += tradeBrokerage;
        totalHoldingValue += positionValue;
        totalHoldingDays += holdingDays;

        // Create calculation formula for transparency
        const calculationFormula = `₹${positionValue.toFixed(2)} × 10% × ${holdingDays}/${daysInMonth} days = ₹${tradeBrokerage.toFixed(2)}`;
        // Add to details for saving - ensure all dates are proper numbers
        brokerageDetails.push({
            tradeId: trade.id,
            symbol: trade.symbol,
            exchange: trade.exchange as ExchangeType,
            quantity: trade.remainingQuantity,
            buyPrice: trade.price,
            buyDate: typeof trade.tradeDate === "number" ? trade.tradeDate : Date.now(),
            holdingStartDate: typeof holdingStartDate === "number" ? holdingStartDate : Date.now(),
            holdingEndDate: typeof endOfMonth === "number" ? endOfMonth : Date.now(),
            holdingDays,
            totalDaysInMonth: daysInMonth,
            positionValue,
            brokerageAmount: tradeBrokerage,
            calculationFormula,
        });
    }

    // 2. Handle sell trades during the month - need to calculate brokerage for the days held during the month
    // Find FIFO allocations where the sell date is within this month
    const fifoSellingAllocations = await db.select().from(fifoAllocations).where(
        and(
            eq(fifoAllocations.clientId, clientId),
            gte(fifoAllocations.sellDate, startOfMonth),
            lte(fifoAllocations.sellDate, endOfMonth),
        ),
    );

    console.log(`    📊 FIFO allocations (sells) in this month: ${fifoSellingAllocations.length}`);

    // Calculate brokerage for each allocation (partial holding)
    for (const allocation of fifoSellingAllocations) {
        // Determine the holding period within this month
        let holdingStartDate = allocation.buyDate;
        const holdingEndDate = allocation.sellDate;

        // If bought before this month, adjust start date
        if (holdingStartDate < startOfMonth) {
            holdingStartDate = startOfMonth;
        }

        // Calculate days held in this month before selling
        const holdingDays = Math.ceil((holdingEndDate - holdingStartDate) / (1000 * 60 * 60 * 24)) + 1;

        // Skip if sold on same day as bought (no brokerage)
        if (allocation.buyDate === allocation.sellDate) {
            console.log(`      📉 ${allocation.symbol}: ${allocation.quantityAllocated} shares - Same day trade, no brokerage`);
            continue;
        }

        // Calculate brokerage only if holding days > 0
        if (holdingDays > 0) {
            // Calculate value based on the buy value since that was the holding value
            const positionValue = allocation.buyValue;
            const allocBrokerage = calculateProRatedBrokerage(positionValue, holdingDays, daysInMonth);

            console.log(`      📉 SOLD ${allocation.symbol}: ${allocation.quantityAllocated} @ ₹${allocation.buyPrice.toFixed(2)} × ${holdingDays}/${daysInMonth} days = ₹${allocBrokerage.toFixed(2)}`);

            totalBrokerage += allocBrokerage;
            totalHoldingValue += positionValue;
            totalHoldingDays += holdingDays;

            // Create calculation formula for transparency
            const calculationFormula = `₹${positionValue.toFixed(2)} × 10% × ${holdingDays}/${daysInMonth} days = ₹${allocBrokerage.toFixed(2)}`;

            // Get the buy trade for this allocation
            const buyTrade = await db.query.trades.findFirst({
                where: eq(trades.id, allocation.buyTradeId),
            });
            if (buyTrade) {
                // Ensure all date values are plain numbers
                const now = Date.now();
                const safeBuyDate = typeof allocation.buyDate === "number" ? allocation.buyDate : now;
                const safeHoldingStartDate = typeof holdingStartDate === "number" ? holdingStartDate : now;
                const safeHoldingEndDate = typeof holdingEndDate === "number" ? holdingEndDate : now;
                const safeSellDate = typeof allocation.sellDate === "number" ? allocation.sellDate : now;

                brokerageDetails.push({
                    tradeId: buyTrade.id,
                    symbol: allocation.symbol,
                    exchange: allocation.exchange,
                    quantity: allocation.quantityAllocated,
                    buyPrice: allocation.buyPrice,
                    buyDate: safeBuyDate,
                    holdingStartDate: safeHoldingStartDate,
                    holdingEndDate: safeHoldingEndDate,
                    holdingDays,
                    totalDaysInMonth: daysInMonth,
                    positionValue,
                    brokerageAmount: allocBrokerage,
                    calculationFormula,
                    isSoldInMonth: 1,
                    sellDate: safeSellDate,
                    sellPrice: allocation.sellPrice,
                    sellValue: allocation.sellValue,
                });
            }
        }
    }

    console.log(`    💰 Total FIFO-Based Brokerage: ₹${totalBrokerage.toFixed(2)}`);
    return {
        totalBrokerage,
        details: brokerageDetails,
        totalHoldingValue,
        totalHoldingDays,
    };
}

async function getMonthlyTradeStats(
    clientId: number,
    startOfMonth: number,
    endOfMonth: number,
    tx?: TransactionType,
): Promise<{
        totalTrades: number;
        totalTurnover: number;
    }> {
    const db = getDB(tx);

    const monthlyTrades = await db.query.trades.findMany({
        where: and(
            eq(trades.clientId, clientId),
            gte(trades.tradeDate, startOfMonth),
            lte(trades.tradeDate, endOfMonth),
        ),
    });

    let totalTurnover = 0;

    for (const trade of monthlyTrades) {
        const tradeValue = trade.quantity * trade.price;
        totalTurnover += Math.abs(tradeValue);

        const tradeDate = new Date(trade.tradeDate).toLocaleDateString();
        console.log(
            `      ${trade.type === TradeType.BUY ? "📈 BUY" : "📉 SELL"} ${trade.symbol}: ${trade.quantity} @ ₹${trade.price.toFixed(2)} = ₹${tradeValue.toFixed(2)} on ${tradeDate}`,
        );
    }

    return {
        totalTrades: monthlyTrades.length,
        totalTurnover,
    };
}

export default brokerageRouter;
