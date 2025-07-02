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

export async function getBrokerageRecords(filters: BrokerageFilterRequest): Promise<{
    success: boolean;
    data: BrokerageItem[];
    periodType: PeriodType;
    metadata: {
        total: number;
        hasNext: boolean;
        totalPages: number;
        currentPage: number;
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
                currentPage: number;
            };
        }>("/brokerage/get-all", {
            ...filters,
            periodType,
        } as unknown as Record<string, unknown>);

        return response;
    } catch (error) {
        console.error("Error fetching brokerage records:", error);
        throw new Error(`${error}` || "Failed to fetch brokerage records");
    }
}

export async function getAllPeriodicBrokerage(
    periodType: PeriodType = PeriodType.MONTH,
    period?: number,
    year?: number,
    page: number = 1,
    limit: number = 20,
): Promise<{
        success: boolean;
        data: BrokerageItem[];
        periodType: PeriodType;
        metadata?: {
            total: number;
            hasNext: boolean;
            totalPages: number;
            currentPage: number;
        };
    }> {
    try {
        // Create a filter object based on period type
        const filters: BrokerageFilterRequest = {
            page,
            limit,
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
