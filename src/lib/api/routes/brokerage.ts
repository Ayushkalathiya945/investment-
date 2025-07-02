import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { PeriodType } from "@/types/brokerage";

import { getDB } from "../db";
import * as brokerageQueries from "../db/queries/brokerage";
import { clients } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { calculateAndSaveMonthlyBrokerageOptimized } from "../services/brokerage-calculator";
import { brokerageFilterSchema, brokerageSchema } from "../utils/validation-schemas";

// Create a new Hono router for brokerage routes
const brokerageRouter = new Hono();

// Apply authentication middleware to all brokerage routes
brokerageRouter.use("*", authMiddleware);

// Get all brokerage calculations with filters
brokerageRouter.post("/get-all", zValidator("json", brokerageFilterSchema), async (c) => {
    const { page, limit, clientId, month, quarter, year, from: fromDate, to: toDate } = c.req.valid("json");

    // console.log("\nGetting all brokerage calculations with filters...");
    // console.log("Filter params:", { page, limit, clientId, month, quarter, year, fromDate, toDate });

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
                currentPage: page,
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
        await calculateAndSaveMonthlyBrokerageOptimized(month, year);
        return c.json({
            success: true,
            message: `Successfully calculated brokerage for ${month}/${year}`,
        });
    } catch (error) {
        console.error(`Error calculating brokerage: ${error}`);
        throw new HTTPException(500, { message: `Failed to calculate brokerage: ${error}` });
    }
});

export default brokerageRouter;
