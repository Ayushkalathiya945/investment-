import type {
    BrokerageCalculateRequest,
    BrokerageCalculateResponse,
    BrokerageFilterRequest,
    BrokerageItem,
} from "@/types/brokerage";

import { PeriodType } from "@/types/brokerage";

import { ApiPost } from "./api-helper";

export async function calculateBrokerage(data: BrokerageCalculateRequest): Promise<BrokerageCalculateResponse> {
    try {
        return await ApiPost<BrokerageCalculateResponse>("/brokerage/calculate", data as unknown as Record<string, unknown>);
    } catch (error: any) {
        console.error("Error calculating brokerage:", error);
        throw new Error(error.message || "Failed to calculate brokerage");
    }
}

/**
 * Fetches filtered brokerage records with pagination
 *
 * @param filters - Object containing filter parameters:
 * - page: Current page number
 * - limit: Records per page
 * - clientId: (optional) Filter by client ID
 * - month: (optional) Filter by month (1-12)
 * - quarter: (optional) Filter by quarter (1-4)
 * - year: (optional) Filter by year
 * - from: (optional) Start date in YYYY-MM-DD format
 * - to: (optional) End date in YYYY-MM-DD format
 *
 * @returns Promise with brokerage data and metadata
 */
export async function getBrokerageRecords(filters: BrokerageFilterRequest): Promise<{
    success: boolean;
    data: BrokerageItem[];
    periodType: PeriodType;
    metadata: {
        total: number;
        hasNext: boolean;
        totalPages: number;
    };
}> {
    // console.log(`Fetching brokerage records with filters:`, filters);

    try {
        // Determine period type based on provided filters
        let periodType = PeriodType.MONTH;
        if (filters.quarter) {
            periodType = PeriodType.QUARTER;
        } else if (filters.from && filters.to && !filters.month) {
            periodType = PeriodType.CUSTOM;
        }

        const response = await ApiPost<{
            success: boolean;
            data: BrokerageItem[];
            periodType: PeriodType;
            metadata: {
                total: number;
                hasNext: boolean;
                totalPages: number;
            };
        }>("/brokerage/get-all", {
            ...filters,
            periodType,
        } as unknown as Record<string, unknown>);

        return response;
    } catch (error: any) {
        console.error("Error fetching brokerage records:", error);
        throw new Error(error.message || "Failed to fetch brokerage records");
    }
}

/**
 * Fetches all periodic brokerage records for all clients, sorted from latest to oldest
 * Returns client name, brokerage amount, and date based on period type
 *
 * @param periodType - Type of period (month, quarter)
 * @param period - Optional period number (quarter 1-4 or month 1-12) based on periodType
 * @param year - Optional year for filtering data
 * @returns Promise with brokerage data
 */
export async function getAllPeriodicBrokerage(
    periodType: PeriodType = PeriodType.MONTH,
    period?: number,
    year?: number,
): Promise<{
        success: boolean;
        data: BrokerageItem[];
        periodType: PeriodType;
        metadata?: {
            total: number;
            hasNext: boolean;
            totalPages: number;
        };
    }> {
    try {
        // Create a filter object based on period type
        const filters: BrokerageFilterRequest = {
            page: 1,
            limit: 1000, // Use a large limit to get all records
        };

        // Add period-specific filters (quarter or month) based on periodType
        if (period) {
            if (periodType === PeriodType.QUARTER) {
                filters.quarter = period;
            } else if (periodType === PeriodType.MONTH) {
                filters.month = period;
            }
        }

        // Add year filter if provided
        if (year) {
            filters.year = year;
        }

        // console.log(`Fetching periodic brokerage with filters:`, filters);

        // Use the existing getBrokerageRecords function which calls the /get-all endpoint
        const response = await getBrokerageRecords(filters);

        // Return the response
        return {
            success: response.success,
            data: response.data || [],
            periodType,
            metadata: response.metadata,
        };
    } catch (error: any) {
        console.error("Error fetching periodic brokerage records:", error);
        console.error("Parameters:", { periodType, period, year });

        // Return empty success response instead of throwing
        return {
            success: false,
            data: [],
            periodType,
        };
    }
}
