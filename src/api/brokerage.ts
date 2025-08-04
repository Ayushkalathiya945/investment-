import type {
    BrokerageFilterRequest,
    BrokerageResponseType,
} from "@/types/brokerage";

import { PAGE_LIMIT } from "@/lib/constants";
import { PeriodType } from "@/types/brokerage";

import { ApiPost } from "./api-helper";

async function getBrokerageRecords(filters: BrokerageFilterRequest) {
    try {
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

export async function getPeriodicBrokerage(
    clientId?: string,
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
        clientId,
        page,
        limit,
        periodType,
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
                if (year) {
                    const month = new Date().getMonth() + 1;
                    const startDate = new Date(year, month - 1, period);
                    const endDate = new Date(year, month - 1, period);
                    filters.startDate = startDate.toISOString().split("T")[0];
                    filters.endDate = endDate.toISOString().split("T")[0];
                }
                break;
        }
    }

    try {
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
