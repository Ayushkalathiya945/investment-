import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { PeriodType } from "@/types/brokerage";

import * as brokerageQueries from "../db/queries/brokerage";
import { getMonthlyBrokerageSummary } from "../db/queries/brokerage";
import { authMiddleware } from "../middleware/auth";
import { brokerageFilterSchema } from "../utils/validation-schemas";

const brokerageRouter = new Hono();

brokerageRouter.use("*", authMiddleware);

function isValidDate(d: any): d is Date {
    return d instanceof Date && !Number.isNaN(d.getTime());
}

brokerageRouter.post("/get-all", zValidator("json", brokerageFilterSchema), async (c) => {
    const filters = c.req.valid("json");
    const {
        page = 1,
        limit = 15,
        periodType = PeriodType.DAILY,
        clientId,
        startDate,
        endDate,
        startMonth,
        startYear,
        endMonth,
        endYear,
        quarter,
        quarterYear,
        from,
        to,
    } = filters;

    const validatedPeriodType = Object.values(PeriodType).includes(periodType)
        ? periodType
        : PeriodType.DAILY;
    try {
        const formatDate = (dateStr: string): Date => {
            return new Date(dateStr);
        };

        switch (periodType) {
            case PeriodType.DAILY: {
                let queryFrom;
                let queryTo;

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
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const queryStartMonth = startMonth ?? 1;
                const queryStartYear = startYear ?? currentYear;
                const queryEndMonth = endMonth ?? 12;
                const queryEndYear = endYear ?? currentYear;
                const startDate = new Date(queryStartYear, queryStartMonth - 1, 1);
                const endDate = new Date(queryEndYear, queryEndMonth, 0);
                if (!isValidDate(startDate) || !isValidDate(endDate)) {
                    return c.json({
                        success: false,
                        message: "Invalid date range for monthly brokerage",
                        error: "Invalid start or end date",
                        periodType: PeriodType.MONTHLY,
                        request: filters,
                    }, 400);
                }

                const data = await getMonthlyBrokerageSummary({ from: startDate, to: endDate, clientId });

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
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;

                const Quarter = quarter ?? currentQuarter;
                const year = quarterYear ?? currentYear;

                if (Quarter < 1 || Quarter > 4) {
                    return c.json({
                        success: false,
                        message: "Invalid quarter. Must be between 1 and 4.",
                        error: `Invalid quarter: ${quarter}`,
                        periodType: PeriodType.QUARTERLY,
                        request: filters,
                    }, 400);
                }

                const quarterStartMonth = (Quarter - 1) * 3;
                const quarterEndMonth = quarterStartMonth + 2;

                const startDate = new Date(year, quarterStartMonth, 1);
                const endDate = new Date(year, quarterEndMonth + 1, 0);

                const quarterlyData = await brokerageQueries.getQuarterlyBrokerageSummary({
                    from: startDate,
                    to: endDate,
                    clientId,
                });

                const total = quarterlyData.length;
                const paginatedData = quarterlyData.slice((page - 1) * limit, page * limit);

                const transformedData = paginatedData.map((item: any) => ({
                    clientId: item.clientId,
                    clientName: item.clientName,
                    period: {
                        quarter: item.period.quarter,
                        year: item.period.year,
                    },
                    brokerageAmount: item.brokerageAmount,
                    totalHoldingAmount: item.totalHoldingAmount,
                    totalUnusedAmount: item.totalUnusedAmount,
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
