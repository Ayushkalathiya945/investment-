import type {
    BrokerageFilterRequest,
    BrokerageResponseType,
} from "@/types/brokerage";

import { PAGE_LIMIT } from "@/lib/constants";
import { PeriodType } from "@/types/brokerage";

import { ApiPost } from "./api-helper";

/**
 * Fetches brokerage records with the given filters
 */
async function getBrokerageRecords(filters: BrokerageFilterRequest) {
    try {
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

        const response = await ApiPost<BrokerageResponseType>("/brokerage/get-all", {
            page,
            limit,
            periodType,
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
        });

        return response;
    } catch (error) {
        console.error("Error fetching brokerage records:", error);
        throw new Error("Failed to fetch brokerage records");
    }
}

/**
 * Fetches brokerage data for a specific period
 */
export async function getPeriodicBrokerage(
    periodType: PeriodType = PeriodType.MONTHLY,
    period?: number,
    year?: number,
    page: number = 1,
    limit: number = PAGE_LIMIT,
    quarter?: number,
    quarterYear?: number,
    startMonth?: number,
    startYear?: number,
    endMonth?: number,
    endYear?: number,
    startDate?: string | Date,
    endDate?: string | Date,
    from?: string | Date,
    to?: string | Date,
) {
    const filters: BrokerageFilterRequest = {
        page,
        limit,
        periodType,
        // Use the parameters passed from the UI
        quarter,
        quarterYear,
        startMonth,
        startYear,
        endMonth,
        endYear,
        startDate: startDate ? (typeof startDate === "string" ? startDate : startDate.toISOString().split("T")[0]) : undefined,
        endDate: endDate ? (typeof endDate === "string" ? endDate : endDate.toISOString().split("T")[0]) : undefined,
        from,
        to,
    };

    // Fallback logic for backward compatibility with period/year parameters
    if (period !== undefined && !quarter && !startMonth && !from) {
        switch (periodType) {
            case PeriodType.QUARTERLY:
                if (period >= 1 && period <= 4) {
                    filters.quarter = period;
                    if (year)
                        filters.quarterYear = year;
                }
                break;
            case PeriodType.MONTHLY:
                if (period >= 1 && period <= 12) {
                    filters.startMonth = period;
                    filters.endMonth = period;
                    if (year) {
                        filters.startYear = year;
                        filters.endYear = year;
                    }
                }
                break;
            case PeriodType.DAILY:
                // For daily, we can use startDate/endDate or generic from/to
                if (year) {
                    const month = new Date().getMonth() + 1; // Default to current month
                    const startDate = new Date(year, month - 1, period);
                    const endDate = new Date(year, month - 1, period);
                    filters.startDate = startDate.toISOString().split("T")[0];
                    filters.endDate = endDate.toISOString().split("T")[0];
                }
                break;
        }
    }

    try {
        // console.log("Fetching periodic brokerage with filters:", filters);

        const response = await getBrokerageRecords(filters);
        return {
            success: response.success,
            data: response.data || [],
            periodType,
            metadata: response.metadata,
        };
    } catch (error) {
        console.error("Error fetching periodic brokerage:", { periodType, period, year, error });
        return { success: false, data: [], periodType };
    }
}
