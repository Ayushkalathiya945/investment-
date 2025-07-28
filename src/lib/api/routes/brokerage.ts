import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { PeriodType } from "@/types/brokerage";

import * as brokerageQueries from "../db/queries/brokerage";
import { getMonthlyBrokerageSummary } from "../db/queries/brokerage";
import { authMiddleware } from "../middleware/auth";
import { brokerageFilterSchema } from "../utils/validation-schemas";

// Create a new Hono router for brokerage routes
const brokerageRouter = new Hono();

// Apply authentication middleware to all brokerage routes
brokerageRouter.use("*", authMiddleware);

// Helper to check if a value is a valid Date
function isValidDate(d: any): d is Date {
    return d instanceof Date && !Number.isNaN(d.getTime());
}

// Get all brokerage calculations with filters
brokerageRouter.post("/get-all", zValidator("json", brokerageFilterSchema), async (c) => {
    const filters = c.req.valid("json");
    const {
        page = 1,
        limit = 15,
        periodType = PeriodType.DAILY,
        clientId,
        // Daily filters
        startDate,
        endDate,
        // Monthly filters
        startMonth,
        startYear,
        endMonth,
        endYear,
        // Quarterly filters
        quarter,
        quarterYear,
        // Generic date range filters
        from,
        to,
    } = filters;

    // console.log("Inside getBrokerageRecords with filters: ", filters);

    // Ensure periodType is valid and default to DAILY if not provided
    const validatedPeriodType = Object.values(PeriodType).includes(periodType)
        ? periodType
        : PeriodType.DAILY;

    try {
        // Convert string dates to Date objects
        const formatDate = (dateStr: string): Date => {
            return new Date(dateStr);
        };

        // Handle different period types
        switch (periodType) {
            case PeriodType.DAILY: {
                // Only use date range if explicitly provided, otherwise return all data
                let queryFrom;
                let queryTo;

                // If either startDate/endDate or from/to is provided, use them
                if (startDate || from) {
                    queryFrom = startDate ? formatDate(startDate) : (from ? formatDate(from) : undefined);
                }
                if (endDate || to) {
                    queryTo = endDate ? formatDate(endDate) : (to ? formatDate(to) : undefined);
                }

                try {
                    const { data, pagination } = await brokerageQueries.findAllDailyBrokerages({
                        page,
                        limit,
                        clientId,
                        from: queryFrom,
                        to: queryTo,
                    });

                    return c.json({
                        success: true,
                        data,
                        periodType: PeriodType.DAILY,
                        metadata: {
                            total: pagination.total,
                            page,
                            limit,
                            totalPages: Math.ceil(pagination.total / limit),
                            hasNext: page * limit < pagination.total,
                        },
                    });
                } catch (dbError) {
                    console.error("Database error in daily brokerage query:", dbError);
                    throw new Error(`Failed to fetch daily brokerage data: ${dbError instanceof Error ? dbError.message : "Unknown error"}`);
                }
            }

            case PeriodType.MONTHLY: {
                // Determine date range
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const queryStartMonth = startMonth ?? 1;
                const queryStartYear = startYear ?? currentYear;
                const queryEndMonth = endMonth ?? 12;
                const queryEndYear = endYear ?? currentYear;
                const startDate = new Date(queryStartYear, queryStartMonth - 1, 1);
                const endDate = new Date(queryEndYear, queryEndMonth, 0); // Last day of endMonth
                if (!isValidDate(startDate) || !isValidDate(endDate)) {
                    return c.json({
                        success: false,
                        message: "Invalid date range for monthly brokerage",
                        error: "Invalid start or end date",
                        periodType: PeriodType.MONTHLY,
                        request: filters,
                    }, 400);
                }

                // Fetch monthly summary
                const data = await getMonthlyBrokerageSummary({ from: startDate, to: endDate, clientId });
                // Manual pagination
                const total = data.length;
                const paginatedData = data.slice((page - 1) * limit, page * limit);
                return c.json({
                    success: true,
                    data: paginatedData,
                    periodType: PeriodType.MONTHLY,
                    metadata: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit),
                        hasNext: page * limit < total,
                    },
                });
            }
            case PeriodType.QUARTERLY: {
                // Use quarter and year directly without date range calculation
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

                // Use provided quarter and year, or default to current
                const Quarter = quarter ?? currentQuarter;
                const year = quarterYear ?? currentYear;

                // Validate quarter (1-4) and year
                if (Quarter < 1 || Quarter > 4) {
                    return c.json({
                        success: false,
                        message: "Invalid quarter. Must be between 1 and 4.",
                        error: `Invalid quarter: ${quarter}`,
                        periodType: PeriodType.QUARTERLY,
                        request: filters,
                    }, 400);
                }

                if (year < 1900 || year > 2100) {
                    return c.json({
                        success: false,
                        message: "Invalid year. Must be between 1900 and 2100.",
                        error: `Invalid year: ${year}`,
                        periodType: PeriodType.QUARTERLY,
                        request: filters,
                    }, 400);
                }

                // Calculate quarter date range
                const quarterStartMonth = (Quarter - 1) * 3; // 0, 3, 6, 9
                const quarterEndMonth = quarterStartMonth + 2; // 2, 5, 8, 11

                const startDate = new Date(year, quarterStartMonth, 1);
                const endDate = new Date(year, quarterEndMonth + 1, 0); // Last day of quarter

                // Fetch quarterly summary calculated from daily brokerage data
                const quarterlyData = await brokerageQueries.getQuarterlyBrokerageSummary({
                    from: startDate,
                    to: endDate,
                    clientId,
                });

                // Manual pagination for quarterly data
                const total = quarterlyData.length;
                const paginatedData = quarterlyData.slice((page - 1) * limit, page * limit);

                // Transform the data to match the expected response format
                const transformedData = paginatedData.map((item: any) => ({
                    clientId: item.clientId,
                    clientName: item.clientName,
                    period: {
                        quarter: item.period.quarter,
                        year: item.period.year,
                    },
                    brokerageAmount: item.brokerageAmount,
                }));

                return c.json({
                    success: true,
                    data: transformedData,
                    periodType: PeriodType.QUARTERLY,
                    metadata: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit),
                        hasNext: page * limit < total,
                    },
                });
            }

            default:
                return c.json(
                    {
                        success: false,
                        message: `Unsupported period type: ${periodType}`,
                    },
                    400,
                );
        }
    } catch (error) {
        console.error("Error in brokerage API:", error);

        // Log the full error for debugging
        if (error instanceof Error) {
            console.error("Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name,
            });
        }

        return c.json(
            {
                success: false,
                message: "Failed to process brokerage data",
                error: error instanceof Error ? error.message : "Unknown error",
                periodType: validatedPeriodType,
                request: {
                    periodType: validatedPeriodType,
                    clientId,
                    page,
                    limit,
                },
            },
            500,
        );
    }
});

export default brokerageRouter;
