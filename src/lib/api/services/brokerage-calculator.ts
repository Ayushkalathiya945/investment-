import env from "@/env";

import type { TransactionType } from "../db";
import type {
    ExchangeType,
    FifoAllocation,
    Trade,
} from "../db/schema";

import * as brokerageQueries from "../db/queries/brokerage";
import * as clientQueries from "../db/queries/client";
import * as fifoAllocationQueries from "../db/queries/fifoAllocation";
import * as stockQueries from "../db/queries/stock";
import * as tradeQueries from "../db/queries/trade";

// Define the BrokerageDetailType interface based on the schema
export type BrokerageDetailType = {
    tradeId: number;
    symbol: string;
    exchange: ExchangeType;
    quantity: number;
    buyPrice: number;
    buyDate: number | Date | null;
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

/**
 * Gets the number of days in a month
 */
export function getDaysInMonth(month: number, year: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calculateProRatedBrokerage(
    stockValue: number,
    daysHeld: number,
    totalDaysInMonth: number,
    rate: number = env.BROKERAGE_RATE, // Default from env or fallback to 10% monthly rate
): number {
    const fullMonthBrokerage = stockValue * (rate / 100);
    return (fullMonthBrokerage * daysHeld) / totalDaysInMonth;
}

/**
 * Super-optimized version that calculates and saves brokerage for all clients
 * - Uses dedicated query functions
 * - Reduces database interactions
 * - Minimal logging
 * - Batch operations
 */
export async function calculateAndSaveMonthlyBrokerageOptimized(
    month: number,
    year: number,
    tx?: TransactionType,
): Promise<void> {
    // Minimal logging - just the start
    console.log(`🔍 Calculating brokerage for ${month}/${year}`);

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

    // Start time for performance tracking
    const startTime = Date.now();

    // Get all clients from the database using the query function
    const allClients = await clientQueries.getAllClients(tx);

    // Prepare batch data
    const clientBrokerages: Array<{
        clientData: any;
        brokerageData: any;
        detailsData: any[];
    }> = [];
    let totalBrokerageAmount = 0;
    let processedClientsCount = 0;
    let errorClientsCount = 0;

    // Process clients in parallel in reasonable batches (10 at a time) to prevent memory issues
    const batchSize = 10;
    for (let i = 0; i < allClients.length; i += batchSize) {
        const batch = allClients.slice(i, i + batchSize);

        // Process current batch in parallel
        const batchResults = await Promise.all(batch.map(async (client: any) => {
            try {
                // Calculate brokerage for this client
                const clientBrokerage = await calculateClientMonthlyBrokerageOptimized(client.id, month, year, tx);

                return {
                    success: true,
                    clientData: client,
                    brokerageData: {
                        clientId: client.id,
                        month,
                        year,
                        calculationPeriod,
                        totalDaysInMonth,
                        totalHoldingValue: clientBrokerage.totalHoldingValue,
                        totalHoldingDays: clientBrokerage.totalHoldingDays,
                        brokerageRate: env.BROKERAGE_RATE, // Rate from env variable
                        brokerageAmount: clientBrokerage.totalBrokerage,
                        totalPositions: clientBrokerage.details.length,
                        isPaid: 0,
                        paidAmount: 0,
                        calculatedAt: Date.now(),
                    },
                    detailsData: clientBrokerage.details,
                    brokerageAmount: clientBrokerage.totalBrokerage,
                };
            } catch (error) {
                return {
                    success: false,
                    clientId: client.id,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }));

        // Process batch results
        for (const result of batchResults) {
            if (result.success) {
                clientBrokerages.push({
                    clientData: result.clientData,
                    brokerageData: result.brokerageData,
                    detailsData: result.detailsData,
                });

                totalBrokerageAmount += result.brokerageAmount;
                processedClientsCount++;
            } else {
                errorClientsCount++;
                console.error(`${errorClientsCount} Error calculating brokerage for client ${result.clientId}: ${result.error}`);
            }
        }
    }

    // Use the batch save function to save all brokerages in a single transaction
    if (clientBrokerages.length > 0) {
        await brokerageQueries.batchSaveClientBrokerages(clientBrokerages, tx);
    }

    // Calculate execution time
    const executionTime = (Date.now() - startTime) / 1000;

    // Only log summary statistics
    console.log(`📋 SUMMARY: ${processedClientsCount}/${allClients.length} clients processed, ₹${totalBrokerageAmount.toFixed(2)} total brokerage in ${executionTime.toFixed(2)}s`);
}

export async function calculateClientMonthlyBrokerageOptimized(
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
    try {
        // Define the period boundaries
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1)).getTime();
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59)).getTime();
        const daysInMonth = getDaysInMonth(month, year);

        // Calculate brokerage based on FIFO holdings - with minimal logging
        const {
            totalBrokerage,
            details,
            totalHoldingValue,
            totalHoldingDays,
        } = await calculateFifoBrokerageOptimized(clientId, startOfMonth, endOfMonth, daysInMonth, tx);

        // Get trade statistics for the month - with minimal logging
        const { totalTrades, totalTurnover } = await getMonthlyTradeStatsOptimized(
            clientId,
            startOfMonth,
            endOfMonth,
            tx,
        );

        return {
            totalBrokerage,
            details,
            totalHoldingValue,
            totalHoldingDays,
            totalTrades,
            totalTurnover,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to calculate monthly brokerage for client ${clientId}: ${errorMessage}`);
    }
}

/**
 * Super-optimized FIFO brokerage calculation with minimal logging and query functions
 * All database queries use dedicated query functions to reduce database interactions
 */
async function calculateFifoBrokerageOptimized(
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
    let totalBrokerage = 0;
    let totalHoldingValue = 0;
    let totalHoldingDays = 0;
    const brokerageDetails: BrokerageDetailType[] = [];

    // Get current stock prices using the query function
    const stockPrices = await stockQueries.getCurrentStockPrices(tx);

    // 1. Get all BUY trades for the client that still have remaining quantity using the query function
    const buyTrades = await tradeQueries.getActiveBuyTrades(clientId, tx);

    // Calculate brokerage for each buy trade with remaining shares - refactored to use .map
    const activeTradeBrokerages = buyTrades
        .filter((trade: Trade) => trade.remainingQuantity > 0)
        .map((trade: Trade) => {
            const stockKey = `${trade.symbol}-${trade.exchange}`;
            const currentPrice = stockPrices.get(stockKey) || trade.price; // fallback to purchase price

            // Calculate holding days in this month
            let holdingStartDate: number = trade.tradeDate as number;
            let holdingDays: number = daysInMonth;

            // Skip if bought on the last day of the month (same day trades)
            const isSameDay = new Date(holdingStartDate).toDateString() === new Date(endOfMonth).toDateString();

            // If bought on the same day as the end of month review, no brokerage
            if (isSameDay) {
                holdingDays = 0;
            } else if (holdingStartDate >= startOfMonth) { // If bought during this month, adjust days held
                holdingDays = Math.floor((endOfMonth - holdingStartDate) / (1000 * 60 * 60 * 24)) + 1;
                if (holdingDays > daysInMonth)
                    holdingDays = daysInMonth;
            } else {
                // If bought before this month, use start of month
                holdingStartDate = startOfMonth;
            }

            // Calculate brokerage
            const positionValue = trade.remainingQuantity * currentPrice;
            // Only apply brokerage if holding days > 0 (not a same-day trade)
            const tradeBrokerage = holdingDays > 0
                ? calculateProRatedBrokerage(positionValue, holdingDays, daysInMonth)
                : 0;

            // Update totals
            totalBrokerage += tradeBrokerage;
            totalHoldingValue += positionValue;
            totalHoldingDays += holdingDays;

            // Create calculation formula for transparency
            const calculationFormula = `₹${positionValue.toFixed(2)} × 10% × ${holdingDays}/${daysInMonth} days = ₹${tradeBrokerage.toFixed(2)}`;

            // Return the details object for this trade
            return {
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
            };
        });

    // Add the results to the brokerageDetails array
    brokerageDetails.push(...activeTradeBrokerages);

    // 2. Handle sell trades during the month - use the new query function
    const fifoSellingAllocations = await fifoAllocationQueries.getFifoAllocationsByDateRange(
        clientId,
        startOfMonth,
        endOfMonth,
        tx,
    );

    // Process allocations in parallel but collect results before updating database
    const fifoAllocResults = await Promise.all(fifoSellingAllocations.map(async (allocation: FifoAllocation) => {
        // Skip if sold on same day as bought (no brokerage)
        if (allocation.buyDate === allocation.sellDate) {
            return null;
        }

        // Determine the holding period within this month
        let holdingStartDate = allocation.buyDate;
        const holdingEndDate = allocation.sellDate;

        // If bought before this month, adjust start date
        if (holdingStartDate < startOfMonth) {
            holdingStartDate = startOfMonth;
        }

        // Calculate days using Math.floor to avoid extra day
        const holdingDays = Math.floor((holdingEndDate - holdingStartDate) / (1000 * 60 * 60 * 24)) + 1;

        // Calculate brokerage only if holding days > 0
        if (holdingDays > 0) {
            const positionValue = allocation.buyValue;
            const allocBrokerage = calculateProRatedBrokerage(positionValue, holdingDays, daysInMonth);

            // Get the buy trade for this allocation - use the query function
            const buyTrade = await tradeQueries.getTradeById(allocation.buyTradeId, tx);
            if (buyTrade) {
                const now = Date.now();
                const safeBuyDate = typeof allocation.buyDate === "number" ? allocation.buyDate : now;
                const safeHoldingStartDate = typeof holdingStartDate === "number" ? holdingStartDate : now;
                const safeHoldingEndDate = typeof holdingEndDate === "number" ? holdingEndDate : now;
                const safeSellDate = typeof allocation.sellDate === "number" ? allocation.sellDate : now;

                return {
                    detail: {
                        tradeId: buyTrade.id,
                        symbol: allocation.symbol,
                        exchange: allocation.exchange as ExchangeType,
                        quantity: allocation.quantityAllocated,
                        buyPrice: allocation.buyPrice,
                        buyDate: safeBuyDate,
                        holdingStartDate: safeHoldingStartDate,
                        holdingEndDate: safeHoldingEndDate,
                        holdingDays,
                        totalDaysInMonth: daysInMonth,
                        positionValue,
                        brokerageAmount: allocBrokerage,
                        calculationFormula: `₹${positionValue.toFixed(2)} × 10% × ${holdingDays}/${daysInMonth} days = ₹${allocBrokerage.toFixed(2)}`,
                        isSoldInMonth: 1,
                        sellDate: safeSellDate,
                        sellPrice: allocation.sellPrice,
                        sellValue: allocation.sellValue,
                    },
                    brokerage: allocBrokerage,
                    value: positionValue,
                    days: holdingDays,
                };
            }
        }
        return null;
    }));

    // Filter out null results and collect the details in a single pass using reduce
    // This is more efficient than filtering and then looping
    const { brokerage: fifoBrokerage, value: fifoValue, days: fifoDays, details: fifoDetails }
        = fifoAllocResults
            .filter(result => result !== null)
            .reduce((acc, result) => {
                if (result) {
                    return {
                        brokerage: acc.brokerage + result.brokerage,
                        value: acc.value + result.value,
                        days: acc.days + result.days,
                        details: [...acc.details, result.detail],
                    };
                }
                return acc;
            }, { brokerage: 0, value: 0, days: 0, details: [] });

    // Add fifo results to totals
    totalBrokerage += fifoBrokerage;
    totalHoldingValue += fifoValue;
    totalHoldingDays += fifoDays;
    brokerageDetails.push(...fifoDetails);

    return {
        totalBrokerage,
        details: brokerageDetails,
        totalHoldingValue,
        totalHoldingDays,
    };
}

/**
 * Super-optimized trade stats with query functions and minimal logging
 */
async function getMonthlyTradeStatsOptimized(
    clientId: number,
    startOfMonth: number,
    endOfMonth: number,
    tx?: TransactionType,
): Promise<{
        totalTrades: number;
        totalTurnover: number;
    }> {
    // Use the query function to get trades within the date range
    const monthlyTrades = await tradeQueries.getTradesByDateRange(
        clientId,
        startOfMonth,
        endOfMonth,
        tx,
    );

    // Calculate total turnover
    const totalTurnover = monthlyTrades.reduce((sum: number, trade: Trade) => {
        const tradeValue = trade.quantity * trade.price;
        return sum + Math.abs(tradeValue);
    }, 0);

    return {
        totalTrades: monthlyTrades.length,
        totalTurnover,
    };
}
